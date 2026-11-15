using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text.Json;
using System.Windows;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using Wuwa.Export;
using Wuwa.Transfer;

namespace Wuwa.Desktop;

public partial class MainWindow : Window
{
    private const string Origin = "https://wuwa.local";
#if RELEASE
    private const string TransferWebsite = "https://wu.songe.li";
#else
    private const string TransferWebsite = "http://127.0.0.1:5173";
#endif
    private const string DesktopEntryPath = "/desktop/index.html";
    private const string UiResourcePrefix = "DesktopUi";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly string DataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WuwaAchievementExport");
    private static readonly string SettingsPath = Path.Combine(DataPath, "settings.json");
    private static readonly string AccountsPath = Path.Combine(DataPath, "accounts");
    private static readonly string DiagnosticsPath = Path.Combine(DataPath, "diagnostics");
    private readonly DispatcherTimer gameMonitor = new() { Interval = TimeSpan.FromSeconds(1) };
    private CancellationTokenSource? operation;
    private TransferSession? transfer;
    private bool closeRequested;
    private string? bootstrapScriptId;
    private string stage = "ready";
    private string? error;
    private CollectionDiagnostic? collectionDiagnostic;
    private Settings settings = new(Options.DefaultGame);
    private readonly ExportHistory history = new(AccountsPath);
    private sealed record Settings(string GamePath, string Language = "zh-CN", string Theme = "auto");
    private static readonly Dictionary<string, JsonElement> Locales = Assembly.GetExecutingAssembly().GetManifestResourceNames()
        .Where(name => name.StartsWith("Locale.", StringComparison.Ordinal) && name.EndsWith(".json", StringComparison.Ordinal))
        .ToDictionary(name => name["Locale.".Length..^".json".Length], name =>
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)!;
        using var document = JsonDocument.Parse(stream);
        return document.RootElement.Clone();
    });
    private string Text(string key, string group = "native") => Locales[settings.Language].GetProperty(group).GetProperty(key).GetString()!;
    public MainWindow()
    {
        InitializeComponent();
        try { if (File.Exists(SettingsPath)) settings = JsonSerializer.Deserialize<Settings>(File.ReadAllText(SettingsPath), JsonOptions) ?? settings; }
        catch (Exception e) when (e is IOException or JsonException) { error = e.Message; }
        settings = settings with { Language = settings.Language is not null && Locales.ContainsKey(settings.Language) ? settings.Language : "zh-CN", GamePath = settings.GamePath ?? Options.DefaultGame };
        Title = Text("desktopTitle", "common");
        settings = settings with { Theme = settings.Theme is "light" or "dark" ? settings.Theme : "auto" };
        gameMonitor.Tick += UpdateGameTopmost;
        Loaded += InitializeBrowser;
        Closed += (_, _) => { gameMonitor.Stop(); Browser.Dispose(); };
    }
    private async void InitializeBrowser(object sender, RoutedEventArgs args)
    {
        try
        {
            if (typeof(MainWindow).Assembly.GetManifestResourceInfo(UiResourcePrefix + DesktopEntryPath) is null)
                throw new FileNotFoundException(Text("assetsMissing"));

            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: Path.Combine(DataPath, "WebView2"));
            await Browser.EnsureCoreWebView2Async(environment);
            var core = Browser.CoreWebView2;
            core.AddWebResourceRequestedFilter(Origin + "/*", CoreWebView2WebResourceContext.All, CoreWebView2WebResourceRequestSourceKinds.All);
            core.WebResourceRequested += ServeUiResource;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreHostObjectsAllowed = false;
            core.NavigationStarting += (_, e) => { if (!IsTrusted(e.Uri)) e.Cancel = true; };
            core.NewWindowRequested += (_, e) =>
            {
                e.Handled = true;
                if (e.Uri == "https://github.com/wuwa-kit/achievement")
                    Process.Start(new ProcessStartInfo(e.Uri) { UseShellExecute = true });
            };
            core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
            core.WebMessageReceived += OnMessage;
            await RegisterBootstrap();
            core.Navigate(Origin + DesktopEntryPath);
            UpdateGameTopmost(this, EventArgs.Empty); gameMonitor.Start();
        }
        catch (Exception e)
        {
            MessageBox.Show(this, Text("startup") + "\nhttps://go.microsoft.com/fwlink/p/?LinkId=2124703\n\n" + e.Message, Text("desktopTitle", "common"), MessageBoxButton.OK, MessageBoxImage.Error);
            Close();
        }
    }
    private static bool IsLocalOrigin(Uri uri) =>
        uri.Scheme == Uri.UriSchemeHttps && uri.Host == "wuwa.local" && uri.IsDefaultPort;

    private static bool IsTrusted(string source) =>
        Uri.TryCreate(source, UriKind.Absolute, out var uri) &&
        IsLocalOrigin(uri) && uri.AbsolutePath is DesktopEntryPath or "/desktop" or "/desktop/";

    private static void ServeUiResource(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        var environment = ((CoreWebView2)sender!).Environment;
        if (!Uri.TryCreate(e.Request.Uri, UriKind.Absolute, out var uri) || !IsLocalOrigin(uri) || e.Request.Method != "GET")
        {
            e.Response = environment.CreateWebResourceResponse(null, 404, "Not Found", "Cache-Control: no-store");
            return;
        }

        var path = uri.AbsolutePath is "/desktop" or "/desktop/" ? DesktopEntryPath : uri.AbsolutePath;
        var contentType = Path.GetExtension(path) switch
        {
            ".html" => "text/html; charset=utf-8",
            ".js" => "text/javascript; charset=utf-8",
            ".css" => "text/css; charset=utf-8",
            ".ttf" => "font/ttf",
            ".png" => "image/png",
            _ => null,
        };
        var stream = contentType is null ? null : typeof(MainWindow).Assembly.GetManifestResourceStream(UiResourcePrefix + path);
        // WebView2 reads the assembly-backed stream after this handler returns.
        e.Response = stream is null
            ? environment.CreateWebResourceResponse(null, 404, "Not Found", "Cache-Control: no-store")
            : environment.CreateWebResourceResponse(stream, 200, "OK",
                $"Content-Type: {contentType}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff");
    }
    private object State() => new { stage, busy = operation is not null, transferUrl = transfer?.BrowserUrl.AbsoluteUri, error, collectionDiagnostic, history = history.List() };
    private void Emit(string? next = null)
    {
        if (next is not null) stage = next;
        Browser.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { @event = "state", data = State() }, JsonOptions));
    }
    private async void OnMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (!IsTrusted(e.Source)) return;
        string? id = null;
        try
        {
            using var document = JsonDocument.Parse(e.WebMessageAsJson);
            var message = document.RootElement;
            id = message.GetProperty("id").GetString();
            if (string.IsNullOrWhiteSpace(id) || id.Length > 100) return;
            var method = message.GetProperty("method").GetString();
            object? result = null;
            switch (method)
            {
                case "theme.set": ApplyTheme(message.GetProperty("params").GetProperty("dark").GetBoolean()); break;
                case "settings.get": result = settings; break;
                case "state.get": result = State(); break;
                case "preferences.save":
                    var preferences = message.GetProperty("params");
                    var language = preferences.GetProperty("language").GetString();
                    var theme = preferences.GetProperty("theme").GetString();
                    if (language is null || !Locales.ContainsKey(language) || theme is not ("auto" or "light" or "dark")) throw new ArgumentException(Text("invalidSettings"));
                    await SaveSettings(settings with { Language = language, Theme = theme });
                    result = settings; break;
                case "settings.save":
                    var next = message.GetProperty("params").Deserialize<Settings>(JsonOptions) ?? throw new ArgumentException(Text("invalidSettings"));
                    if (next.Language is null || !Locales.ContainsKey(next.Language) || next.GamePath is null) throw new ArgumentException(Text("invalidSettings"));
                    if (operation is not null && next.GamePath != settings.GamePath) throw new InvalidOperationException(Text("running"));
                    await SaveSettings(next with { Language = settings.Language, Theme = settings.Theme });
                    result = settings; break;
                case "game.detect":
                    EnsureIdle(); result = await Task.Run(() => GamePathDetector.Detect(settings.GamePath)); break;
                case "game.choose":
                    EnsureIdle();
                    var gameDialog = new OpenFileDialog { Filter = Text("gameFilter"), FileName = "Wuthering Waves.exe" };
                    if (gameDialog.ShowDialog(this) == true) result = gameDialog.FileName;
                    break;
                case "export.start": EnsureIdle(); _ = RunExport(); break;
                case "history.export":
                    EnsureIdle();
                    var parameters = message.GetProperty("params");
                    var historyId = parameters.GetProperty("id").GetString()!;
                    var format = parameters.GetProperty("format").GetString()!;
                    if (format == "web")
                    {
                        _ = Execute(token => Send(history.Read(historyId).Bytes, token), "sending");
                    }
                    else
                    {
                        if (format != "json") throw new ArgumentException(Text("unsupportedFormat"));
                        var entry = history.Read(historyId).Entry;
                        var saveDialog = new SaveFileDialog
                        {
                            Filter = Text("jsonFilter"),
                            DefaultExt = ".json", AddExtension = true, OverwritePrompt = true,
                            FileName = ExportHistory.JsonFileName(entry)
                        };
                        if (saveDialog.ShowDialog(this) == true) history.SaveJson(historyId, saveDialog.FileName);
                    }
                    break;
                case "history.delete":
                    EnsureIdle();
                    var deleteId = message.GetProperty("params").GetProperty("id").GetString()!;
                    try
                    {
                        if (!history.Delete(deleteId)) throw new InvalidOperationException();
                    }
                    catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or InvalidOperationException)
                    {
                        throw new InvalidOperationException(Text("deleteArchiveError", "common"));
                    }
                    result = State();
                    break;
                case "export.resend":
                    EnsureIdle();
                    var dialog = new OpenFileDialog { Filter = Text("jsonFilter"), InitialDirectory = Directory.Exists(AccountsPath) ? AccountsPath : DataPath };
                    if (dialog.ShowDialog(this) == true) _ = Execute(token => Send(dialog.FileName, token), "sending");
                    break;
                case "export.cancel": StopOperation(); break;
                case "transfer.copyLink":
                    if (transfer is not null) Clipboard.SetText(transfer.BrowserUrl.AbsoluteUri);
                    result = transfer is not null;
                    break;
                case "browser.open": OpenBrowser(); break;
                case "folder.open": Directory.CreateDirectory(AccountsPath); Process.Start(new ProcessStartInfo("explorer.exe") { ArgumentList = { AccountsPath }, UseShellExecute = true }); break;
                case "collection.openDiagnostics":
                    if (collectionDiagnostic?.Directory is { } directory)
                        Process.Start(new ProcessStartInfo("explorer.exe") { ArgumentList = { directory }, UseShellExecute = true });
                    break;
                case "collection.copyDiagnostics":
                    if (collectionDiagnostic is { } diagnostic) Clipboard.SetText(JsonSerializer.Serialize(diagnostic, Json.Options));
                    break;
                default: throw new ArgumentException(Text("unknownCommand"));
            }
            Reply(new { id, result });
        }
        catch (Exception exception) { if (id is not null) Reply(new { id, error = exception.GetBaseException().Message }); }
    }
    private void Reply(object message) => Browser.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message, JsonOptions));
    private async Task RegisterBootstrap()
    {
        var core = Browser.CoreWebView2;
        var script = "if (location.origin === 'https://wuwa.local' && window.top === window) { window.__WUWA_SETTINGS__ = " + JsonSerializer.Serialize(settings, JsonOptions) + "; }";
        var nextId = await core.AddScriptToExecuteOnDocumentCreatedAsync(script);
        if (bootstrapScriptId is not null) core.RemoveScriptToExecuteOnDocumentCreated(bootstrapScriptId);
        bootstrapScriptId = nextId;
    }
    private async Task SaveSettings(Settings next)
    {
        Json.Save(SettingsPath, next);
        settings = next;
        Title = Text("desktopTitle", "common");
        await RegisterBootstrap();
    }
    private void EnsureIdle() { if (operation is not null) throw new InvalidOperationException(Text("running")); }
    private Task RunExport() => Execute(async token =>
    {
        var options = new Options("export", DataPath, settings.GamePath.Trim(), DiagnosticsPath, "auto", 900, new());
        var progress = new Progress<CollectionStage>(phase =>
        {
            if (operation is null || operation.Token != token) return;
            if (token.IsCancellationRequested && phase != CollectionStage.Closing) return;
            Emit(JsonNamingPolicy.CamelCase.ConvertName(phase.ToString()));
        });
        await Task.Run(() => Workflow.Run(options, token, progress, history.Add), token);
    });
    private async Task Execute(Func<CancellationToken, Task> action, string initialStage = "preparing")
    {
        operation = new(); error = null; collectionDiagnostic = null; Emit(initialStage);
        string result = "completed";
        try { await action(operation.Token); }
        catch (OperationCanceledException) { result = "cancelled"; }
        catch (CollectionException exception) when (exception.Diagnostic is { } diagnostic)
        {
            collectionDiagnostic = diagnostic;
            result = exception.Failure switch
            {
                CollectionFailure.GameExited => "gameExited",
                CollectionFailure.CloseFailed => "closeFailed",
                _ => "failed"
            };
        }
        catch (Exception exception)
        {
            result = "failed";
            error = exception.GetBaseException().Message;
            try { Directory.CreateDirectory(DiagnosticsPath); File.WriteAllText(Path.Combine(DiagnosticsPath, "desktop-error.txt"), exception.ToString()); } catch (Exception logError) when (logError is IOException or UnauthorizedAccessException) { }
        }
        finally
        {
            if (transfer is not null) await transfer.DisposeAsync(); transfer = null;
            operation.Dispose(); operation = null; Emit(result);
            bool shouldClose = closeRequested && collectionDiagnostic is null;
            closeRequested = false;
            if (shouldClose) Close();
        }
    }
    private void StopOperation()
    {
        if (operation is null || operation.IsCancellationRequested || stage == "closing") return;
        operation.Cancel();
        if (stage != "sending") Emit("stopping");
    }
    private async Task Send(string path, CancellationToken token)
    {
        if (new FileInfo(path).Length > 32 * 1024 * 1024) throw new InvalidDataException(Text("tooLarge"));
        await Send(await File.ReadAllBytesAsync(path, token), token);
    }
    private async Task Send(byte[] snapshot, CancellationToken token)
    {
        if (snapshot.Length > 32 * 1024 * 1024) throw new InvalidDataException(Text("tooLarge"));
        transfer = await TransferSession.StartAsync(TransferWebsite, snapshot, cancellation: token);
        Emit();
        try { OpenBrowser(); } catch (Win32Exception exception) { error = exception.Message; Emit(); }
        var outcome = await transfer.Completion.WaitAsync(token);
        if (outcome != TransferOutcome.Received) throw new OperationCanceledException();
        error = null;
    }
    private void OpenBrowser() { if (transfer is not null) Process.Start(new ProcessStartInfo(transfer.BrowserUrl.AbsoluteUri) { UseShellExecute = true }); }
    private void UpdateGameTopmost(object? sender, EventArgs e)
    {
        var games = Process.GetProcessesByName("Client-Win64-Shipping");
        try { Topmost = games.Length > 0; } finally { foreach (var game in games) game.Dispose(); }
    }
    private void Window_Closing(object? sender, CancelEventArgs e)
    {
        if (operation is null) return;
        e.Cancel = true; closeRequested = true;
        StopOperation();
    }
}
