using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class OwnedProcessCloser {
 [DllImport("kernel32.dll")] static extern uint GetProcessId(IntPtr h);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr h,uint code);
 [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h,uint ms);
 public static void Close(IntPtr handle,uint expectedPid){
  if(expectedPid==0||GetProcessId(handle)!=expectedPid)throw new InvalidOperationException("Owned handle identity mismatch");
  if(WaitForSingleObject(handle,0)==0)return;
  if(!TerminateProcess(handle,0))throw new Win32Exception(Marshal.GetLastWin32Error());
  if(WaitForSingleObject(handle,10000)!=0)throw new TimeoutException("Owned game did not exit");
 }
}
