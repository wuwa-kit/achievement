using System.IO;
using System.Reflection.PortableExecutable;
using System.Runtime.InteropServices;
using System.Security;
using Microsoft.Win32;

namespace Wuwa.Desktop;

internal static class DesktopRuntime
{
    public static UpdateAsset SelectAsset(UpdateAssets assets, string currentEdition, Func<string?>? installationRoot = null)
    {
        if (currentEdition == "lite") return assets.Lite;
        try
        {
            var root = (installationRoot ?? FindInstallationRoot)();
            if (string.IsNullOrEmpty(root) || !File.Exists(Path.Combine(root, "dotnet.exe"))) return assets.Standard;
            using var host = File.OpenRead(Path.Combine(root, "dotnet.exe"));
            using var pe = new PEReader(host);
            if (pe.PEHeaders.CoffHeader.Machine != Machine.Amd64) return assets.Standard;

            var desktop = LatestFramework(root, "Microsoft.WindowsDesktop.App", "PresentationFramework.dll");
            var core = LatestFramework(root, "Microsoft.NETCore.App", "coreclr.dll");
            return desktop is not null && core is not null && core >= desktop ? assets.Lite : assets.Standard;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or SecurityException or BadImageFormatException)
        {
            return assets.Standard;
        }
    }

    private static Version? LatestFramework(string root, string framework, string assembly)
    {
        var directory = Path.Combine(root, "shared", framework);
        if (!Directory.Exists(directory)) return null;
        return Directory.EnumerateDirectories(directory)
            .Where(path => File.Exists(Path.Combine(path, assembly)))
            .Select(path => Version.TryParse(Path.GetFileName(path), out var version) ? version : null)
            .Where(version => version is { Major: 10, Minor: 0, Build: >= 0 })
            .Max();
    }

    private static string? FindInstallationRoot()
    {
        // Follow the x64 apphost's environment, registered installation, and default location order.
        foreach (var variable in new[] { "DOTNET_ROOT_X64", "DOTNET_ROOT" })
            if (Environment.GetEnvironmentVariable(variable) is { Length: > 0 } root) return root;

        // .NET's install location is registered in the 32-bit registry view for every architecture.
        using var machine = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry32);
        using var installation = machine.OpenSubKey(@"SOFTWARE\dotnet\Setup\InstalledVersions\x64");
        if (installation?.GetValue("InstallLocation") is string registered && registered.Length > 0) return registered;

        var standard = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "dotnet");
        return RuntimeInformation.OSArchitecture == Architecture.Arm64 ? Path.Combine(standard, "x64") : standard;
    }
}
