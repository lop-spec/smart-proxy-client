param(
  [ValidateSet('Check','Install')][string]$Action = 'Check',
  [Parameter(Mandatory=$true)][string]$DestinationDir,
  [Parameter(Mandatory=$true)][string]$WorkDir,
  [string]$ConfigPath = ''
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$job = Join-Path $WorkDir ('core-update-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $job -Force | Out-Null
$curl = Join-Path $env:SystemRoot 'System32\curl.exe'
function Download([string]$Url, [string]$Target, [int]$Seconds, [string]$Accept = 'application/vnd.github+json', [int]$MinimumSpeed = 0) {
  # Deliberately independent of the proxy being repaired; no inherited proxy/config.
  $previousPreference = $ErrorActionPreference
  try {
    # PS 5.1 must not turn native stderr into a terminating error before exit-code handling.
    $ErrorActionPreference = 'Continue'
    & $curl -q --noproxy '*' --fail --location --silent --show-error --compressed --connect-timeout 10 --max-time $Seconds --speed-time 10 --speed-limit $MinimumSpeed --proto '=https' --proto-redir '=https' -A 'SmartProxy-Core-Updater' -H "Accept: $Accept" -o $Target $Url 2> (Join-Path $job 'curl-error.txt')
    $code = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previousPreference }
  if ($code -ne 0) {
    $detail = Get-Content -LiteralPath (Join-Path $job 'curl-error.txt') -Raw
    throw ('Direct download failed, curl ' + $code + ': ' + $detail)
  }
}
function Version([string]$Exe) {
  $ErrorActionPreference = 'Continue'
  $v = & $Exe version 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Downloaded executable failed version validation' }
  return (($v | Select-Object -First 1) -as [string])
}
try {
  $metadata = Join-Path $job 'release.json'
  'Fetching official release metadata (direct)' | Set-Content -LiteralPath (Join-Path $job 'progress.txt')
  Download 'https://api.github.com/repos/SagerNet/sing-box/releases/latest' $metadata 20
  $release = Get-Content -LiteralPath $metadata -Raw | ConvertFrom-Json
  if ($release.draft -or $release.prerelease -or $release.tag_name -notmatch '^v(\d+\.\d+\.\d+)$') { throw 'Invalid stable release metadata' }
  $version = $Matches[1]
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'amd64' }
  $assetName = 'sing-box-' + $version + '-windows-' + $arch + '.zip'
  $asset = @($release.assets | Where-Object { $_.name -eq $assetName })
  if ($asset.Count -ne 1) { throw ('Official asset missing: ' + $assetName) }
  $asset = $asset[0]
  if ($asset.digest -notmatch '^sha256:([a-fA-F0-9]{64})$') { throw 'Official SHA256 digest missing; refusing an unverified install' }
  $expectedHash = $Matches[1].ToLowerInvariant()
  if ($asset.size -lt 1048576 -or $asset.size -gt 209715200) { throw 'Invalid release asset size' }
  if ($asset.browser_download_url -notmatch '^https://github\.com/SagerNet/sing-box/releases/download/') { throw 'Unexpected release asset URL' }
  if ($Action -eq 'Check') {
    [pscustomobject]@{latest=$release.tag_name;asset=$assetName;sha256=$expectedHash;size=$asset.size} | ConvertTo-Json -Compress
    Remove-Item -LiteralPath $job -Recurse -Force
    exit 0
  }
  $zip = Join-Path $job 'release.zip'
  ('Downloading ' + $assetName + ' (direct), expected bytes ' + $asset.size) | Set-Content -LiteralPath (Join-Path $job 'progress.txt')
  # GitHub's official asset API redirects to its release CDN without the web download host.
  if ($asset.url -notmatch '^https://api\.github\.com/repos/SagerNet/sing-box/releases/assets/\d+$') { throw 'Unexpected asset API URL' }
  $downloadSource = 'GitHub official asset API'
  $deadline = [Diagnostics.Stopwatch]::StartNew()
  try { Download $asset.url $zip 180 'application/octet-stream' 131072 }
  catch {
    $reason = 'Official CDN failed or below 128 KiB/s for 10s; using ghfast.top byte mirror, still requiring independent official size and SHA256. Reason: ' + $_.Exception.Message
    [Console]::Error.WriteLine($reason)
    $reason | Set-Content -LiteralPath (Join-Path $job 'download-route.txt')
    $remaining = [int][Math]::Floor(180 - $deadline.Elapsed.TotalSeconds)
    if ($remaining -lt 1) { throw 'Asset download deadline reached; previous core retained' }
    $downloadSource = 'ghfast.top mirror (official SHA256 verified)'
    ('Downloading through verified-byte mirror ghfast.top') | Set-Content -LiteralPath (Join-Path $job 'progress.txt')
    Download ('https://ghfast.top/' + $asset.browser_download_url) $zip $remaining 'application/octet-stream'
  }
  if ((Get-Item -LiteralPath $zip).Length -ne $asset.size) { throw 'Release archive size mismatch' }
  if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) { throw 'Release archive SHA256 mismatch' }
  $extract = Join-Path $job 'unpacked'
  Expand-Archive -LiteralPath $zip -DestinationPath $extract
  $executables = @(Get-ChildItem -LiteralPath $extract -Recurse -File -Filter 'sing-box.exe')
  if ($executables.Count -ne 1) { throw 'Release archive must contain exactly one sing-box.exe' }
  $exe = $executables[0].FullName
  $installed = Version $exe
  if ($installed -notmatch ('^sing-box version ' + [regex]::Escape($version) + '(\s|$)')) { throw 'Executable version does not match release' }
  if ($ConfigPath -and (Test-Path -LiteralPath $ConfigPath)) {
    $previousPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      $check = & $exe check -c $ConfigPath 2>&1
      $checkCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    $check | Set-Content -LiteralPath (Join-Path $job 'config-check.txt')
    if ($checkCode -ne 0) { throw 'New core rejected the running configuration; previous path retained. See core-update job files.' }
    if ($check) { [Console]::Error.WriteLine('Core configuration check succeeded with diagnostic output: ' + ($check -join ' ')) }
  }
  New-Item -ItemType Directory -Path $DestinationDir -Force | Out-Null
  # Unique versioned path: never overwrite an installed or running executable.
  $destination = Join-Path $DestinationDir ('sing-box-' + $version + '-' + [guid]::NewGuid().ToString('N').Substring(0,8) + '.exe')
  Copy-Item -LiteralPath $exe -Destination $destination
  if ((Get-FileHash -LiteralPath $exe).Hash -ne (Get-FileHash -LiteralPath $destination).Hash) { throw 'Installed executable readback mismatch' }
  [pscustomobject]@{latest=$release.tag_name;asset=$assetName;installed=$installed;path=$destination;sha256=$expectedHash;size=$asset.size;source=$downloadSource} | ConvertTo-Json -Compress
  # Only this invocation's temporary files; installed assets and prior job evidence are retained.
  Remove-Item -LiteralPath $job -Recurse -Force
} catch {
  $_.Exception.Message | Set-Content -LiteralPath (Join-Path $job 'error.txt')
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
