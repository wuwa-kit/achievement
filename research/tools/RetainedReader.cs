using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public sealed class RetainedReader:IDisposable {
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint a,bool i,int p);
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool DuplicateHandle(IntPtr s,IntPtr h,IntPtr t,out IntPtr d,uint a,bool i,uint o);
 [DllImport("kernel32.dll")] static extern uint GetProcessId(IntPtr h);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool ReadProcessMemory(IntPtr h,IntPtr a,byte[] b,UIntPtr n,out UIntPtr r);
 [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h,int c,IntPtr b,uint n,out uint r);
 public IntPtr Handle {get;private set;}
 public RetainedReader(int helper,int target) {
  IntPtr source=OpenProcess(0x440,false,helper);if(source==IntPtr.Zero)throw new Win32Exception();
  IntPtr buffer=Marshal.AllocHGlobal(1048576);
  try {
   uint needed;int status=NtQueryInformationProcess(source,51,buffer,1048576,out needed);
   if(status!=0)throw new Exception("Handle snapshot status 0x"+status.ToString("X8"));
   long count=Marshal.ReadInt64(buffer);if(count<0||count>20000)throw new Exception("Handle snapshot bound");
   for(int i=0;i<count;i++) {
    IntPtr entry=IntPtr.Add(buffer,16+i*40);uint access=unchecked((uint)Marshal.ReadInt32(entry,24));
    if((access&0x410)!=0x410)continue;
    IntPtr duplicate;
    if(!DuplicateHandle(source,Marshal.ReadIntPtr(entry),GetCurrentProcess(),out duplicate,0x410,false,0))continue;
    if(GetProcessId(duplicate)==target){Handle=duplicate;return;}
    CloseHandle(duplicate);
   }
   throw new Exception("No matching retained process handle found");
  } finally {Marshal.FreeHGlobal(buffer);CloseHandle(source);}
 }
 public byte[] Read(long address,int count) {
  if(Handle==IntPtr.Zero||address<=0||count<1||count>1048576)throw new ArgumentException();
  var bytes=new byte[count];UIntPtr read;
  if(!ReadProcessMemory(Handle,new IntPtr(address),bytes,(UIntPtr)(uint)count,out read))throw new Win32Exception(Marshal.GetLastWin32Error());
  if(read.ToUInt64()!=(ulong)count)throw new Exception("Short read");return bytes;
 }
 public void Dispose(){if(Handle!=IntPtr.Zero){CloseHandle(Handle);Handle=IntPtr.Zero;}}
}
