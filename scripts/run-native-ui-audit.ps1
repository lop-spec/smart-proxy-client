param([Parameter(Mandatory=$true)][string]$Stage,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedExeSha256,[switch]$CaptureControllerFailure,[switch]$RequireNonElevated)
$ErrorActionPreference='Stop'
# Legacy PowerShell under CI may lack the Get-FileHash script command. Keep byte-for-byte verification without module-path changes.
function Sha256([string]$FilePath){$stream=[IO.File]::OpenRead($FilePath);$algorithm=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$algorithm.Dispose();$stream.Dispose()}}
if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows'){throw 'Native CI audit requires a hosted Windows workflow'}
$stage=[IO.Path]::GetFullPath($Stage);$temp=[IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd([char[]]'\/')+[IO.Path]::DirectorySeparatorChar
if(-not $stage.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase)){throw 'Only a fresh owned RUNNER_TEMP stage is permitted'}
if($env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -or $env:WEBVIEW2_BROWSER_EXECUTABLE_FOLDER){throw 'Inherited WebView2 overrides refused'}
$manifest=Get-Content -LiteralPath (Join-Path $stage 'manifest.json') -Raw -Encoding UTF8|ConvertFrom-Json
foreach($file in $manifest.files){$p=[IO.Path]::GetFullPath((Join-Path $stage $file.path));if(-not $p.StartsWith($stage+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Sha256 $p) -ne $file.sha256){throw ('Stage identity mismatch: '+$file.path)}}
$reportFile=Join-Path $stage 'output/host.json'
$log=Join-Path $stage 'output/host.log'
if(Test-Path -LiteralPath $reportFile){throw 'Native report already exists'}
function Progress($message){([DateTime]::UtcNow.ToString('o')+' '+$message)|Add-Content -LiteralPath $log -Encoding UTF8}
function DrainOwnedDebugEvents(){foreach($sample in @([NativeControllerDiagnostic]::Drain())){$result.controllerFailures+=$sample;Progress ('Owned exception='+$sample.exceptionCode+' RVA='+$sample.rva+' HRESULT='+$sample.hresult+' reason='+$sample.reason)}}
$previousDpi=[IntPtr]::Zero;$desktop=[IntPtr]::Zero;$job=[IntPtr]::Zero;$original=[IntPtr]::Zero;$envBlock=[IntPtr]::Zero;$pi=$null;$result=@{ok=$false;switchDesktopCalled=$false;productionInstalled=$false;requestedContentScale='system';systemSettingsChanged=$false;isolationMode='desktop'}
$result.privateFileGuard='No production state is staged on the hosted runner'
$result.diagnosticOnly=[bool]$CaptureControllerFailure;$result.debuggerAttached=$false;$result.controllerFailures=@()
try {
 $result.helperIsAdministrator=([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
 if($RequireNonElevated -and $result.helperIsAdministrator){throw 'Native helper is elevated; Limited execution precondition failed'}
 Add-Type -Path (Join-Path $PSScriptRoot 'native-ui-interop.cs')
 $previousDpi=[IsolatedNative]::SetThreadDpiAwarenessContext([IntPtr](-4));if($previousDpi -eq [IntPtr]::Zero){throw 'Cannot select thread-only per-monitor v2 awareness'}
 $exe=Join-Path $stage 'smart-proxy-audit.exe'
 if((Sha256 $exe) -ne $ExpectedExeSha256){throw 'Candidate executable identity changed'}
 $creationFlags=[uint32]0x08000404
 if($CaptureControllerFailure){Add-Type -Path (Join-Path $PSScriptRoot 'native-controller-diagnostic.cs');[NativeControllerDiagnostic]::VerifyImage($exe);$result.controllerSignatureVerified=$true;$creationFlags=$creationFlags -bor 2}
 $original=[IsolatedNative]::GetProcessWindowStation();$result.originalStation=[IsolatedNative]::Name($original)
 $name='WinSta0'
 $desktopName='SmartProxy-Audit-'+[guid]::NewGuid().ToString('N')
 if($result.originalStation -ne 'WinSta0' -or [Diagnostics.Process]::GetCurrentProcess().SessionId -eq 0){throw 'Existing interactive session required; no station or desktop switch will occur'}
 # CreateDesktop does not make the new desktop active. No SwitchDesktop entry point exists in this helper.
 $desktop=[IsolatedNative]::CreateDesktopW($desktopName,[IntPtr]::Zero,[IntPtr]::Zero,0,199,[IntPtr]::Zero)
 if($desktop -eq [IntPtr]::Zero){throw ('CreateDesktop failed '+[Runtime.InteropServices.Marshal]::GetLastWin32Error())}
 $result.station=[IsolatedNative]::Name([IsolatedNative]::GetProcessWindowStation());$result.stationVisible=[IsolatedNative]::Visible([IsolatedNative]::GetProcessWindowStation());$result.desktop=[IsolatedNative]::Name($desktop)
 if($result.station -ne $name -or $result.desktop -ne $desktopName){throw 'Isolation precondition failed'}
 $environment=[Environment]::GetEnvironmentVariables();$environment['APPDATA']=Join-Path $stage 'appdata';$environment['LOCALAPPDATA']=Join-Path $stage 'localappdata';$environment['WEBVIEW2_USER_DATA_FOLDER']=Join-Path $stage 'appdata/webview';$environment['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS']='--disable-background-networking --enable-logging';
 $envText=(($environment.Keys|Sort-Object|ForEach-Object{$_+'='+$environment[$_]}) -join [char]0)+[char]0+[char]0
 $envBlock=[Runtime.InteropServices.Marshal]::StringToHGlobalUni($envText)
 $si=New-Object IsolatedNative+STARTUPINFO;$si.cb=[Runtime.InteropServices.Marshal]::SizeOf($si);$si.desktop=$name+'\'+$desktopName;$si.flags=1;$si.show=4
 $pi=New-Object IsolatedNative+PROCESS_INFORMATION
 # Neutralino config-file is a resource path, not a Windows filesystem path.
 $args=New-Object Text.StringBuilder('"'+$exe+'" --path="'+$stage.Replace('\','/')+'" --res-mode=directory --config-file=/neutralino.config.json')
 $job=[IsolatedNative]::OwnedJob()
 if(-not [IsolatedNative]::CreateProcessW($exe,$args,[IntPtr]::Zero,[IntPtr]::Zero,$false,$creationFlags,$envBlock,$stage,[ref]$si,[ref]$pi)){throw ('CreateProcess failed '+[Runtime.InteropServices.Marshal]::GetLastWin32Error())}
 $result.ownedPid=$pi.pid
 if($CaptureControllerFailure){[NativeControllerDiagnostic]::BindOwner($pi.pid);$result.debuggerAttached=$true;Progress 'Controller-only diagnostic: window/layout enumeration is intentionally not performed or accepted'}
 if(-not [IsolatedNative]::AssignProcessToJobObject($job,$pi.process)){[void][IsolatedNative]::TerminateProcess($pi.process,240);throw ('AssignProcessToJobObject failed '+[Runtime.InteropServices.Marshal]::GetLastWin32Error())}
 if([IsolatedNative]::ResumeThread($pi.thread) -eq [uint32]::MaxValue){throw 'ResumeThread failed'}
 Progress ('Owned native process '+$pi.pid+' resumed only in inactive desktop '+$name+'\'+$desktopName)
 $timer=[Diagnostics.Stopwatch]::StartNew();$lastLog=-10;$result.windows=@()
 while([IsolatedNative]::WaitForSingleObject($pi.process,0) -ne 0){
  if($result.debuggerAttached){DrainOwnedDebugEvents}
  if($timer.Elapsed.TotalSeconds -gt 150){throw 'Native smoke exceeded 150 seconds'}
  $windows=@();if(-not $result.debuggerAttached){$windows=[IsolatedNative]::Windows($desktop,$pi.pid);if($windows.Count -gt 0){$result.windows=$windows}}
  if($timer.Elapsed.TotalSeconds-$lastLog -ge 5){Progress ('elapsed='+[math]::Round($timer.Elapsed.TotalSeconds)+'s ownedProcesses='+[IsolatedNative]::ActiveProcesses($job)+' windows='+$windows.Count);$lastLog=$timer.Elapsed.TotalSeconds}
  Start-Sleep -Milliseconds 200
 }
 $code=0;[void][IsolatedNative]::GetExitCodeProcess($pi.process,[ref]$code);$result.exitCode=$code;$result.wallMs=$timer.ElapsedMilliseconds
 $result.auditCompleted=($code -eq 0 -and (Test-Path -LiteralPath (Join-Path $stage 'output/done.json')))
 $result.ok=($result.auditCompleted -and (Get-Content -LiteralPath (Join-Path $stage 'output/done.json') -Raw -Encoding UTF8|ConvertFrom-Json).ok)
 if(-not $result.ok){throw ('Native audit execution or DOM gate failed, exitCode='+$code)}
}catch{$result.error=$_.Exception.Message;Progress ('ERROR '+$result.error)}finally{
 if($job -ne [IntPtr]::Zero){[void][IsolatedNative]::TerminateJobObject($job,240);for($i=0;$i -lt 50 -and [IsolatedNative]::ActiveProcesses($job) -gt 0;$i++){if($result.debuggerAttached){try{DrainOwnedDebugEvents}catch{$result.ok=$false;Progress ('Owned debugger cleanup failed: '+$_.Exception.Message)}};Start-Sleep -Milliseconds 100};$result.ownedProcessesRemaining=[IsolatedNative]::ActiveProcesses($job);[void][IsolatedNative]::CloseHandle($job)}
 if($pi){if($pi.process -ne [IntPtr]::Zero){[void][IsolatedNative]::CloseHandle($pi.process)};if($pi.thread -ne [IntPtr]::Zero){[void][IsolatedNative]::CloseHandle($pi.thread)}}
 if($envBlock -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::FreeHGlobal($envBlock)}
 if($desktop -ne [IntPtr]::Zero){[void][IsolatedNative]::CloseDesktop($desktop)}
 if($original -ne [IntPtr]::Zero){$result.helperStationUnchanged=([IsolatedNative]::GetProcessWindowStation() -eq $original)}
 if($previousDpi -ne [IntPtr]::Zero){$result.threadDpiRestored=([IsolatedNative]::SetThreadDpiAwarenessContext($previousDpi) -ne [IntPtr]::Zero)}
 if($result.ownedProcessesRemaining -ne 0 -or -not $result.helperStationUnchanged -or -not $result.threadDpiRestored){$result.ok=$false;Progress 'Native cleanup or unchanged-station/thread-DPI gate failed'}
 $result|ConvertTo-Json -Depth 7|Set-Content -LiteralPath $reportFile -Encoding UTF8
 Progress ('Finished: ok='+$result.ok)
}
if(-not $result.ok){exit 1}
