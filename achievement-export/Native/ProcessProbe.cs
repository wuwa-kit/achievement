using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public static class ProcessProbe
{
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadProcessMemory(IntPtr process, IntPtr address, byte[] buffer, UIntPtr size, out UIntPtr read);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("ntdll.dll")] static extern int NtQueryObject(IntPtr handle,int informationClass,IntPtr information,uint length,out uint needed);
    public static Dictionary<string,object> ReadAccess(int pid,long address)
    {
        var result=new Dictionary<string,object>();result["requestedAccess"]="0x00000410";result["address"]="0x"+address.ToString("X");
        IntPtr handle=OpenProcess(0x410,false,pid);
        if(handle==IntPtr.Zero){result["openError"]=Marshal.GetLastWin32Error();return result;}
        try {
            IntPtr info=Marshal.AllocHGlobal(256);
            try {uint needed;int status=NtQueryObject(handle,0,info,56,out needed);result["queryObjectStatus"]="0x"+status.ToString("X8");result["queryObjectRequiredLength"]=needed;if(status==0){uint access=unchecked((uint)Marshal.ReadInt32(info,4));result["grantedAccess"]="0x"+access.ToString("X8");result["vmReadGranted"]=(access&0x10)!=0;}}
            finally{Marshal.FreeHGlobal(info);}
            byte[] bytes=new byte[2];UIntPtr read;
            bool success=ReadProcessMemory(handle,new IntPtr(address),bytes,(UIntPtr)2,out read);
            int error=success?0:Marshal.GetLastWin32Error();
            result["readSucceeded"]=success;result["readError"]=error;result["bytesRead"]=read.ToUInt64();
            // Only report success, never dump arbitrary target data.
            return result;
        } finally {CloseHandle(handle);}
    }
    public static string ReadHeader(int pid, long address)
    {
        IntPtr h = OpenProcess(0x0010 | 0x0400, false, pid);
        if (h == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(), "OpenProcess QUERY_INFORMATION | VM_READ");
        try {
            byte[] bytes = new byte[2]; UIntPtr read;
            if (!ReadProcessMemory(h, new IntPtr(address), bytes, (UIntPtr)2, out read))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "ReadProcessMemory PE header");
            if (read.ToUInt64() != 2) throw new InvalidOperationException("Short read");
            return BitConverter.ToString(bytes);
        } finally { CloseHandle(h); }
    }
}
