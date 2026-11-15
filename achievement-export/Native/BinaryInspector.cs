using System;
using System.IO;
using System.Text;
using System.Collections.Generic;

public static class BinaryInspector
{
    public static string[] Evidence(string path)
    {
        byte[] b = File.ReadAllBytes(path);
        var hits = new HashSet<string>(StringComparer.Ordinal);
        Scan(b, 1, 0, hits);
        Scan(b, 2, 0, hits);
        Scan(b, 2, 1, hits);
        var result = new List<string>(hits);
        result.Sort(StringComparer.Ordinal);
        return result.ToArray();
    }
    static void Scan(byte[] b, int stride, int start, HashSet<string> hits)
    {
        int begin = start;
        for (int i = start; i < b.Length + stride; i += stride)
        {
            bool printable = i < b.Length && b[i] >= 32 && b[i] <= 126 &&
                (stride == 1 || (i + 1 < b.Length && b[i + 1] == 0));
            if (printable) continue;
            int count = (i - begin) / stride;
            if (count >= 6 && count <= 2048)
            {
                string s = stride == 1 ? Encoding.ASCII.GetString(b, begin, count) :
                    Encoding.Unicode.GetString(b, begin, count * 2);
                string lower = s.ToLowerInvariant();
                if (lower.Contains("achievement") || lower.Contains("puerts") ||
                    lower.Contains("unreal") || lower.Contains("shipping") ||
                    lower.Contains("anticheat") || lower.Contains("protobuf") ||
                    lower.Contains("jsenv") || lower.Contains("unrealcsharp") ||
                    lower.Contains("client-win64") || lower.Contains("++ue4") ||
                    lower.Contains("++ue5"))
                    hits.Add("0x" + begin.ToString("X") + " [" + (stride == 1 ? "ASCII" : "UTF16") + "] " + s);
            }
            begin = i + stride;
        }
    }
}
