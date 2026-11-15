using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class MonoCatalogBridge {
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr VirtualAllocEx(IntPtr h,IntPtr a,UIntPtr n,uint type,uint protect);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool WriteProcessMemory(IntPtr h,IntPtr a,byte[] b,UIntPtr n,out UIntPtr written);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool ReadProcessMemory(IntPtr h,IntPtr a,byte[] b,UIntPtr n,out UIntPtr read);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool VirtualProtectEx(IntPtr h,IntPtr a,UIntPtr n,uint protect,out uint old);
 [DllImport("kernel32.dll")] static extern bool FlushInstructionCache(IntPtr h,IntPtr a,UIntPtr n);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr CreateRemoteThread(IntPtr h,IntPtr attributes,UIntPtr stack,IntPtr start,IntPtr argument,uint flags,out uint tid);
 [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h,uint ms);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll")] static extern bool VirtualFreeEx(IntPtr h,IntPtr a,UIntPtr n,uint type);
 [DllImport("kernel32.dll")] static extern uint GetProcessId(IntPtr h);
 [DllImport("psapi.dll",SetLastError=true)] static extern bool EnumProcessModulesEx(IntPtr h,IntPtr[] modules,int size,out int needed,uint flags);
 [DllImport("psapi.dll",CharSet=CharSet.Unicode)] static extern uint GetModuleFileNameEx(IntPtr h,IntPtr m,StringBuilder name,int size);
 static void Write(IntPtr h,IntPtr a,byte[] bytes){UIntPtr n;if(!WriteProcessMemory(h,a,bytes,(UIntPtr)(uint)bytes.Length,out n)||n.ToUInt64()!=(ulong)bytes.Length)throw new Win32Exception();}
 // Only called with the process creation handle retained by our launcher.
 public static string Start(IntPtr handle,uint expectedPid,string payload,string runtimePath,Dictionary<string,uint> exports){
  if(GetProcessId(handle)!=expectedPid||expectedPid==0)throw new Exception("Owned process mismatch");
  if(!File.Exists(payload))throw new FileNotFoundException(payload);
  IntPtr[] modules=new IntPtr[4096];int needed;long moduleBase=0;
  if(!EnumProcessModulesEx(handle,modules,modules.Length*8,out needed,3))throw new Win32Exception();
  if(needed>modules.Length*8)throw new Exception("Module bound");
  for(int i=0;i<needed/8;i++){var s=new StringBuilder(32768);GetModuleFileNameEx(handle,modules[i],s,s.Capacity);if(string.Equals(s.ToString(),runtimePath,StringComparison.OrdinalIgnoreCase)){moduleBase=modules[i].ToInt64();break;}}
  if(moduleBase==0)throw new Exception("Expected runtime module not found");
  IntPtr data=IntPtr.Zero,code=IntPtr.Zero,thread=IntPtr.Zero;bool running=false;
  try {
   data=VirtualAllocEx(handle,IntPtr.Zero,(UIntPtr)4096,0x3000,4);code=VirtualAllocEx(handle,IntPtr.Zero,(UIntPtr)4096,0x3000,4);
   if(data==IntPtr.Zero||code==IntPtr.Zero)throw new Win32Exception();
   var buffer=new byte[4096];Encoding.UTF8.GetBytes(Path.GetFullPath(payload)+"\0").CopyTo(buffer,64);Encoding.ASCII.GetBytes("CatalogPayload\0").CopyTo(buffer,2080);Encoding.ASCII.GetBytes("Run\0").CopyTo(buffer,2144);Write(handle,data,buffer);
   var b=new List<byte>();var exits=new List<int>();
   Action<byte[]> emit=x=>b.AddRange(x);Action<long> imm=x=>emit(BitConverter.GetBytes(x));
   Action<string> call=name=>{emit(new byte[]{0x48,0xB8});imm(moduleBase+exports[name]);emit(new byte[]{0xFF,0xD0});};
   Action<int> stage=n=>{emit(new byte[]{0x48,0xB8});imm(data.ToInt64());emit(new byte[]{0xC7,0x00});emit(BitConverter.GetBytes(n));};
   Action check=()=>{emit(new byte[]{0x48,0x85,0xC0,0x0F,0x84});exits.Add(b.Count);emit(new byte[4]);};
   emit(new byte[]{0x53,0x41,0x54,0x48,0x83,0xEC,0x28,0x31,0xDB});
   stage(1);call("mono_get_root_domain");check();emit(new byte[]{0x49,0x89,0xC4,0x48,0x89,0xC1});
   stage(2);emit(new byte[]{0x4C,0x89,0xE1});call("mono_thread_attach");check();emit(new byte[]{0x48,0x89,0xC3});
   stage(3);emit(new byte[]{0x4C,0x89,0xE1,0x48,0xBA});imm(data.ToInt64()+64);call("mono_domain_assembly_open");check();
   emit(new byte[]{0x48,0x89,0xC1});call("mono_assembly_get_image");check();
   emit(new byte[]{0x48,0x89,0xC1,0x48,0xBA});imm(data.ToInt64()+2048);emit(new byte[]{0x49,0xB8});imm(data.ToInt64()+2080);call("mono_class_from_name");check();
   emit(new byte[]{0x48,0x89,0xC1,0x48,0xBA});imm(data.ToInt64()+2144);emit(new byte[]{0x45,0x31,0xC0});call("mono_class_get_method_from_name");check();
   emit(new byte[]{0x48,0x89,0xC1,0x31,0xD2,0x45,0x31,0xC0,0x49,0xB9});imm(data.ToInt64()+8);call("mono_runtime_invoke");stage(9);
   int cleanup=b.Count;emit(new byte[]{0x48,0x85,0xDB,0x74,0x0F,0x48,0x89,0xD9});call("mono_thread_detach");
   emit(new byte[]{0x31,0xC0,0x48,0x83,0xC4,0x28,0x41,0x5C,0x5B,0xC3});
   foreach(int at in exits){var jump=BitConverter.GetBytes(cleanup-(at+4));for(int j=0;j<4;j++)b[at+j]=jump[j];}
   Write(handle,code,b.ToArray());uint previous;if(!VirtualProtectEx(handle,code,(UIntPtr)4096,0x20,out previous))throw new Win32Exception();FlushInstructionCache(handle,code,(UIntPtr)(uint)b.Count);
   uint tid;thread=CreateRemoteThread(handle,IntPtr.Zero,UIntPtr.Zero,code,IntPtr.Zero,0,out tid);if(thread==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error(),"Create catalog query thread");running=true;
   if(WaitForSingleObject(thread,10000)!=0)return "Catalog bootstrap still running; owned allocation retained";
   running=false;var result=new byte[16];UIntPtr read;if(!ReadProcessMemory(handle,data,result,(UIntPtr)16,out read))throw new Win32Exception();
   return "Bootstrap stage="+BitConverter.ToInt32(result,0)+", managedException=0x"+BitConverter.ToInt64(result,8).ToString("X");
  }finally{if(thread!=IntPtr.Zero)CloseHandle(thread);if(!running){if(code!=IntPtr.Zero)VirtualFreeEx(handle,code,UIntPtr.Zero,0x8000);if(data!=IntPtr.Zero)VirtualFreeEx(handle,data,UIntPtr.Zero,0x8000);}}
 }
}
