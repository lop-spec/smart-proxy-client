// Diagnostic only: the owned child is created with DEBUG_ONLY_THIS_PROCESS.
// No attachment to existing processes, privilege adjustment, memory dump or register modification.
using System;
using System.IO;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class NativeControllerDiagnostic {
    const uint CallbackRva = 0x758f5;
    static uint owner, creator;
    static ulong imageBase;
    static bool exited, initialBreakpoint;
    public class Failure { public string exceptionCode, rva, hresult, reason; public bool firstChance, controllerNull; }
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool WaitForDebugEvent(IntPtr data, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool ContinueDebugEvent(uint process, uint thread, uint status);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenThread(uint access, bool inherit, uint thread);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetThreadContext(IntPtr thread, IntPtr context);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    public static void VerifyImage(string file) {
        if(IntPtr.Size != 8) throw new InvalidOperationException("Only x64 is supported");
        // Check the exact on-disk callback prologue before interpreting RDX as HRESULT.
        byte[] signature={0x55,0x56,0x57,0x48,0x8b,0xec,0x48,0x83,0xec,0x30,0x49,0x8b,0xf8,0x48,0x8b,0xf1,0x49,0x8b,0x00,0x49,0x8b,0xc8,0xff,0x50,0x08};
        using(var r=new BinaryReader(File.OpenRead(file))) {
            r.BaseStream.Position=0x3c; uint pe=r.ReadUInt32(); r.BaseStream.Position=pe;
            if(r.ReadUInt32()!=0x4550 || r.ReadUInt16()!=0x8664) throw new InvalidOperationException("Unexpected PE architecture");
            ushort count=r.ReadUInt16(); r.BaseStream.Position=pe+20; ushort optional=r.ReadUInt16();
            if(count>64) throw new InvalidOperationException("Unexpected section count");
            for(int i=0;i<count;i++) {
                r.BaseStream.Position=pe+24+optional+i*40+8; uint size=r.ReadUInt32(), address=r.ReadUInt32(); r.ReadUInt32(); uint offset=r.ReadUInt32();
                if(CallbackRva>=address+16 && CallbackRva<address+size) {
                    r.BaseStream.Position=offset+CallbackRva-address-16;
                    foreach(byte b in signature) if(r.ReadByte()!=b) throw new InvalidOperationException("Controller callback signature changed; register interpretation refused");
                    creator=GetCurrentThreadId(); return;
                }
            }
            throw new InvalidOperationException("Controller callback RVA absent");
        }
    }
    public static void BindOwner(uint pid) { if(owner!=0 || creator!=GetCurrentThreadId()) throw new InvalidOperationException("Debugger ownership/thread mismatch"); owner=pid; }
    static uint U32(IntPtr p,int offset) { return unchecked((uint)Marshal.ReadInt32(p,offset)); }
    public static Failure[] Drain() {
        var rows=new List<Failure>(); if(exited) return rows.ToArray();
        if(owner==0 || creator!=GetCurrentThreadId()) throw new InvalidOperationException("Debugger thread/owner mismatch");
        IntPtr data=Marshal.AllocHGlobal(176);
        try {
            for(int n=0;n<256;n++) {
                if(!WaitForDebugEvent(data,0)) { int error=Marshal.GetLastWin32Error(); if(error==121) break; throw new Win32Exception(error); }
                uint kind=U32(data,0),pid=U32(data,4),tid=U32(data,8),status=0x10002;
                if(pid!=owner) throw new InvalidOperationException("Foreign debug event refused");
                try {
                    if(kind==3) imageBase=unchecked((ulong)Marshal.ReadInt64(data,40));
                    if(kind==3 || kind==6) { IntPtr file=Marshal.ReadIntPtr(data,16); if(file!=IntPtr.Zero && file!=new IntPtr(-1)) CloseHandle(file); }
                    if(kind==1) {
                        uint code=U32(data,16); bool first=U32(data,168)!=0; status=0x80010001;
                        if(code==0x80000003 && first && !initialBreakpoint) { initialBreakpoint=true; status=0x10002; }
                        if(code==0xc0000005) {
                            ulong address=unchecked((ulong)Marshal.ReadInt64(data,32));
                            var row=new Failure{exceptionCode=code.ToString("X8"),rva=(address-imageBase).ToString("X"),firstChance=first};
                            if(imageBase!=0 && address-imageBase==CallbackRva) ReadCallback(tid,row); else row.reason="Access violation is outside the verified callback; no registers interpreted";
                            rows.Add(row);
                        }
                    }
                    if(kind==5) exited=true;
                } finally {
                    // Preserve original exception handling, including a second-chance crash.
                    if(!ContinueDebugEvent(pid,tid,status)) throw new Win32Exception(Marshal.GetLastWin32Error());
                }
                if(exited) break;
            }
        } finally { Marshal.FreeHGlobal(data); }
        return rows.ToArray();
    }
    static void ReadCallback(uint tid,Failure row) {
        IntPtr thread=OpenThread(0x0008,false,tid); if(thread==IntPtr.Zero) { row.reason="Owned thread context unavailable: "+Marshal.GetLastWin32Error(); return; }
        IntPtr allocation=Marshal.AllocHGlobal(1248),context=new IntPtr((allocation.ToInt64()+15)&~15L);
        try {
            for(int i=0;i<1232;i+=4) Marshal.WriteInt32(context,i,0);
            Marshal.WriteInt32(context,48,0x100003); // AMD64 CONTEXT_CONTROL | CONTEXT_INTEGER.
            if(!GetThreadContext(thread,context)) { row.reason="GetThreadContext failed: "+Marshal.GetLastWin32Error(); return; }
            if(unchecked((ulong)Marshal.ReadInt64(context,248))-imageBase!=CallbackRva) { row.reason="Instruction pointer changed; HRESULT interpretation refused"; return; }
            row.hresult="0x"+U32(context,136).ToString("X8"); // RDX low 32 bits at the verified untouched argument prologue.
            row.controllerNull=Marshal.ReadInt64(context,184)==0; // R8, not a dereferenced pointer.
        } finally { Marshal.FreeHGlobal(allocation); CloseHandle(thread); }
    }
}
