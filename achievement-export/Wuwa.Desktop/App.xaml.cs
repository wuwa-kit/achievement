using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.Windows;
using Wuwa.Export;

namespace Wuwa.Desktop;

public partial class App : Application
{
    internal const string UpdateParentArgument = "--update-parent";
    internal static string UpdateReadyEvent(Guid handoff) => $@"Local\WuwaAchievementUpdate-{handoff:D}";

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        if (e.Args.FirstOrDefault() == "internal-collect")
        {
            // The diagnostic assembly's synchronous entry point waits on async work.
            // Invoke it without WPF's DispatcherSynchronizationContext to avoid deadlock.
            try { Shutdown(await Task.Run(() => Workflow.Collect(e.Args[1..]))); }
            catch (Exception error) { Console.Error.WriteLine(error); Shutdown(1); }
            return;
        }
        if (e.Args is [UpdateParentArgument, var parentId, var startedAt, var handoff] &&
            !await WaitForUpdateParentAsync(parentId, startedAt, handoff))
        {
            Shutdown(1);
            return;
        }

        var window = new MainWindow();
        MainWindow = window;
        window.Show();

        if (!window.IsActive && !window.Activate())
        {
            // Raise the window in the normal z-order if Windows denies activation.
            window.Topmost = true;
            window.Topmost = false;
        }
    }

    private static async Task<bool> WaitForUpdateParentAsync(string parentId, string startedAt, string handoff)
    {
        if (!int.TryParse(parentId, NumberStyles.None, CultureInfo.InvariantCulture, out var id) || id <= 0 ||
            !long.TryParse(startedAt, NumberStyles.None, CultureInfo.InvariantCulture, out var ticks) ||
            !Guid.TryParseExact(handoff, "D", out var token)) return false;

        try
        {
            using var parent = Process.GetProcessById(id);
            if (parent.StartTime.ToUniversalTime().Ticks != ticks) return false;
            using var ready = EventWaitHandle.OpenExisting(UpdateReadyEvent(token));
            ready.Set();
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            await parent.WaitForExitAsync(timeout.Token);
            return true;
        }
        catch (Exception error) when (error is ArgumentException or InvalidOperationException or Win32Exception or OperationCanceledException or WaitHandleCannotBeOpenedException)
        {
            return false;
        }
    }
}
