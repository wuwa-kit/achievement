using Wuwa.Desktop;

internal static class DiagnosticRetentionTests
{
    internal static void Run(string directory)
    {
        string root = Path.Combine(directory, "retention");
        Directory.CreateDirectory(root);
        for (int i = 1; i <= 7; i++)
        {
            string session = Directory.CreateDirectory(Path.Combine(root, $"csharp-session-20261125-00000{i}")).FullName;
            File.WriteAllBytes(Path.Combine(session, "heap.gcdump"), new byte[100]);
        }
        string unrelated = Directory.CreateDirectory(Path.Combine(root, "other")).FullName;
        File.WriteAllText(Path.Combine(unrelated, "keep.txt"), "keep");
        WeGameEnvironment.Junction(Path.Combine(root, "csharp-session-20261125-000001", "link"), unrelated);
        DiagnosticRetention.Clean(root, 5, 300);
        if (Directory.GetDirectories(root, "csharp-session-*").Length != 3 || !File.Exists(Path.Combine(unrelated, "keep.txt")))
            throw new Exception("Diagnostic retention size/link protection failed");
        DiagnosticRetention.Clean(root, 1, 1);
        if (Directory.GetDirectories(root, "csharp-session-*").Length != 1 || !Directory.Exists(Path.Combine(root, "csharp-session-20261125-000007")))
            throw new Exception("Newest diagnostic session was not retained");
        Console.WriteLine("Diagnostic count/size retention, newest-session preservation and junction safety passed.");
    }
}
