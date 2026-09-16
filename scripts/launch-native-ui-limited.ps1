param([Parameter(Mandatory=$true)][string]$Stage,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedExeSha256,[ValidateSet('Launch','Task')][string]$Mode='Launch',[string]$RunnerTemp,[string]$ExpectedSid,[int]$ExpectedSession)
$ErrorActionPreference='Stop'
function Json($name,$value){$file=Join-Path $Stage ('output/'+$name);$tmp=$file+'.tmp';[IO.File]::WriteAllText($tmp,($value|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false));[IO.File]::Move($tmp,$file)}
function HashBytes($bytes){$sha=[Security.Cryptography.SHA256]::Create();try{[BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
$identity=[Security.Principal.WindowsIdentity]::GetCurrent();$session=[Diagnostics.Process]::GetCurrentProcess().SessionId
if($Mode -eq 'Launch'){
 if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows' -or $session -eq 0){throw 'Hosted interactive Windows workflow required'}
 $RunnerTemp=$env:RUNNER_TEMP;$ExpectedSid=$identity.User.Value;$ExpectedSession=$session
}
$Stage=[IO.Path]::GetFullPath($Stage);$prefix=[IO.Path]::GetFullPath($RunnerTemp).TrimEnd([char[]]'\/')+[IO.Path]::DirectorySeparatorChar
if(-not $Stage.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){throw 'Owned RUNNER_TEMP stage required'}
if($Mode -eq 'Task'){
 $record=@{sameUser=($identity.User.Value -eq $ExpectedSid);session=$session;expectedSession=$ExpectedSession;isAdministrator=([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator);wrapperPid=$PID;ok=$false;timedOut=$false;exitCode=1}
 $child=$null
 try{
  if(-not $record.sameUser -or $session -ne $ExpectedSession -or $session -eq 0 -or $record.isAdministrator){throw 'Task did not obtain the same interactive user without elevation'}
  # Only these non-secret CI markers are supplied; no credentials/environment export.
  $env:GITHUB_ACTIONS='true';$env:RUNNER_OS='Windows';$env:RUNNER_TEMP=$RunnerTemp
  $hostScript=Join-Path $PSScriptRoot 'run-native-ui-audit.ps1'
  $arguments=@('-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File',('"'+$hostScript+'"'),'-Stage',('"'+$Stage+'"'),'-ExpectedExeSha256',$ExpectedExeSha256,'-RequireNonElevated')
  $child=Start-Process -FilePath "$env:SystemRoot/System32/WindowsPowerShell/v1.0/powershell.exe" -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput "$Stage/output/helper.stdout.log" -RedirectStandardError "$Stage/output/helper.stderr.log"
  [void]$child.Handle;$record.helperPid=$child.Id;$record.deadlineSeconds=180;Json 'limited-task-start.json' $record
  if(-not $child.WaitForExit(180000)){$record.timedOut=$true;$child.Kill();[void]$child.WaitForExit(5000);throw 'Owned hidden native helper exceeded 180 seconds'}
  $record.exitCode=$child.ExitCode;$record.ok=($child.ExitCode -eq 0)
 }catch{$record.error=$_.Exception.Message;Write-Warning $record.error}finally{Json 'limited-task.json' $record}
 exit $record.exitCode
}
$service=New-Object -ComObject Schedule.Service;$service.Connect();$folder=$service.GetFolder('\')
$name='SmartProxy-Native-'+[guid]::NewGuid().ToString('N');$registered=$null;$export=$null
$cleanup=@{name=$name;removed=$false;exportVerified=$false;timedOut=$false;noSettingsChanged=$true}
try{
 $definition=$service.NewTask(0);$definition.Principal.UserId=$identity.Name;$definition.Principal.LogonType=3;$definition.Principal.RunLevel=0
 $definition.Settings.Hidden=$true;$definition.Settings.ExecutionTimeLimit='PT4M';$definition.Settings.AllowDemandStart=$true;$definition.Settings.DisallowStartIfOnBatteries=$false;$definition.Settings.StopIfGoingOnBatteries=$false
 $action=$definition.Actions.Create(0);$action.Path="$env:SystemRoot/System32/WindowsPowerShell/v1.0/powershell.exe"
 $action.Arguments='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$PSCommandPath+'" -Mode Task -Stage "'+$Stage+'" -ExpectedExeSha256 '+$ExpectedExeSha256+' -RunnerTemp "'+$RunnerTemp+'" -ExpectedSid '+$ExpectedSid+' -ExpectedSession '+$ExpectedSession
 $registered=$folder.RegisterTaskDefinition($name,$definition,2,$identity.Name,$null,3,$null)
 $export=$registered.Xml;$bytes=[Text.UTF8Encoding]::new($false).GetBytes($export);$file=Join-Path $Stage 'output/owned-task.xml';[IO.File]::WriteAllBytes($file,$bytes)
 $cleanup.exportSha256=HashBytes $bytes;$cleanup.exportVerified=((HashBytes ([IO.File]::ReadAllBytes($file))) -eq $cleanup.exportSha256)
 if(-not $cleanup.exportVerified){throw 'Owned task export hash mismatch'}
 [void]$registered.Run($null);$timer=[Diagnostics.Stopwatch]::StartNew();$lastLog=-10
 while(-not (Test-Path -LiteralPath "$Stage/output/limited-task.json")){
  if($timer.Elapsed.TotalSeconds -gt 210){$cleanup.timedOut=$true;throw 'Owned Limited task exceeded 210 seconds'}
  if($timer.Elapsed.TotalSeconds-$lastLog -ge 10){Write-Output ('Limited native task: elapsed='+[math]::Round($timer.Elapsed.TotalSeconds)+'s state='+$registered.State);$lastLog=$timer.Elapsed.TotalSeconds}
  Start-Sleep -Milliseconds 500
 }
 $result=Get-Content -LiteralPath "$Stage/output/limited-task.json" -Raw|ConvertFrom-Json
 if(-not $result.ok){throw ('Limited native helper failed: '+$result.exitCode+' '+$result.error)}
}finally{
 if($registered){
  $current=$folder.GetTask($name)
  if($current.Xml -cne $export -or -not $cleanup.exportVerified){throw 'Owned task identity/export changed; task not removed'}
  for($i=0;$i -lt 10 -and ($current.State -eq 4 -or $current.State -eq 2);$i++){Start-Sleep -Milliseconds 200}
  if($current.State -eq 4 -or $current.State -eq 2){$current.Stop(0);$cleanup.stopRequested=$true}
  $folder.DeleteTask($name,0)
  try{[void]$folder.GetTask($name);throw 'Owned task still registered'}catch{if($_.Exception.HResult -ne -2147024894 -and $_.Exception.Message -notmatch '80070002|cannot find|not found'){throw}}
  $cleanup.removed=$true
 }
 Json 'task-cleanup.json' $cleanup
}
