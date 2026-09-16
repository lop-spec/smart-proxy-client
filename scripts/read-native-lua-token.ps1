param([Parameter(Mandatory=$true)][string]$OutputFile)
$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows'){throw 'Hosted Windows token capability only'}
Add-Type @'
using System;using System.ComponentModel;using System.Diagnostics;using System.Runtime.InteropServices;using System.Security.Principal;
public static class NativeLuaTokenCapability {
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool CreateRestrictedToken(IntPtr token,uint flags,uint disabled,IntPtr sids,uint deleted,IntPtr privileges,uint restricted,IntPtr restrictSids,out IntPtr result);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr data,uint length,out uint needed);
 [DllImport("advapi32.dll")]static extern IntPtr GetSidSubAuthorityCount(IntPtr sid);
 [DllImport("advapi32.dll")]static extern IntPtr GetSidSubAuthority(IntPtr sid,uint index);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 public class Info { public string sid;public bool administrator;public int elevation,elevationType,integrityRid; }
 public class Result { public bool nativeAcceptance=false,processStarted=false,parentUnchanged;public uint creationFlags=5;public Info before,reduced,after; }
 static int ReadValue(IntPtr token,int kind){uint size;GetTokenInformation(token,kind,IntPtr.Zero,0,out size);if(size==0||size>65536)throw new InvalidOperationException("Unexpected token data size");IntPtr data=Marshal.AllocHGlobal((int)size);try{if(!GetTokenInformation(token,kind,data,size,out size))throw new Win32Exception(Marshal.GetLastWin32Error());if(kind!=25)return Marshal.ReadInt32(data);IntPtr sid=Marshal.ReadIntPtr(data);return Marshal.ReadInt32(GetSidSubAuthority(sid,(uint)(Marshal.ReadByte(GetSidSubAuthorityCount(sid))-1)));}finally{Marshal.FreeHGlobal(data);}}
 static Info Read(IntPtr token){using(var id=new WindowsIdentity(token)){return new Info{sid=id.User.Value,administrator=new WindowsPrincipal(id).IsInRole(WindowsBuiltInRole.Administrator),elevation=ReadValue(token,20),elevationType=ReadValue(token,18),integrityRid=ReadValue(token,25)};}}
 public static Result Inspect(){IntPtr original=IntPtr.Zero,reduced=IntPtr.Zero;try{if(!OpenProcessToken(Process.GetCurrentProcess().Handle,10,out original))throw new Win32Exception(Marshal.GetLastWin32Error());var result=new Result{before=Read(original)};if(!CreateRestrictedToken(original,5,0,IntPtr.Zero,0,IntPtr.Zero,0,IntPtr.Zero,out reduced))throw new Win32Exception(Marshal.GetLastWin32Error());result.reduced=Read(reduced);result.after=Read(original);result.parentUnchanged=result.before.sid==result.after.sid&&result.before.administrator==result.after.administrator&&result.before.elevation==result.after.elevation&&result.before.integrityRid==result.after.integrityRid;return result;}finally{if(reduced!=IntPtr.Zero)CloseHandle(reduced);if(original!=IntPtr.Zero)CloseHandle(original);}}
}
'@
[NativeLuaTokenCapability]::Inspect()|ConvertTo-Json -Depth 5|Set-Content -LiteralPath $OutputFile -Encoding UTF8
Write-Output 'LUA token capability recorded. No process started, no existing token or system settings modified.'
