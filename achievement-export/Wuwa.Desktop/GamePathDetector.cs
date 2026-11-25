using System.Diagnostics;
using System.IO;
using Microsoft.Win32;
using Wuwa.Export;

namespace Wuwa.Desktop;

internal static class GamePathDetector
{
    public static string? Detect(string current)
    {
        var roots = new List<string> { current, Options.DefaultGame };
        foreach (var name in new[] { "Client-Win64-Shipping", "Wuthering Waves" })
            foreach (var process in Process.GetProcessesByName(name))
                using (process)
                    try { if (process.MainModule?.FileName is { } path) roots.Add(path); }
                    catch (Exception e) when (e is System.ComponentModel.Win32Exception or InvalidOperationException or NotSupportedException) { }
        foreach (var hive in new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine })
            foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
                try
                {
                    using var root = RegistryKey.OpenBaseKey(hive, view);
                    using var uninstall = root.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall");
                    if (uninstall is null) continue;
                    foreach (var key in uninstall.GetSubKeyNames())
                    {
                        using var app = uninstall.OpenSubKey(key);
                        var name = app?.GetValue("DisplayName") as string ?? "";
                        if (!name.Contains("Wuthering", StringComparison.OrdinalIgnoreCase) && !name.Contains("鸣潮")) continue;
                        if (app?.GetValue("InstallLocation") is string location) roots.Add(location);
                    }
                }
                catch (Exception e) when (e is System.Security.SecurityException or UnauthorizedAccessException or IOException) { }
        foreach (var drive in DriveInfo.GetDrives())
        {
            if (drive.DriveType != DriveType.Fixed) continue;
            foreach (var folder in new[] { @"WeGameApps\rail_apps\Wuthering Waves(2002137)", "Wuthering Waves", "Wuthering Waves Game", "鸣潮", @"Games\Wuthering Waves", @"Program Files\Wuthering Waves", @"Program Files (x86)\Wuthering Waves" })
                roots.Add(Path.Combine(drive.RootDirectory.FullName, folder));
        }
        foreach (var root in roots.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(root)) continue;
            try
            {
                var directory = File.Exists(root) ? Path.GetDirectoryName(root) : root;
                for (var depth = 0; depth < 6 && !string.IsNullOrEmpty(directory); depth++, directory = Path.GetDirectoryName(directory))
                    foreach (var relative in new[] { "Wuthering Waves.exe", @"Wuthering Waves Game\Wuthering Waves.exe", @"Wuthering Waves\Wuthering Waves Game\Wuthering Waves.exe" })
                    {
                        var candidate = Path.Combine(directory, relative);
                        if (File.Exists(candidate)) return Path.GetFullPath(candidate);
                    }
            }
            catch (Exception e) when (e is ArgumentException or IOException or UnauthorizedAccessException) { }
        }
        return null;
    }
}
