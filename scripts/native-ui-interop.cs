using System;using System.Text;using System.Collections.Generic;using System.Runtime.InteropServices;
public static class IsolatedNative {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]public struct STARTUPINFO{public int cb;public string reserved;public string desktop;public string title;public uint x,y,xSize,ySize,xChars,yChars,fill,flags;public ushort show,reservedSize;public IntPtr reservedPtr,stdIn,stdOut,stdError;}
 [StructLayout(LayoutKind.Sequential)]public struct PROCESS_INFORMATION{public IntPtr process,thread;public uint pid,tid;}
 [StructLayout(LayoutKind.Sequential)]public struct RECT{public int left,top,right,bottom;}
 [DllImport("user32.dll",SetLastError=true,CharSet=CharSet.Unicode)]public static extern IntPtr CreateDesktopW(string name,IntPtr device,IntPtr mode,uint flags,uint access,IntPtr security);
 [DllImport("user32.dll",SetLastError=true)]public static extern bool CloseDesktop(IntPtr desktop);
 [DllImport("user32.dll")]public static extern IntPtr GetProcessWindowStation();
 [DllImport("user32.dll",SetLastError=true,CharSet=CharSet.Unicode)]public static extern bool GetUserObjectInformationW(IntPtr handle,int index,IntPtr data,uint length,out uint needed);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)]public static extern bool CreateProcessW(string app,StringBuilder args,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,uint flags,IntPtr environment,string directory,ref STARTUPINFO startup,out PROCESS_INFORMATION process);
 [DllImport("kernel32.dll",SetLastError=true)]public static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)]public static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32.dll")]public static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll")]public static extern uint WaitForSingleObject(IntPtr handle,uint timeout);
 [DllImport("kernel32.dll")]public static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)]public static extern IntPtr CreateJobObjectW(IntPtr security,string name);
 [DllImport("kernel32.dll",SetLastError=true)]public static extern bool SetInformationJobObject(IntPtr job,int kind,IntPtr information,uint length);
 [DllImport("kernel32.dll",SetLastError=true)]public static extern bool QueryInformationJobObject(IntPtr job,int kind,IntPtr information,uint length,IntPtr returned);
 [DllImport("kernel32.dll",SetLastError=true)]public static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll")]public static extern bool TerminateJobObject(IntPtr job,uint code);
 public delegate bool EnumProc(IntPtr h,IntPtr p);
 [DllImport("user32.dll",SetLastError=true)]public static extern bool EnumDesktopWindows(IntPtr desktop,EnumProc callback,IntPtr parameter);
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")]public static extern uint GetDpiForWindow(IntPtr h);
 [DllImport("user32.dll")]public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out RECT rect);
 public static string Name(IntPtr handle){var b=Marshal.AllocHGlobal(512);try{uint n;if(!GetUserObjectInformationW(handle,2,b,512,out n))throw new System.ComponentModel.Win32Exception();return Marshal.PtrToStringUni(b);}finally{Marshal.FreeHGlobal(b);}}
 public static bool Visible(IntPtr handle){var b=Marshal.AllocHGlobal(12);try{uint n;if(!GetUserObjectInformationW(handle,1,b,12,out n))throw new System.ComponentModel.Win32Exception();return (Marshal.ReadInt32(b,8)&1)!=0;}finally{Marshal.FreeHGlobal(b);}}
 public static IntPtr OwnedJob(){if(IntPtr.Size!=8)throw new Exception("64-bit helper required");var job=CreateJobObjectW(IntPtr.Zero,null);if(job==IntPtr.Zero)throw new System.ComponentModel.Win32Exception();var b=Marshal.AllocHGlobal(144);try{Marshal.Copy(new byte[144],0,b,144);Marshal.WriteInt32(b,16,0x2000);if(!SetInformationJobObject(job,9,b,144)){CloseHandle(job);throw new System.ComponentModel.Win32Exception();}return job;}finally{Marshal.FreeHGlobal(b);}}
 public static uint ActiveProcesses(IntPtr job){var b=Marshal.AllocHGlobal(48);try{if(!QueryInformationJobObject(job,1,b,48,IntPtr.Zero))throw new System.ComponentModel.Win32Exception();return (uint)Marshal.ReadInt32(b,40);}finally{Marshal.FreeHGlobal(b);}}
 public class WindowRecord{public long hwnd;public uint pid,dpi;public int width,height;}
 public static WindowRecord[] Windows(IntPtr desktop,uint owner){var list=new List<WindowRecord>();EnumProc callback=(h,p)=>{uint pid;GetWindowThreadProcessId(h,out pid);if(pid==owner){RECT r;GetWindowRect(h,out r);list.Add(new WindowRecord{hwnd=h.ToInt64(),pid=pid,dpi=GetDpiForWindow(h),width=r.right-r.left,height=r.bottom-r.top});}return true;};if(!EnumDesktopWindows(desktop,callback,IntPtr.Zero))throw new System.ComponentModel.Win32Exception();return list.ToArray();}
}
