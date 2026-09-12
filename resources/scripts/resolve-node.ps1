param([string]$AppRoot = '.')
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
$candidates = New-Object 'System.Collections.Generic.List[string]'
function Add-Candidate([string]$Path) { if ($Path -and !$candidates.Contains($Path)) { $candidates.Add($Path) } }
foreach ($relative in @('node.exe','runtime\node.exe','resources\bin\node.exe')) { Add-Candidate (Join-Path $AppRoot $relative) }
$command = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($command) { Add-Candidate $command.Source }
# Reuse existing runtimes (including portable Pi), without installing Node or editing PATH.
try {
  foreach ($p in @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -OperationTimeoutSec 5 | Select-Object -First 32)) { Add-Candidate $p.ExecutablePath }
} catch { [Console]::Error.WriteLine('Node discovery: process inventory unavailable; checking standard locations') }
foreach ($root in @($env:ProgramFiles,${env:ProgramFiles(x86)})) { if ($root) { Add-Candidate (Join-Path $root 'nodejs\node.exe') } }
foreach ($candidate in $candidates) {
  if (!(Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
  $p = New-Object Diagnostics.Process
  $p.StartInfo = New-Object Diagnostics.ProcessStartInfo
  $p.StartInfo.FileName = $candidate
  $p.StartInfo.Arguments = '--version'
  $p.StartInfo.UseShellExecute = $false
  $p.StartInfo.CreateNoWindow = $true
  $p.StartInfo.RedirectStandardOutput = $true
  $p.StartInfo.RedirectStandardError = $true
  try {
    if (!$p.Start()) { throw 'start failed' }
    if (!$p.WaitForExit(3000)) { $p.Kill(); throw 'version timeout' }
    $version = $p.StandardOutput.ReadToEnd().Trim()
    if ($p.ExitCode -eq 0 -and $version -match '^v(\d+)\.\d+\.\d+$' -and [int]$Matches[1] -ge 22) {
      [pscustomobject]@{path=[IO.Path]::GetFullPath($candidate);version=$version} | ConvertTo-Json -Compress
      exit 0
    }
    [Console]::Error.WriteLine('Node discovery: candidate rejected (requires Node 22+)')
  } catch { [Console]::Error.WriteLine('Node discovery: candidate validation failed') }
  finally { $p.Dispose() }
}
[Console]::Error.WriteLine('Node 22+ not found: searched app directory, PATH, running Node processes and standard installation paths')
exit 1
