using System.Windows;
using Wuwa.Export;

namespace Wuwa.Desktop;

public partial class App : Application
{
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
        var window = new MainWindow();
        MainWindow = window;
        window.Show();
    }
}
