using System.Reflection.PortableExecutable;
using Wuwa.Desktop;

internal static class DesktopRuntimeTests
{
    public static void Run(string directory)
    {
        var assets = new UpdateAssets(new("full.exe", 50, ""), new("lite.exe", 5, ""));
        Check(DesktopRuntime.SelectAsset(assets, "lite", () => throw new Exception("Lite must not inspect installed runtimes")) == assets.Lite);
        Check(DesktopRuntime.SelectAsset(assets, "standard", () => null) == assets.Standard);

        var root = Directory.CreateDirectory(Path.Combine(directory, "desktop-runtime")).FullName;
        var executable = File.ReadAllBytes(Environment.ProcessPath!);
        var hostPath = Path.Combine(root, "dotnet.exe");
        File.WriteAllBytes(hostPath, executable);
        UpdateAsset Selected() => DesktopRuntime.SelectAsset(assets, "standard", () => root);
        void Framework(string name, string version, string file)
        {
            var path = Directory.CreateDirectory(Path.Combine(root, "shared", name, version)).FullName;
            File.WriteAllText(Path.Combine(path, file), "fixture");
        }

        Check(Selected() == assets.Standard);
        Framework("Microsoft.NETCore.App", "10.0.0", "coreclr.dll");
        Check(Selected() == assets.Standard);
        Framework("Microsoft.WindowsDesktop.App", "8.0.0", "PresentationFramework.dll");
        Framework("Microsoft.WindowsDesktop.App", "11.0.0", "PresentationFramework.dll");
        Framework("Microsoft.WindowsDesktop.App", "10.0.0-preview.1", "PresentationFramework.dll");
        Check(Selected() == assets.Standard);
        Framework("Microsoft.WindowsDesktop.App", "10.0.0", "PresentationFramework.dll");
        Check(Selected() == assets.Lite);
        Framework("Microsoft.WindowsDesktop.App", "10.0.15", "PresentationFramework.dll");
        Check(Selected() == assets.Standard);
        Framework("Microsoft.NETCore.App", "10.0.15", "coreclr.dll");
        Check(Selected() == assets.Lite);

        var x86 = (byte[])executable.Clone();
        var coffOffset = BitConverter.ToInt32(x86, 0x3c) + 4;
        BitConverter.GetBytes((ushort)Machine.I386).CopyTo(x86, coffOffset);
        File.WriteAllBytes(hostPath, x86);
        Check(Selected() == assets.Standard);
        File.WriteAllBytes(hostPath, [0, 1, 2]);
        Check(Selected() == assets.Standard);
        File.WriteAllBytes(hostPath, executable);

        var previousRoot = Environment.GetEnvironmentVariable("DOTNET_ROOT");
        var previousX64 = Environment.GetEnvironmentVariable("DOTNET_ROOT_X64");
        try
        {
            Environment.SetEnvironmentVariable("DOTNET_ROOT", root);
            Environment.SetEnvironmentVariable("DOTNET_ROOT_X64", Path.Combine(root, "missing"));
            Check(DesktopRuntime.SelectAsset(assets, "standard") == assets.Standard);
            Environment.SetEnvironmentVariable("DOTNET_ROOT_X64", null);
            Check(DesktopRuntime.SelectAsset(assets, "standard") == assets.Lite);
        }
        finally
        {
            Environment.SetEnvironmentVariable("DOTNET_ROOT", previousRoot);
            Environment.SetEnvironmentVariable("DOTNET_ROOT_X64", previousX64);
        }
        Console.WriteLine("Automatic Lite/Full selection, x64 runtime compatibility, framework versions and runtime root precedence passed.");
    }

    private static void Check(bool condition)
    {
        if (!condition) throw new Exception("Desktop runtime selection assertion failed.");
    }
}
