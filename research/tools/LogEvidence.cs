using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Collections.Generic;

public static class LogEvidence
{
    public static string[] Find(string path)
    {
        byte[] bytes;
        using(var stream=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete))
        using(var memory=new MemoryStream()) { stream.CopyTo(memory); bytes=memory.ToArray(); }
        int start=bytes.Length>=3 && bytes[0]==0xEF && bytes[1]==0xBB && bytes[2]==0xBF ? 3 : 0;
        bool plain=bytes.Length>start && bytes[start]==(byte)'[';
        if(!plain) for(int i=start;i<bytes.Length;i++) bytes[i]=(byte)(bytes[i]^((bytes[i]&1)==1?0xA5:0xEF));
        var output=new List<string>();
        foreach(string line in Encoding.UTF8.GetString(bytes,start,bytes.Length-start).Split('\n'))
        {
            if(!Regex.IsMatch(line,@"Achievement|成就|JsEnvModule|Inspector|DebugPort",RegexOptions.IgnoreCase))continue;
            // Store only relevant diagnostics; strip URLs and potentially sensitive identifiers.
            string safe=Regex.Replace(line,@"https?://[^\s\]\""']+","[URL]");
            safe=Regex.Replace(safe,@"(?i)(token|account|uid|playerid|roleid)[\s\""':=]+[^,\s\]}]+","$1=[REDACTED]");
            safe=Regex.Replace(safe,@"\b[0-9]{8,}\b","[LONG_NUMBER]");
            output.Add(safe.Length>1600?safe.Substring(0,1600)+" [truncated]":safe.TrimEnd());
        }
        return output.ToArray();
    }
}
