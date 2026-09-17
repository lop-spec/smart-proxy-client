param([Parameter(Mandatory=$true)][string]$Stage)
$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows'){throw 'Hosted Windows diagnostics only'}
$stage=[IO.Path]::GetFullPath($Stage);$prefix=[IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd([char[]]'\/')+[IO.Path]::DirectorySeparatorChar
if(-not $stage.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){throw 'Only the owned stage may be inspected'}
$hostData=Get-Content -LiteralPath (Join-Path $stage 'output/host.json') -Raw|ConvertFrom-Json
$exe=Join-Path $stage 'smart-proxy-audit.exe'
$result=@{nativeAcceptance=$false;systemSettingsChanged=$false;ownedPid=$hostData.ownedPid;nativeExitCode=$hostData.exitCode;events=@();runtimeLocations=@();reasons=@();collectorIsAdministrator=([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator);originalLocalAppData=$env:LOCALAPPDATA;nativeLocalAppData=(Join-Path $stage 'localappdata')}
foreach($root in @((Join-Path ${env:ProgramFiles(x86)} 'Microsoft/EdgeWebView/Application'),(Join-Path $env:ProgramFiles 'Microsoft/EdgeWebView/Application'),(Join-Path $env:LOCALAPPDATA 'Microsoft/EdgeWebView/Application'))){if(Test-Path -LiteralPath $root){foreach($version in Get-ChildItem -LiteralPath $root -Directory|Where-Object Name -Match '^\d+\.\d+\.\d+\.\d+$'){$result.runtimeLocations+=@{path=$version.FullName;executableExists=(Test-Path -LiteralPath (Join-Path $version.FullName 'msedgewebview2.exe'))}}}}
if($hostData.ownedPid){
 $start=(Get-Item -LiteralPath $stage).CreationTime.AddSeconds(-2)
 for($attempt=0;$attempt -lt 4 -and -not $result.events.Count;$attempt++){
  try{foreach($event in Get-WinEvent -FilterHashtable @{LogName='Application';Id=1000;StartTime=$start} -MaxEvents 30 -ErrorAction Stop){
   $data=@{};foreach($node in ([xml]$event.ToXml()).Event.EventData.Data){$data[[string]$node.Name]=[string]$node.'#text'}
   if($data.AppPath -ine $exe -or -not $data.ProcessId){continue}
   $eventPid=if($data.ProcessId -match '^0x'){[Convert]::ToUInt32($data.ProcessId.Substring(2),16)}else{[uint32]$data.ProcessId}
   if($eventPid -ne [uint32]$hostData.ownedPid){continue}
   $row=@{time=$event.TimeCreated.ToUniversalTime().ToString('o');provider=$event.ProviderName;id=$event.Id}
   foreach($key in @('AppName','AppVersion','AppPath','ModuleName','ModuleVersion','ModulePath','ExceptionCode','FaultingOffset','ProcessId')){$row[$key]=$data[$key]}
   $result.events+=$row
  }}catch{if($_.FullyQualifiedErrorId -notlike 'NoMatchingEventsFound*'){$result.reasons+='Application event query unavailable: '+$_.Exception.Message;break}}
  if(-not $result.events.Count -and $attempt -lt 3){Start-Sleep -Seconds 2}
 }
 if(-not $result.events.Count){$result.reasons+='No exact owned PID/path crash event within bounded query; this is not proof of absence'}
}else{$result.reasons+='No owned native PID was created; application-event lookup skipped'}
if(-not $result.runtimeLocations.Count){$result.reasons+='No installed runtime executable found at the three known installation roots'}
foreach($reason in $result.reasons){Write-Warning $reason}
$result|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $stage 'output/startup-context.json') -Encoding UTF8
Write-Output ('Owned crash events='+$result.events.Count+' runtimeLocations='+$result.runtimeLocations.Count)
