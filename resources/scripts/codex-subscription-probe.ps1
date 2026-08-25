param(
  [Parameter(Mandatory = $true)][ValidateRange(1, 65535)][int]$ProxyPort,
  [ValidateNotNullOrEmpty()][string]$Model = "gpt-5.3-codex-spark",
  [ValidateRange(10, 120)][int]$TimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-ProbeResult {
  param([hashtable]$Value)
  [Console]::Out.WriteLine(($Value | ConvertTo-Json -Compress -Depth 12))
}

function Find-CodexExecutable {
  $explicitPath = [Environment]::GetEnvironmentVariable("CODEX_EXECUTABLE")
  if ($explicitPath -and (Test-Path -LiteralPath $explicitPath -PathType Leaf)) {
    return (Resolve-Path -LiteralPath $explicitPath).Path
  }

  $command = Get-Command codex.exe -ErrorAction SilentlyContinue
  if ($command -and $command.Source -and (Test-Path -LiteralPath $command.Source -PathType Leaf)) {
    return $command.Source
  }

  $userProfile = [Environment]::GetFolderPath("UserProfile")
  $extensionRoots = @(
    (Join-Path $userProfile "Documents\claude\vscodium\app\data\extensions"),
    (Join-Path $userProfile ".vscode\extensions"),
    (Join-Path $userProfile ".vscode-oss\extensions")
  )
  foreach ($root in $extensionRoots) {
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { continue }
    $extensionDirs = Get-ChildItem -LiteralPath $root -Directory -Filter "openai.chatgpt-*" -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTimeUtc -Descending
    foreach ($extensionDir in $extensionDirs) {
      $candidate = Join-Path $extensionDir.FullName "bin\windows-x86_64\codex.exe"
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
  }
  throw "Codex executable was not found; install or update the OpenAI Codex extension"
}

function Write-AppMessage {
  param(
    [Parameter(Mandatory = $true)]$Writer,
    [Parameter(Mandatory = $true)][hashtable]$Message
  )
  $Writer.WriteLine(($Message | ConvertTo-Json -Compress -Depth 24))
  $Writer.Flush()
}

function Read-AppMessage {
  param(
    [Parameter(Mandatory = $true)]$Reader,
    [Parameter(Mandatory = $true)]$Process,
    [Parameter(Mandatory = $true)]$Watch,
    [Parameter(Mandatory = $true)][int64]$DeadlineMs,
    [Parameter(Mandatory = $true)][string]$Phase
  )
  while ($true) {
    $readTask = $Reader.ReadLineAsync()
    while (-not $readTask.IsCompleted) {
      if ($Watch.ElapsedMilliseconds -ge $DeadlineMs) {
        throw "Codex app-server $Phase timed out"
      }
      Start-Sleep -Milliseconds 25
    }
    $line = $readTask.GetAwaiter().GetResult()
    if ($null -eq $line) {
      $exitText = if ($Process.HasExited) { " (exit $($Process.ExitCode))" } else { "" }
      throw "Codex app-server closed during $Phase$exitText"
    }
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    try { return ($line | ConvertFrom-Json -ErrorAction Stop) }
    catch { continue }
  }
}

function Read-NumberProperty {
  param(
    $Value,
    [Parameter(Mandatory = $true)][string[]]$Names
  )
  if ($null -eq $Value) { return 0 }
  foreach ($name in $Names) {
    $property = $Value.PSObject.Properties[$name]
    if ($property -and $null -ne $property.Value) {
      $number = 0.0
      if ([double]::TryParse([string]$property.Value, [ref]$number)) { return $number }
    }
  }
  return 0
}

$appProcess = $null
$appWriter = $null
$appReader = $null
$stderrTask = $null
$probeResult = $null
try {
  $codexPath = Find-CodexExecutable
  $proxyUrl = "http://127.0.0.1:$ProxyPort"
  $encoding = New-Object Text.UTF8Encoding($false)
  $processInfo = New-Object Diagnostics.ProcessStartInfo
  $processInfo.FileName = $codexPath
  $processInfo.Arguments = "app-server --listen stdio:// -c mcp_servers={} --disable shell_tool"
  $processInfo.WorkingDirectory = [IO.Path]::GetTempPath()
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  $processInfo.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
  $processInfo.RedirectStandardInput = $true
  $processInfo.RedirectStandardOutput = $true
  $processInfo.RedirectStandardError = $true
  $processInfo.StandardOutputEncoding = $encoding
  $processInfo.StandardErrorEncoding = $encoding
  $processInfo.EnvironmentVariables["HTTP_PROXY"] = $proxyUrl
  $processInfo.EnvironmentVariables["HTTPS_PROXY"] = $proxyUrl
  $processInfo.EnvironmentVariables["http_proxy"] = $proxyUrl
  $processInfo.EnvironmentVariables["https_proxy"] = $proxyUrl
  $loopbackBypass = "127.0.0.1,localhost,::1"
  $processInfo.EnvironmentVariables["NO_PROXY"] = $loopbackBypass
  $processInfo.EnvironmentVariables["no_proxy"] = $loopbackBypass
  if ($processInfo.EnvironmentVariables.ContainsKey("RUST_LOG")) {
    $processInfo.EnvironmentVariables.Remove("RUST_LOG")
  }

  $appProcess = New-Object Diagnostics.Process
  $appProcess.StartInfo = $processInfo
  if (-not $appProcess.Start()) { throw "Codex app-server failed to start" }
  $appWriter = $appProcess.StandardInput
  $appReader = $appProcess.StandardOutput
  $stderrTask = $appProcess.StandardError.ReadToEndAsync()

  $startupWatch = [Diagnostics.Stopwatch]::StartNew()
  $startupDeadlineMs = [Math]::Max(30000, [Math]::Min(60000, $TimeoutSeconds * 1000))
  Write-AppMessage $appWriter @{
    method = "initialize"
    id = 1
    params = @{
      clientInfo = @{ name = "codex_cli_rs"; title = "Smart Proxy Codex Probe"; version = "35" }
      capabilities = @{ experimentalApi = $true }
    }
  }
  $initializeResponse = $null
  while ($null -eq $initializeResponse) {
    $message = Read-AppMessage $appReader $appProcess $startupWatch $startupDeadlineMs "initialization"
    if ($message.id -eq 1) { $initializeResponse = $message }
  }
  if ($initializeResponse.error) { throw "Codex initialize failed: $($initializeResponse.error.message)" }
  Write-AppMessage $appWriter @{ method = "initialized"; params = @{} }

  Write-AppMessage $appWriter @{
    method = "thread/start"
    id = 2
    params = @{
      model = $Model
      cwd = [IO.Path]::GetTempPath()
      approvalPolicy = "never"
      sandbox = "read-only"
      personality = "none"
      ephemeral = $true
      experimentalRawEvents = $true
      serviceName = "smart_proxy_codex_probe"
      config = @{ model_reasoning_effort = "low" }
    }
  }
  $threadResponse = $null
  while ($null -eq $threadResponse) {
    $message = Read-AppMessage $appReader $appProcess $startupWatch $startupDeadlineMs "thread start"
    if ($message.id -eq 2) { $threadResponse = $message }
  }
  if ($threadResponse.error) { throw "Codex thread start failed: $($threadResponse.error.message)" }
  $threadId = [string]$threadResponse.result.thread.id
  if ([string]::IsNullOrWhiteSpace($threadId)) { throw "Codex thread start returned no thread id" }
  $resolvedModel = [string]$threadResponse.result.model
  if ([string]::IsNullOrWhiteSpace($resolvedModel)) {
    throw "Codex thread start returned no resolved model; refusing an unverified speed result"
  }

  $benchmarkWords = 128
  $prompt = "Output exactly $benchmarkWords copies of the lowercase word speed separated by single spaces, then stop. Do not use tools or explain."
  $turnWatch = [Diagnostics.Stopwatch]::StartNew()
  Write-AppMessage $appWriter @{
    method = "turn/start"
    id = 3
    params = @{
      threadId = $threadId
      input = @(@{ type = "text"; text = $prompt })
      model = $Model
      effort = "low"
      personality = "none"
      approvalPolicy = "never"
      sandboxPolicy = @{ type = "readOnly" }
    }
  }

  $turnDeadlineMs = $TimeoutSeconds * 1000
  $turnAcceptedMs = 0
  $firstDeltaMs = 0
  $lastDeltaMs = 0
  $completedMs = 0
  $deltaCount = 0
  $characters = 0
  $usage = $null
  $turnError = ""
  $reroutedModel = ""
  $toolActivity = $false
  $turnCompleted = $false
  while (-not $turnCompleted) {
    $message = Read-AppMessage $appReader $appProcess $turnWatch $turnDeadlineMs "turn"
    if ($message.id -eq 3) {
      if ($message.error) { throw "Codex turn start failed: $($message.error.message)" }
      $turnAcceptedMs = [Math]::Max(1, [int]$turnWatch.ElapsedMilliseconds)
      continue
    }
    $method = [string]$message.method
    if ($method -eq "item/agentMessage/delta") {
      $delta = [string]$message.params.delta
      if (-not $firstDeltaMs) { $firstDeltaMs = [Math]::Max(1, [int]$turnWatch.ElapsedMilliseconds) }
      $lastDeltaMs = [Math]::Max($firstDeltaMs, [int]$turnWatch.ElapsedMilliseconds)
      $deltaCount++
      $characters += $delta.Length
    }
    elseif ($method -eq "rawResponse/completed") {
      $usage = $message.params.usage
    }
    elseif ($method -eq "model/rerouted") {
      $reroutedModel = [string]$message.params.toModel
    }
    elseif ($method -eq "item/started") {
      $itemType = [string]$message.params.item.type
      if ($itemType -and @("userMessage", "agentMessage", "reasoning") -notcontains $itemType) {
        $toolActivity = $true
      }
    }
    elseif ($method -eq "turn/completed") {
      $completedMs = [Math]::Max(1, [int]$turnWatch.ElapsedMilliseconds)
      $status = [string]$message.params.turn.status
      if ($status -ne "completed") {
        $turnError = [string]$message.params.turn.error.message
        if ([string]::IsNullOrWhiteSpace($turnError)) { $turnError = "turn status $status" }
      }
      $turnCompleted = $true
    }
  }
  $turnWatch.Stop()

  if ($turnError) { throw "Codex benchmark failed: $turnError" }
  if ($toolActivity) { throw "Codex benchmark attempted a tool call" }
  if (-not $firstDeltaMs -or $characters -lt 40 -or $deltaCount -lt 2) {
    throw "Codex app-server returned no usable streamed text deltas"
  }
  $effectiveModel = if ($reroutedModel) { $reroutedModel } else { $resolvedModel }
  $resolvedModelVerified = -not $reroutedModel -and $effectiveModel -eq $Model
  if (-not $resolvedModelVerified) { throw "Requested model $Model but Codex resolved $effectiveModel" }

  $outputTokens = Read-NumberProperty $usage @("outputTokens", "output_tokens")
  $reasoningTokens = Read-NumberProperty $usage @("reasoningOutputTokens", "reasoning_output_tokens")
  $textTokens = [Math]::Max(0, $outputTokens - $reasoningTokens)
  if ($textTokens -le 0) { $textTokens = [Math]::Max(1, [Math]::Round($characters / 6.0)) }
  $streamMs = [Math]::Max(1, $completedMs - $firstDeltaMs)
  if ($streamMs -lt 50) { throw "Codex stream duration was too short to measure reliably" }

  $probeResult = @{
    ok = $true
    http = 200
    requestedModel = $Model
    resolvedModel = $effectiveModel
    resolvedModelVerified = $true
    modelVerificationSource = "thread-start-resolved+no-reroute"
    tokPerSec = [Math]::Round($textTokens / ($streamMs / 1000.0), 1)
    tokEst = [Math]::Round($textTokens)
    ttftMs = $firstDeltaMs
    headerMs = $turnAcceptedMs
    streamMs = $streamMs
    deltaCount = $deltaCount
    timingSource = "codex-app-server-delta"
  }
}
catch {
  $message = [string]$_.Exception.Message
  if ($message.Length -gt 500) { $message = $message.Substring(0, 500) }
  $probeResult = @{ ok = $false; http = 0; error = $message }
}
finally {
  if ($appWriter) {
    try { $appWriter.Close() } catch {}
  }
  if ($appProcess) {
    try {
      if (-not $appProcess.HasExited -and -not $appProcess.WaitForExit(2500)) {
        $appProcess.Kill()
        $appProcess.WaitForExit(2500) | Out-Null
      }
    }
    catch {}
  }
  if ($appReader) { try { $appReader.Dispose() } catch {} }
  if ($stderrTask) { try { $stderrTask.GetAwaiter().GetResult() | Out-Null } catch {} }
  if ($appProcess) { $appProcess.Dispose() }
}

Write-ProbeResult $probeResult
