using System.Diagnostics;
using System.IO;

namespace Wuwa.Desktop;

internal static class DiagnosticRetention
{
    // Always keep the newest session for troubleshooting, even if it alone exceeds the budget.
    internal static void Clean(string path, int maxSessions = 5, long maxBytes = 1024L * 1024 * 1024)
    {
        if (!Directory.Exists(path)) return;
        var root = new DirectoryInfo(Path.GetFullPath(path));
        if (root.Attributes.HasFlag(FileAttributes.ReparsePoint)) return;
        long retainedBytes = 0;
        int retained = 0;
        foreach (var session in root.EnumerateDirectories("csharp-session-*").OrderByDescending(d => d.Name, StringComparer.Ordinal))
        {
            if (session.Parent?.FullName != root.FullName || session.Attributes.HasFlag(FileAttributes.ReparsePoint)) continue;
            try
            {
                long size = Size(session);
                if (retained == 0 || (retained < maxSessions && retainedBytes + size <= maxBytes))
                {
                    retained++; retainedBytes += size;
                }
                else Delete(session);
            }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            {
                Trace.TraceWarning("Diagnostic cleanup failed for {0}: {1}", session.FullName, error.Message);
            }
        }
    }
    private static long Size(DirectoryInfo directory) => directory.EnumerateFileSystemInfos()
        .Where(item => !item.Attributes.HasFlag(FileAttributes.ReparsePoint))
        .Sum(item => item is DirectoryInfo child ? Size(child) : ((FileInfo)item).Length);
    private static void Delete(DirectoryInfo directory)
    {
        foreach (var item in directory.EnumerateFileSystemInfos())
        {
            if (item is DirectoryInfo child && !item.Attributes.HasFlag(FileAttributes.ReparsePoint)) Delete(child);
            else item.Delete();
        }
        directory.Delete();
    }
}
