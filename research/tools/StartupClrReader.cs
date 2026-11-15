using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using Microsoft.Diagnostics.Runtime;
using System.Text;
public sealed class StartupClrReader : IDataReader {
 readonly IntPtr handle; readonly int pid;
 public StartupClrReader(IntPtr process,int id){handle=process;pid=id;}
 public string DisplayName=>"Owned startup session";
 public bool IsThreadSafe=>true;
 public OSPlatform TargetPlatform=>OSPlatform.Windows;
 public Architecture Architecture=>Architecture.X64;
 public int ProcessId=>pid;
 public int PointerSize=>8;
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool ReadProcessMemory(IntPtr h,IntPtr address,byte[] data,UIntPtr count,out UIntPtr read);
 public int Read(ulong address,Span<byte> buffer){if(buffer.Length>1048576)return 0;var bytes=new byte[buffer.Length];UIntPtr read;if(!ReadProcessMemory(handle,new IntPtr((long)address),bytes,(UIntPtr)(uint)bytes.Length,out read))return 0;bytes.AsSpan(0,(int)read.ToUInt64()).CopyTo(buffer);return (int)read.ToUInt64();}
 public bool Read<T>(ulong address,out T value) where T:unmanaged {Span<byte> b=stackalloc byte[Marshal.SizeOf<T>()];if(Read(address,b)!=b.Length){value=default;return false;}value=MemoryMarshal.Read<T>(b);return true;}
 public T Read<T>(ulong address) where T:unmanaged{Read(address,out T value);return value;}
 public bool ReadPointer(ulong address,out ulong value)=>Read(address,out value);
 public ulong ReadPointer(ulong address)=>Read<ulong>(address);
 public bool GetThreadContext(uint id,uint flags,Span<byte> context)=>false;
 public void FlushCachedData(){}
 public void Dispose(){}
 [DllImport("psapi.dll",SetLastError=true)] static extern bool EnumProcessModulesEx(IntPtr h,IntPtr[] modules,int size,out int needed,uint flags);
 [DllImport("psapi.dll",CharSet=CharSet.Unicode)] static extern uint GetModuleFileNameEx(IntPtr h,IntPtr module,StringBuilder name,int size);
 public IEnumerable<ModuleInfo> EnumerateModules(){
  var modules=new IntPtr[4096];int needed;
  if(!EnumProcessModulesEx(handle,modules,modules.Length*8,out needed,3))throw new Exception("EnumProcessModulesEx error "+Marshal.GetLastWin32Error());
  if(needed>modules.Length*8)throw new Exception("Module count limit");
  for(int i=0;i<needed/8;i++){var name=new StringBuilder(32768);GetModuleFileNameEx(handle,modules[i],name,name.Capacity);var module=ModuleInfo.TryCreate(this,(ulong)modules[i].ToInt64(),name.ToString());if(module!=null)yield return module;}
 }
}
