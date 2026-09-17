using System;using System.Text;using System.ComponentModel;using System.Diagnostics;using System.Runtime.InteropServices;using System.Security.Principal;
// Same-user token reduction only. All desktop security applies at creation of a new GUID-owned object.
public sealed class NativeLuaChild : IDisposable {
 [StructLayout(LayoutKind.Sequential)]struct SidAttributes{public IntPtr sid;public uint attributes;}
 [StructLayout(LayoutKind.Sequential)]struct SecurityAttributes{public int length;public IntPtr descriptor;public int inherit;}
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool CreateRestrictedToken(IntPtr token,uint flags,uint disabled,IntPtr sids,uint deleted,IntPtr privileges,uint restricted,IntPtr restrictSids,out IntPtr result);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr data,uint length,out uint needed);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool SetTokenInformation(IntPtr token,int kind,ref SidAttributes data,uint length);
 [DllImport("advapi32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern bool ConvertStringSidToSidW(string sid,out IntPtr value);
 [DllImport("advapi32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern bool ConvertStringSecurityDescriptorToSecurityDescriptorW(string text,uint revision,out IntPtr value,out uint size);
 [DllImport("advapi32.dll")]static extern uint GetLengthSid(IntPtr sid);
 [DllImport("advapi32.dll")]static extern IntPtr GetSidSubAuthorityCount(IntPtr sid);
 [DllImport("advapi32.dll")]static extern IntPtr GetSidSubAuthority(IntPtr sid,uint index);
 [DllImport("advapi32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern bool CreateProcessAsUserW(IntPtr token,string app,StringBuilder args,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,uint flags,IntPtr environment,string directory,ref IsolatedNative.STARTUPINFO startup,out IsolatedNative.PROCESS_INFORMATION process);
 [DllImport("userenv.dll",SetLastError=true)]static extern bool CreateEnvironmentBlock(out IntPtr block,IntPtr token,bool inherit);
 [DllImport("userenv.dll")]static extern bool DestroyEnvironmentBlock(IntPtr block);
 [DllImport("kernel32.dll")]static extern IntPtr LocalFree(IntPtr value);
 IntPtr job,desktop;IsolatedNative.PROCESS_INFORMATION process;bool disposed;
 public string desktopName;public uint pid,remaining;public bool parentUnchanged;public Facts before,reduced,after;
 public class Facts {public string sid;public bool administrator;public int elevation,integrityRid,session;}
 static void Check(bool value,string operation){if(!value)throw new Win32Exception(Marshal.GetLastWin32Error(),operation);}
 static int Value(IntPtr token,int kind){uint size;GetTokenInformation(token,kind,IntPtr.Zero,0,out size);if(size==0||size>65536)throw new InvalidOperationException("Invalid token data size");var data=Marshal.AllocHGlobal((int)size);try{Check(GetTokenInformation(token,kind,data,size,out size),"Read token");if(kind!=25)return Marshal.ReadInt32(data);var sid=Marshal.ReadIntPtr(data);return Marshal.ReadInt32(GetSidSubAuthority(sid,(uint)(Marshal.ReadByte(GetSidSubAuthorityCount(sid))-1)));}finally{Marshal.FreeHGlobal(data);}}
 static Facts Read(IntPtr token){using(var id=new WindowsIdentity(token)){return new Facts{sid=id.User.Value,administrator=new WindowsPrincipal(id).IsInRole(WindowsBuiltInRole.Administrator),elevation=Value(token,20),integrityRid=Value(token,25),session=Value(token,12)};}}
 public static NativeLuaChild Start(string app,string args,string directory){
  var child=new NativeLuaChild();IntPtr original=IntPtr.Zero,token=IntPtr.Zero,sid=IntPtr.Zero,descriptor=IntPtr.Zero,security=IntPtr.Zero,environment=IntPtr.Zero;
  try{
   if(IsolatedNative.Name(IsolatedNative.GetProcessWindowStation())!="WinSta0"||Process.GetCurrentProcess().SessionId==0)throw new InvalidOperationException("Existing interactive station required");
   Check(OpenProcessToken(Process.GetCurrentProcess().Handle,10,out original),"Open caller token");child.before=Read(original);
   Check(CreateRestrictedToken(original,5,0,IntPtr.Zero,0,IntPtr.Zero,0,IntPtr.Zero,out token),"Create LUA token without sandbox exemptions");
   Check(ConvertStringSidToSidW("S-1-16-8192",out sid),"Medium integrity SID");var label=new SidAttributes{sid=sid,attributes=0x20};
   Check(SetTokenInformation(token,25,ref label,(uint)Marshal.SizeOf(label)+GetLengthSid(sid)),"Lower only cloned token integrity");
   child.reduced=Read(token);child.after=Read(original);
   child.parentUnchanged=child.before.sid==child.after.sid&&child.before.administrator==child.after.administrator&&child.before.elevation==child.after.elevation&&child.before.integrityRid==child.after.integrityRid;
   if(!child.parentUnchanged||child.reduced.sid!=child.before.sid||child.reduced.administrator||child.reduced.elevation!=0||child.reduced.integrityRid!=8192||child.reduced.session!=child.before.session)throw new InvalidOperationException("Exact same-user Medium/non-elevated token precondition failed");
   uint descriptorSize;Check(ConvertStringSecurityDescriptorToSecurityDescriptorW("D:P(A;;GA;;;SY)(A;;GA;;;"+child.reduced.sid+")S:(ML;;NW;;;ME)",1,out descriptor,out descriptorSize),"New owned desktop descriptor");
   var attributes=new SecurityAttributes{length=Marshal.SizeOf(typeof(SecurityAttributes)),descriptor=descriptor,inherit=0};security=Marshal.AllocHGlobal(attributes.length);Marshal.StructureToPtr(attributes,security,false);
   child.desktopName="SmartProxy-Lua-"+Guid.NewGuid().ToString("N");child.desktop=IsolatedNative.CreateDesktopW(child.desktopName,IntPtr.Zero,IntPtr.Zero,0,199,security);Check(child.desktop!=IntPtr.Zero,"Create new inactive Medium desktop");
   Check(CreateEnvironmentBlock(out environment,token,false),"Same-user environment without caller environment inheritance");
   child.job=IsolatedNative.OwnedJob();var startup=new IsolatedNative.STARTUPINFO{cb=Marshal.SizeOf(typeof(IsolatedNative.STARTUPINFO)),desktop="WinSta0\\"+child.desktopName,flags=1,show=0};
   Check(CreateProcessAsUserW(token,app,new StringBuilder("\""+app+"\" "+args),IntPtr.Zero,IntPtr.Zero,false,0x08000404,environment,directory,ref startup,out child.process),"Create owned hidden suspended LUA wrapper");child.pid=child.process.pid;
   if(!IsolatedNative.AssignProcessToJobObject(child.job,child.process.process)){var error=Marshal.GetLastWin32Error();IsolatedNative.TerminateProcess(child.process.process,240);IsolatedNative.WaitForSingleObject(child.process.process,5000);throw new Win32Exception(error,"Assign owned wrapper job");}
   Check(IsolatedNative.ResumeThread(child.process.thread)!=uint.MaxValue,"Resume owned wrapper");return child;
  }catch{child.Dispose();throw;}finally{if(environment!=IntPtr.Zero)DestroyEnvironmentBlock(environment);if(security!=IntPtr.Zero)Marshal.FreeHGlobal(security);if(descriptor!=IntPtr.Zero)LocalFree(descriptor);if(sid!=IntPtr.Zero)LocalFree(sid);if(token!=IntPtr.Zero)IsolatedNative.CloseHandle(token);if(original!=IntPtr.Zero)IsolatedNative.CloseHandle(original);}
 }
 public bool Exited(){return IsolatedNative.WaitForSingleObject(process.process,0)==0;}
 public uint ExitCode(){uint code;Check(IsolatedNative.GetExitCodeProcess(process.process,out code),"Read owned wrapper exit");return code;}
 public void Dispose(){if(disposed)return;disposed=true;try{if(job!=IntPtr.Zero){Check(IsolatedNative.TerminateJobObject(job,240),"Stop owned wrapper job");for(int i=0;i<50&&IsolatedNative.ActiveProcesses(job)>0;i++)System.Threading.Thread.Sleep(100);remaining=IsolatedNative.ActiveProcesses(job);}}finally{if(job!=IntPtr.Zero)IsolatedNative.CloseHandle(job);if(process.thread!=IntPtr.Zero)IsolatedNative.CloseHandle(process.thread);if(process.process!=IntPtr.Zero)IsolatedNative.CloseHandle(process.process);if(desktop!=IntPtr.Zero)IsolatedNative.CloseDesktop(desktop);}}
}
