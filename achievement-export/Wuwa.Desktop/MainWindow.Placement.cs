using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Interop;
using Wuwa.Export;

namespace Wuwa.Desktop;

public partial class MainWindow
{
    private sealed record SavedWindow(int Left, int Top, int Right, int Bottom, bool Maximized);

    // WINDOWPLACEMENT stores the restored rectangle in workspace coordinates.
    [StructLayout(LayoutKind.Sequential)]
    private struct WindowPlacement
    {
        public int Length, Flags, ShowCommand;
        public int MinX, MinY, MaxX, MaxY;
        public int Left, Top, Right, Bottom;
    }

    [DllImport("user32.dll")]
    private static extern bool GetWindowPlacement(IntPtr window, ref WindowPlacement placement);

    [DllImport("user32.dll")]
    private static extern bool SetWindowPlacement(IntPtr window, ref WindowPlacement placement);

    private const int ShowNormal = 1, ShowMinimized = 2, ShowMaximized = 3, RestoreToMaximized = 2;

    private void RestoreWindowPlacement()
    {
        if (settings.Window is not { } saved || saved.Right <= saved.Left || saved.Bottom <= saved.Top) return;
        var placement = new WindowPlacement
        {
            Length = Marshal.SizeOf<WindowPlacement>(),
            ShowCommand = saved.Maximized ? ShowMaximized : ShowNormal,
            Left = saved.Left, Top = saved.Top, Right = saved.Right, Bottom = saved.Bottom
        };
        SetWindowPlacement(new WindowInteropHelper(this).Handle, ref placement);
    }

    private void SaveWindowState()
    {
        var placement = new WindowPlacement { Length = Marshal.SizeOf<WindowPlacement>() };
        if (!GetWindowPlacement(new WindowInteropHelper(this).Handle, ref placement)) return;
        bool maximized = placement.ShowCommand == ShowMaximized ||
            (placement.ShowCommand == ShowMinimized && (placement.Flags & RestoreToMaximized) != 0);
        var saved = new SavedWindow(placement.Left, placement.Top, placement.Right, placement.Bottom, maximized);
        try
        {
            Json.Save(SettingsPath, settings with { Window = saved, Zoom = Browser.CoreWebView2 is null ? settings.Zoom : Browser.ZoomFactor });
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            Trace.TraceWarning("Could not save window settings: {0}", error.Message);
        }
    }
}
