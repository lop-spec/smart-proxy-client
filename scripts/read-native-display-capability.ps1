param([string]$OutputPath)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding
if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows'){throw 'This read-only capability probe requires a Windows GitHub Actions job'}
if(-not $OutputPath){$OutputPath=Join-Path $PSScriptRoot 'native-display-capability.json'}
if(Test-Path -LiteralPath $OutputPath){throw 'Display inventory already exists'}
$result=@{machine=$env:COMPUTERNAME;session=[Diagnostics.Process]::GetCurrentProcess().SessionId;systemSettingsChanged=$false;visibleWindowsCreated=$false;purpose='Existing monitor capability only, not UI acceptance';nativeAcceptance=$false;eligible=$false;reasons=@();webviewVersions=@();browserOverrides=@();monitors=@();ok=$false};$api=$null;$previous=[IntPtr]::Zero;$buffers=@();$exitCode=1
try{
 $runtimeRoots=@((Join-Path ${env:ProgramFiles(x86)} 'Microsoft/EdgeWebView/Application'),(Join-Path $env:ProgramFiles 'Microsoft/EdgeWebView/Application'),(Join-Path $env:LOCALAPPDATA 'Microsoft/EdgeWebView/Application'))
 foreach($root in $runtimeRoots){if(Test-Path -LiteralPath $root){$result.webviewVersions+=@(Get-ChildItem -LiteralPath $root -Directory|Where-Object{$_.Name -match '^\d+\.\d+\.\d+\.\d+$'}|ForEach-Object Name)}}
 $result.webviewVersions=@($result.webviewVersions|Sort-Object -Unique)
 foreach($name in @('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS','WEBVIEW2_BROWSER_EXECUTABLE_FOLDER')){if([Environment]::GetEnvironmentVariable($name)){$result.browserOverrides+= $name}}
 $assembly=[AppDomain]::CurrentDomain.DefineDynamicAssembly((New-Object Reflection.AssemblyName('OwnedDisplayInventory')),[Reflection.Emit.AssemblyBuilderAccess]::Run);$module=$assembly.DefineDynamicModule('OwnedDisplayInventory');$builder=$module.DefineType('OwnedDisplayInventory',[Reflection.TypeAttributes]::Public)
 function Import([string]$name,[Type]$return,[Type[]]$parameters){$m=$builder.DefinePInvokeMethod($name,'user32.dll',[Reflection.MethodAttributes]'Public,Static,PinvokeImpl',[Reflection.CallingConventions]::Standard,$return,$parameters,[Runtime.InteropServices.CallingConvention]::Winapi,[Runtime.InteropServices.CharSet]::Unicode);$m.SetImplementationFlags([Reflection.MethodImplAttributes]::PreserveSig)}
 $delegate=$module.DefineType('OwnedMonitorCallback',[Reflection.TypeAttributes]'Public,Sealed',[MulticastDelegate]);$ctor=$delegate.DefineConstructor([Reflection.MethodAttributes]'Public,HideBySig,RTSpecialName',[Reflection.CallingConventions]::Standard,@([object],[IntPtr]));$ctor.SetImplementationFlags([Reflection.MethodImplAttributes]'Runtime,Managed');$invoke=$delegate.DefineMethod('Invoke',[Reflection.MethodAttributes]'Public,HideBySig,NewSlot,Virtual',[bool],@([IntPtr],[IntPtr],[IntPtr],[IntPtr]));$invoke.SetImplementationFlags([Reflection.MethodImplAttributes]'Runtime,Managed');$callbackType=$delegate.CreateType()
 Import 'GetProcessWindowStation' ([IntPtr]) @();Import 'GetUserObjectInformationW' ([bool]) @([IntPtr],[int],[IntPtr],[uint32],[uint32].MakeByRefType())
 Import 'SetThreadDpiAwarenessContext' ([IntPtr]) @([IntPtr]);Import 'EnumDisplayMonitors' ([bool]) @([IntPtr],[IntPtr],$callbackType,[IntPtr]);Import 'GetMonitorInfoW' ([bool]) @([IntPtr],[IntPtr])
 Import 'CreateWindowExW' ([IntPtr]) @([uint32],[string],[string],[uint32],[int],[int],[int],[int],[IntPtr],[IntPtr],[IntPtr],[IntPtr]);Import 'DestroyWindow' ([bool]) @([IntPtr]);Import 'GetDpiForWindow' ([uint32]) @([IntPtr])
 $api=$builder.CreateType();$buffer=[Runtime.InteropServices.Marshal]::AllocHGlobal(512);$buffers+= $buffer;[uint32]$length=0
 if(-not $api::GetUserObjectInformationW($api::GetProcessWindowStation(),2,$buffer,512,[ref]$length)){throw 'Cannot read current window station'};$result.station=[Runtime.InteropServices.Marshal]::PtrToStringUni($buffer)
 if($result.session -eq 0 -or $result.station -ne 'WinSta0'){$result.ok=$true;$exitCode=0;$result.reasons+= 'Interactive session and WinSta0 are absent; no desktop or station switch will occur';Write-Warning ('Native capability unavailable: '+($result.reasons -join '; '));return}
 $previous=$api::SetThreadDpiAwarenessContext([IntPtr](-4));if($previous -eq [IntPtr]::Zero){throw 'Cannot select thread-only per-monitor v2 awareness'}
 $info=[Runtime.InteropServices.Marshal]::AllocHGlobal(104);$buffers+=$info;$rows=New-Object 'Collections.Generic.List[object]';$failures=New-Object 'Collections.Generic.List[string]'
 $callback=[OwnedMonitorCallback]{param([IntPtr]$monitor,[IntPtr]$dc,[IntPtr]$rect,[IntPtr]$unused)
  [Runtime.InteropServices.Marshal]::WriteInt32($info,104);if(-not $api::GetMonitorInfoW($monitor,$info)){$failures.Add('GetMonitorInfo failed');return $false}
  $left=[Runtime.InteropServices.Marshal]::ReadInt32($info,4);$top=[Runtime.InteropServices.Marshal]::ReadInt32($info,8);$right=[Runtime.InteropServices.Marshal]::ReadInt32($info,12);$bottom=[Runtime.InteropServices.Marshal]::ReadInt32($info,16)
  $x=$left+[int](($right-$left)/2);$y=$top+[int](($bottom-$top)/2)
  # No WS_VISIBLE, no ShowWindow, no foreground operation. Destroy only this returned handle.
  $window=$api::CreateWindowExW(0x08000080,'STATIC','Owned hidden DPI inventory',2147483648,$x,$y,1,1,[IntPtr]::Zero,[IntPtr]::Zero,[IntPtr]::Zero,[IntPtr]::Zero)
  if($window -eq [IntPtr]::Zero){$failures.Add('Cannot create the invisible owned probe window');return $false}
  try{$dpi=$api::GetDpiForWindow($window);$rows.Add(@{display=[Runtime.InteropServices.Marshal]::PtrToStringUni([IntPtr]::Add($info,40));dpi=$dpi;percent=100*$dpi/96;bounds=@($left,$top,$right,$bottom)})}finally{if(-not $api::DestroyWindow($window)){$failures.Add('Owned invisible window cleanup failed')}}
  return $true
 }
 if(-not $api::EnumDisplayMonitors([IntPtr]::Zero,[IntPtr]::Zero,$callback,[IntPtr]::Zero) -or $failures.Count){throw ('Display enumeration failed: '+($failures -join '; '))}
 $result.monitors=@($rows.ToArray());if(-not $result.monitors.Count){throw 'No current monitor found'};$result.ok=$true;$exitCode=0
 if(-not $result.webviewVersions.Count){$result.reasons+='No installed WebView2 runtime was found; nothing will be installed'}
 if($result.browserOverrides.Count){$result.reasons+='Inherited WebView2 browser overrides require separate review; values are not collected'}
 $result.eligible=($result.reasons.Count -eq 0)
 if(-not $result.eligible){Write-Warning ('Native capability unavailable: '+($result.reasons -join '; '))}else{Write-Host 'Existing native capability found; this is not UI acceptance and launches no application'}
}catch{$result.error=$_.Exception.Message;Write-Warning ('Native capability collection failed: '+$result.error)}finally{if($api -and $previous -ne [IntPtr]::Zero){[void]$api::SetThreadDpiAwarenessContext($previous)};foreach($p in $buffers){[Runtime.InteropServices.Marshal]::FreeHGlobal($p)};$result|ConvertTo-Json -Depth 5|Set-Content -LiteralPath $OutputPath -Encoding UTF8}
$result|ConvertTo-Json -Depth 5
exit $exitCode
