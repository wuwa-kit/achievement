using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Reflection;

namespace Wuwa.Desktop;

public partial class MainWindow
{
    private static readonly string CurrentReleaseTag = DesktopMetadata("DesktopReleaseTag");
    private static readonly string UpdateEdition = DesktopMetadata("DesktopEdition");
    private static readonly DesktopUpdater Updater = new(AppContext.BaseDirectory, DesktopUpdater.CreateClient());
    private Task<UpdateCheckResult>? updateCheck;
    private UpdateRelease? offeredRelease;
    private UpdateAsset? preparedUpdate;
    private CancellationTokenSource? updateDownload;
    private bool closeAfterUpdateDownload;
    private bool updateRestarting;
    private bool windowClosed;

    private static string DesktopMetadata(string key) => typeof(MainWindow).Assembly
        .GetCustomAttributes<AssemblyMetadataAttribute>().Single(attribute => attribute.Key == key).Value!;

    private async Task<object> CheckUpdateAsync()
    {
        var check = updateCheck ??= Updater.CheckAsync(CurrentReleaseTag);
        try
        {
            var result = await check;
            if (result.Status == "checked") offeredRelease = result.Release;
            return new { currentVersion = CurrentReleaseTag, currentEdition = UpdateEdition, result.Status, result.Release, result.HttpStatus };
        }
        finally
        {
            if (updateCheck == check) updateCheck = null;
        }
    }

    private void StartUpdateDownload(string edition, string version, string attemptId)
    {
        if (updateDownload is not null || updateRestarting || !Guid.TryParseExact(attemptId, "D", out _) ||
            offeredRelease is not { } release || release.Version != version)
            throw new InvalidOperationException("No matching desktop update can be downloaded.");

        var asset = release.Assets.Select(edition);
        preparedUpdate = null;
        updateDownload = new CancellationTokenSource();
        _ = DownloadUpdateAsync(release.Version, asset, attemptId, updateDownload);
    }

    private async Task DownloadUpdateAsync(string version, UpdateAsset asset, string attemptId, CancellationTokenSource download)
    {
        void EmitUpdate(string status, long received, string? failure = null) =>
            Reply(new { @event = "updateDownload", data = new { attemptId, status, received, failure } });

        try
        {
            var progress = new Progress<long>(received =>
            {
                if (updateDownload == download && !download.IsCancellationRequested) EmitUpdate("downloading", received);
            });
            await Updater.DownloadAsync(version, asset, progress, download.Token);
            download.Token.ThrowIfCancellationRequested();
            preparedUpdate = asset;
            EmitUpdate("ready", asset.Size);
        }
        catch (OperationCanceledException) when (download.IsCancellationRequested) { EmitUpdate("cancelled", 0); }
        catch (Exception error)
        {
            Trace.TraceWarning(error.ToString());
            EmitUpdate("failed", 0, error switch
            {
                InvalidDataException => "integrityFailed",
                HttpIOException => "downloadFailed",
                IOException or UnauthorizedAccessException => "saveFailed",
                _ => "downloadFailed"
            });
        }
        finally
        {
            download.Dispose();
            updateDownload = null;
            if (closeAfterUpdateDownload)
            {
                closeAfterUpdateDownload = false;
                Close();
            }
        }
    }

    private async Task RestartWithUpdateAsync(string edition, string version)
    {
        EnsureIdle();
        if (updateRestarting || updateDownload is not null || offeredRelease is not { } release || release.Version != version ||
            preparedUpdate is not { } asset || asset != release.Assets.Select(edition))
            throw new InvalidOperationException("No matching desktop update is ready.");

        updateRestarting = true;
        try
        {
            using var verifiedFile = await Updater.OpenVerifiedAsync(asset);
            using var current = Process.GetCurrentProcess();
            var handoff = Guid.NewGuid();
            using var ready = new EventWaitHandle(false, EventResetMode.AutoReset, App.UpdateReadyEvent(handoff));
            var start = new ProcessStartInfo(verifiedFile.Name)
            {
                UseShellExecute = false,
                WorkingDirectory = AppContext.BaseDirectory,
                ArgumentList =
                {
                    App.UpdateParentArgument,
                    current.Id.ToString(CultureInfo.InvariantCulture),
                    current.StartTime.ToUniversalTime().Ticks.ToString(CultureInfo.InvariantCulture),
                    handoff.ToString("D")
                }
            };
            start.Environment["DOTNET_DISABLE_GUI_ERRORS"] = "1";
            using var child = Process.Start(start) ?? throw new IOException("Could not start the updated executable.");
            // Confirm the new executable reached managed startup, including when switching to Lite.
            var running = await Task.Run(() =>
            {
                var timeout = Stopwatch.StartNew();
                while (!child.HasExited && timeout.Elapsed < TimeSpan.FromSeconds(15))
                    if (ready.WaitOne(100)) return true;
                return false;
            });
            if (!running) throw new IOException("The updated process did not reach startup.");
        }
        finally { updateRestarting = false; }
    }
}
