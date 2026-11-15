using System;
using System.Text;
using System.IO;
using System.ComponentModel;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public sealed class StartupProcess : IDisposable
{
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct StartupInfo {
        public uint cb; public string reserved,desktop,title; public uint x,y,width,height,xChars,yChars,fill,flags;
        public ushort showWindow,reserved2Size; public IntPtr reserved2,input,output,error;
    }
    [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {public IntPtr process,thread;public uint pid,tid;}
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcessW(string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref StartupInfo si,out ProcessInfo pi);
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool ReadProcessMemory(IntPtr process,IntPtr address,byte[] data,UIntPtr length,out UIntPtr read);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr handle,uint code);
    private delegate bool EnumWindowsCallback(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr window, uint command);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("ntdll.dll")] static extern int NtQueryObject(IntPtr handle,int cls,IntPtr info,uint size,out uint needed);
    [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr handle,int cls,IntPtr info,uint size,out uint needed);
    ProcessInfo process; bool resumed,disposed;
    public uint Id {get{return process.pid;}}
    public IntPtr Handle {get{return process.process;}}
    public bool HasExited {get{return WaitForSingleObject(process.process,0)==0;}}
    public long ImageBase {get;private set;}
    public string ImageBaseSource {get;private set;}
    public bool HasVisibleMainWindow()
    {
        if (HasExited) return false;
        const uint owner = 4; // GW_OWNER
        bool found = false;
        EnumWindows((window, _) =>
        {
            GetWindowThreadProcessId(window, out uint pid);
            if (pid != Id || GetWindow(window, owner) != IntPtr.Zero || !IsWindowVisible(window))
                return true;
            found = true;
            return false;
        }, IntPtr.Zero);
        return found && !HasExited;
    }
    public StartupProcess(string exe,string quality)
    {
        exe=Path.GetFullPath(exe);
        if(!File.Exists(exe)||exe.IndexOf('"')>=0)throw new ArgumentException("Invalid executable");
        if(quality!="sd"&&quality!="hd"&&quality!="uhd")throw new ArgumentException("Invalid resource quality");
        var si=new StartupInfo();si.cb=(uint)Marshal.SizeOf(typeof(StartupInfo));
        if(!CreateProcessW(exe,new StringBuilder("\""+exe+"\" -krqlv="+quality),IntPtr.Zero,IntPtr.Zero,false,4,IntPtr.Zero,Path.GetDirectoryName(exe) ?? Environment.CurrentDirectory,ref si,out process))
            throw new Win32Exception(Marshal.GetLastWin32Error(),"CreateProcessW CREATE_SUSPENDED");
        ImageBase=0x140000000;ImageBaseSource="PE preferred base fallback";
        try {
            using(var r=new BinaryReader(File.OpenRead(exe))){r.BaseStream.Position=0x3c;int pe=r.ReadInt32();r.BaseStream.Position=pe+24+24;ImageBase=r.ReadInt64();}
            IntPtr info=Marshal.AllocHGlobal(48);
            try {uint needed;if(NtQueryInformationProcess(process.process,0,info,48,out needed)==0){long peb=Marshal.ReadIntPtr(info,8).ToInt64();byte[] bytes=Read(peb+16,8);ImageBase=BitConverter.ToInt64(bytes,0);ImageBaseSource="PEB.ImageBaseAddress";}}
            finally{Marshal.FreeHGlobal(info);}
        } catch { /* Probe will report missing read permission; always allow resume. */ }
    }
    public void Resume()
    {
        if(resumed)return;
        if(ResumeThread(process.thread)==uint.MaxValue)throw new Win32Exception(Marshal.GetLastWin32Error(),"ResumeThread");
        resumed=true;CloseHandle(process.thread);process.thread=IntPtr.Zero;
    }
    public byte[] Read(long address,int count)
    {
        if(disposed||HasExited)throw new InvalidOperationException("Target exited or session closed");
        if(address<=0||count<1||count>65536)throw new ArgumentOutOfRangeException();
        byte[] bytes=new byte[count];UIntPtr read;
        if(!ReadProcessMemory(process.process,new IntPtr(address),bytes,(UIntPtr)(uint)count,out read))throw new Win32Exception(Marshal.GetLastWin32Error());
        if(read.ToUInt64()!=(ulong)count)throw new IOException("Short process read");return bytes;
    }
    public Dictionary<string,object> Probe()
    {
        var result=new Dictionary<string,object>();result["pid"]=Id;result["at"]=DateTimeOffset.Now.ToString("o");result["resumed"]=resumed;result["exited"]=HasExited;
        IntPtr info=Marshal.AllocHGlobal(56);
        try {uint needed;int status=NtQueryObject(process.process,0,info,56,out needed);result["queryStatus"]="0x"+status.ToString("X8");if(status==0){uint mask=unchecked((uint)Marshal.ReadInt32(info,4));result["grantedAccess"]="0x"+mask.ToString("X8");result["vmReadGranted"]=(mask&16)!=0;result["vmWriteGranted"]=(mask&32)!=0;result["createThreadGranted"]=(mask&2)!=0;}}
        finally{Marshal.FreeHGlobal(info);}
        result["imageBase"]="0x"+ImageBase.ToString("X");result["imageBaseSource"]=ImageBaseSource;
        try {byte[] bytes=Read(ImageBase,2);result["header"]=BitConverter.ToString(bytes);result["readSucceeded"]=bytes[0]==77&&bytes[1]==90;}
        catch(Exception ex){result["readSucceeded"]=false;result["readError"]=ex.Message;if(ex is Win32Exception)result["nativeErrorCode"]=((Win32Exception)ex).NativeErrorCode;}
        return result;
    }
    public void Dispose()
    {
        if(disposed)return;
        try {if(!resumed&&!HasExited){try{Resume();}catch{TerminateProcess(process.process,1);}}}
        finally{if(process.thread!=IntPtr.Zero)CloseHandle(process.thread);CloseHandle(process.process);disposed=true;}
    }
    public void CloseOwnedGame()
    {
        if(disposed)throw new ObjectDisposedException("StartupProcess");
        if (!HasExited && !TerminateProcess(process.process, 0))
        {
            int error = Marshal.GetLastWin32Error();
            if (!HasExited) throw new Win32Exception(error, "Close owned game");
        }
        if(WaitForSingleObject(process.process,10000)!=0)throw new TimeoutException("Owned game did not exit");
    }
}
