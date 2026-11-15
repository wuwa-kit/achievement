using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using Microsoft.Win32;

namespace Wuwa.Desktop;

public partial class MainWindow
{
    private const int UseImmersiveDarkMode = 20;
    private const int CaptionColor = 35;
    private const int CaptionTextColor = 36;
    private const uint SetIconMessage = 0x0080;
    private const int SmallIcon = 0;
    private const int SmallIconWidth = 49;
    private const int SmallIconHeight = 50;
    private const int DefaultDwmColor = -1;

    private bool darkTheme;
    private IntPtr captionIcon;
    private IntPtr originalSmallIcon;

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        var dark = settings.Theme == "dark" || (settings.Theme == "auto" &&
            Registry.GetValue(@"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
                "AppsUseLightTheme", 1) is 0);
        ApplyTheme(dark);
        SystemParameters.StaticPropertyChanged += OnSystemParameterChanged;
    }

    protected override void OnDpiChanged(DpiScale oldDpi, DpiScale newDpi)
    {
        base.OnDpiChanged(oldDpi, newDpi);
        ApplyCaptionTheme(newDpi);
    }

    protected override void OnClosed(EventArgs e)
    {
        SystemParameters.StaticPropertyChanged -= OnSystemParameterChanged;
        if (captionIcon != IntPtr.Zero) _ = DestroyIcon(captionIcon);
        base.OnClosed(e);
    }

    private void OnSystemParameterChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(SystemParameters.HighContrast))
            ApplyCaptionTheme(VisualTreeHelper.GetDpi(this));
    }

    private void ApplyTheme(bool dark)
    {
        darkTheme = dark;
        var color = ThemeBackground;
        Background = new SolidColorBrush(color);
        Browser.DefaultBackgroundColor = System.Drawing.Color.FromArgb(color.R, color.G, color.B);
        ApplyCaptionTheme(VisualTreeHelper.GetDpi(this));
    }

    private Color ThemeBackground => darkTheme ? Color.FromRgb(17, 21, 33) : Color.FromRgb(238, 240, 245);

    private void ApplyCaptionTheme(DpiScale dpi)
    {
        var hwnd = new WindowInteropHelper(this).Handle;
        if (hwnd == IntPtr.Zero) return;

        var highContrast = SystemParameters.HighContrast;
        _ = DwmSetWindowAttribute(hwnd, UseImmersiveDarkMode, darkTheme && !highContrast ? 1 : 0, sizeof(int));
        var color = ThemeBackground;
        var background = highContrast ? DefaultDwmColor : color.R | (color.G << 8) | (color.B << 16);
        var foreground = highContrast ? DefaultDwmColor : darkTheme ? 0xFFFFFF : 0x000000;
        var captionResult = DwmSetWindowAttribute(hwnd, CaptionColor, background, sizeof(int));
        _ = DwmSetWindowAttribute(hwnd, CaptionTextColor, foreground, sizeof(int));

        if (highContrast || captionResult < 0)
        {
            if (captionIcon == IntPtr.Zero) return;
            _ = SendMessage(hwnd, SetIconMessage, SmallIcon, originalSmallIcon);
            _ = DestroyIcon(captionIcon);
            captionIcon = IntPtr.Zero;
            return;
        }

        var iconName = darkTheme ? "caption-achievement-white.png" : "caption-achievement-black.png";
        using var resource = typeof(MainWindow).Assembly.GetManifestResourceStream(iconName)!;
        using var buffer = new MemoryStream();
        resource.CopyTo(buffer);
        var iconData = buffer.ToArray();
        var width = GetSystemMetricsForDpi(SmallIconWidth, (uint)dpi.PixelsPerInchX);
        var height = GetSystemMetricsForDpi(SmallIconHeight, (uint)dpi.PixelsPerInchY);
        var nextIcon = CreateIconFromResourceEx(iconData, iconData.Length, 1, 0x00030000, width, height, 0);
        if (nextIcon == IntPtr.Zero) return;

        var previousIcon = SendMessage(hwnd, SetIconMessage, SmallIcon, nextIcon);
        if (captionIcon == IntPtr.Zero) originalSmallIcon = previousIcon;
        else _ = DestroyIcon(captionIcon);
        captionIcon = nextIcon;
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, in int value, int size);

    [DllImport("user32.dll", EntryPoint = "SendMessageW")]
    private static extern IntPtr SendMessage(IntPtr hwnd, uint message, nint wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern int GetSystemMetricsForDpi(int index, uint dpi);

    [DllImport("user32.dll")]
    private static extern IntPtr CreateIconFromResourceEx(byte[] bits, int size, int icon, uint version, int width, int height, uint flags);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool DestroyIcon(IntPtr icon);
}
