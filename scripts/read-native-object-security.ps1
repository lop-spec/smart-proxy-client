param([Parameter(Mandatory=$true)][string]$OutputFile)
$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows'){throw 'Hosted Windows read-only security diagnosis required'}
Add-Type @'
using System;using System.ComponentModel;using System.Runtime.InteropServices;
public static class NativeObjectSecurity {
 [DllImport("user32.dll")]static extern IntPtr GetProcessWindowStation();
 [DllImport("user32.dll")]static extern IntPtr GetThreadDesktop(uint thread);
 [DllImport("kernel32.dll")]static extern uint GetCurrentThreadId();
 [DllImport("user32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern bool GetUserObjectInformationW(IntPtr handle,int index,IntPtr buffer,uint length,out uint needed);
 [DllImport("user32.dll",SetLastError=true)]static extern bool GetUserObjectSecurity(IntPtr handle,ref uint information,IntPtr buffer,uint length,out uint needed);
 [DllImport("advapi32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern bool ConvertSecurityDescriptorToStringSecurityDescriptorW(IntPtr descriptor,uint revision,uint information,out IntPtr text,out uint length);
 [DllImport("kernel32.dll")]static extern IntPtr LocalFree(IntPtr value);
 public class Row {public string kind,name,sddl,error;}
 static void Check(bool ok,string operation){if(!ok){int error=Marshal.GetLastWin32Error();throw new Win32Exception(error,operation+" (Win32 "+error+")");}}
 static Row Read(IntPtr handle,string kind){var row=new Row{kind=kind};IntPtr name=Marshal.AllocHGlobal(1024),descriptor=IntPtr.Zero,text=IntPtr.Zero;try{uint needed;Check(GetUserObjectInformationW(handle,2,name,1024,out needed),"Read object name");row.name=Marshal.PtrToStringUni(name);uint information=0x17;GetUserObjectSecurity(handle,ref information,IntPtr.Zero,0,out needed);if(needed==0||needed>65536)throw new InvalidOperationException("Security descriptor size unavailable or out of bound");descriptor=Marshal.AllocHGlobal((int)needed);Check(GetUserObjectSecurity(handle,ref information,descriptor,needed,out needed),"Read object security");Check(ConvertSecurityDescriptorToStringSecurityDescriptorW(descriptor,1,information,out text,out needed),"Read SDDL");row.sddl=Marshal.PtrToStringUni(text);}catch(Exception error){row.error=error.Message;}finally{Marshal.FreeHGlobal(name);if(descriptor!=IntPtr.Zero)Marshal.FreeHGlobal(descriptor);if(text!=IntPtr.Zero)LocalFree(text);}return row;}
 public static Row[] Inspect(){return new[]{Read(GetProcessWindowStation(),"windowStation"),Read(GetThreadDesktop(GetCurrentThreadId()),"threadDesktop")};}
}
'@
$rows=[NativeObjectSecurity]::Inspect()
@{readOnly=$true;nativeAcceptance=$false;processStarted=$false;systemSettingsChanged=$false;objects=$rows}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath $OutputFile -Encoding UTF8
if(@($rows|Where-Object error).Count){throw 'Security descriptor read failed; see retained per-object errors'}
Write-Output 'Existing station/desktop security read only; no launch or permission change performed.'
