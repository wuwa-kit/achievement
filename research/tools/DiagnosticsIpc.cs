using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

public static class DiagnosticsIpc
{
    static byte[] Read(PipeStream pipe,int count)
    {
        byte[] bytes=new byte[count]; int done=0;
        while(done<count){
            var task=pipe.ReadAsync(bytes,done,count-done);
            if(!task.Wait(5000))throw new TimeoutException("Diagnostic IPC response timeout");
            int n=task.Result; if(n==0)throw new EndOfStreamException(); done+=n;
        }
        return bytes;
    }
    public static byte[] Command(int pid,byte commandSet,byte commandId,byte[] payload)
    {
        using(var pipe=new NamedPipeClientStream(".","dotnet-diagnostic-"+pid,PipeDirection.InOut,PipeOptions.Asynchronous))
        {
            pipe.Connect(3000);
            byte[] header=new byte[20];
            Encoding.ASCII.GetBytes("DOTNET_IPC_V1\0").CopyTo(header,0);
            BitConverter.GetBytes(checked((ushort)(20+payload.Length))).CopyTo(header,14);
            header[16]=commandSet;header[17]=commandId;
            pipe.Write(header,0,header.Length);pipe.Write(payload,0,payload.Length);pipe.Flush();
            byte[] response=Read(pipe,20);
            if(Encoding.ASCII.GetString(response,0,13)!="DOTNET_IPC_V1")throw new InvalidDataException("Invalid IPC magic");
            int length=BitConverter.ToUInt16(response,14)-20;
            if(length<0)throw new InvalidDataException("Invalid IPC length");
            byte[] result=Read(pipe,length);
            if(response[16]!=255 || response[17]!=0)
                throw new InvalidOperationException("Diagnostic IPC failure: "+(result.Length>=4?"0x"+BitConverter.ToUInt32(result,0).ToString("X8"):"invalid response"));
            return result;
        }
    }
    static string ReadString(BinaryReader reader)
    {
        uint count=reader.ReadUInt32();if(count>32768)throw new InvalidDataException();
        byte[] bytes=reader.ReadBytes(checked((int)count*2));
        if(bytes.Length!=count*2)throw new EndOfStreamException();
        return Encoding.Unicode.GetString(bytes).TrimEnd('\0');
    }
    public static Dictionary<string,object> Info(int pid)
    {
        byte[] payload=Command(pid,4,4,new byte[0]);
        using(var reader=new BinaryReader(new MemoryStream(payload)))
        {
            var info=new Dictionary<string,object>();
            info["pid"]=reader.ReadInt64(); reader.ReadBytes(16);
            ReadString(reader); // Discard command line; it may include credentials.
            info["os"]=ReadString(reader);info["arch"]=ReadString(reader);
            info["entryAssembly"]=ReadString(reader);info["runtimeVersion"]=ReadString(reader);
            return info;
        }
    }
    public static int ApplyHook(int pid,string path)
    {
        if(!Path.IsPathRooted(path)||!File.Exists(path))throw new ArgumentException("Hook must be an existing absolute path");
        using(var ms=new MemoryStream())using(var writer=new BinaryWriter(ms)){
            writer.Write((uint)(path.Length+1));writer.Write(Encoding.Unicode.GetBytes(path+"\0"));
            byte[] response=Command(pid,4,7,ms.ToArray());
            if(response.Length!=4)throw new InvalidDataException("Invalid hook response");
            return BitConverter.ToInt32(response,0);
        }
    }
    public static int ProbeMissingProfiler(int pid,string missingPath)
    {
        // Capability check only: the path must not exist, so no profiler can be loaded.
        if(!Path.IsPathRooted(missingPath)||File.Exists(missingPath)||Directory.Exists(missingPath))
            throw new ArgumentException("Expected a nonexistent absolute profiler path");
        using(var ms=new MemoryStream())using(var writer=new BinaryWriter(ms)) {
            writer.Write((uint)1000);writer.Write(Guid.NewGuid().ToByteArray());
            writer.Write((uint)(missingPath.Length+1));writer.Write(Encoding.Unicode.GetBytes(missingPath+"\0"));
            writer.Write((uint)0);
            byte[] response=Command(pid,3,1,ms.ToArray());
            if(response.Length!=4)throw new InvalidDataException("Invalid profiler response");
            return BitConverter.ToInt32(response,0);
        }
    }
    public static long TraceMetadata(int pid,string path)
    {
        return TraceSession(pid,path,0x18,true,null);
    }
    public static string LastActionError { get; private set; }
    public static long TraceHookFailure(int pid,string path,string hook)
    {
        return TraceSession(pid,path,0x8008,false,hook);
    }
    static long TraceSession(int pid,string path,ulong keywords,bool rundown,string hook)
    {
        LastActionError=null;
        using(var pipe=new NamedPipeClientStream(".","dotnet-diagnostic-"+pid,PipeDirection.InOut,PipeOptions.Asynchronous))
        using(var output=new FileStream(path,FileMode.CreateNew,FileAccess.Write))
        using(var ms=new MemoryStream())using(var w=new BinaryWriter(ms)) {
            pipe.Connect(3000);
            w.Write((uint)4);w.Write((uint)1);w.Write(rundown);w.Write(false);w.Write((uint)1);
            w.Write(keywords);w.Write((uint)5);
            string provider="Microsoft-Windows-DotNETRuntime";
            w.Write((uint)(provider.Length+1));w.Write(Encoding.Unicode.GetBytes(provider+"\0"));w.Write((uint)0);
            byte[] payload=ms.ToArray(),header=new byte[20];
            Encoding.ASCII.GetBytes("DOTNET_IPC_V1\0").CopyTo(header,0);
            BitConverter.GetBytes((ushort)(20+payload.Length)).CopyTo(header,14);header[16]=2;header[17]=4;
            pipe.Write(header,0,20);pipe.Write(payload,0,payload.Length);pipe.Flush();
            byte[] response=Read(pipe,20);int length=BitConverter.ToUInt16(response,14)-20;
            if(length<0)throw new InvalidDataException();byte[] data=Read(pipe,length);
            if(response[16]!=255||response[17]!=0)throw new InvalidOperationException("Trace rejected: "+BitConverter.ToString(data));
            if(data.Length!=8)throw new InvalidDataException();
            ulong session=BitConverter.ToUInt64(data,0);
            var copy=Task.Run(()=>{
                byte[] buffer=new byte[65536];int n;long total=0;
                while((n=pipe.Read(buffer,0,buffer.Length))>0){total+=n;if(total>64*1024*1024)throw new IOException("Trace exceeds 64 MiB limit");output.Write(buffer,0,n);}
            });
            try {
                Thread.Sleep(500);
                if(hook!=null) {try { int hr=ApplyHook(pid,hook);LastActionError="HRESULT 0x"+hr.ToString("X8"); }catch(Exception ex){LastActionError=ex.Message;} }
                Thread.Sleep(1000);Command(pid,2,1,BitConverter.GetBytes(session));if(!copy.Wait(30000))throw new TimeoutException("Trace rundown timeout");
            }
            finally { pipe.Dispose();try{copy.Wait(1000);}catch{} }
            return output.Length;
        }
    }
}
