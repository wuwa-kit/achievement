using System.ComponentModel;
using System.Text.Json;

namespace Wuwa.Export;

internal enum CollectionPhase { Preflight, Launch, Window, Login, Heap, Model, Validation, Save, Close }

internal enum CollectionFailure
{
    Unexpected, ExporterBusy, GameRunning, GameMissing, RuntimeMissing, RuntimeUnreadable, UnsupportedRuntime,
    GameExited, WindowTimeout, LoginTimeout, HeapFailed, ModelMissing, ModelAmbiguous, FieldMissing,
    MemoryRead, InvalidModel, Unstable, ResourcesChanged, AccountUnknown, AccountChanged, SaveFailed, CloseFailed
}

internal sealed class CollectionException(CollectionFailure failure, string message, Exception? inner = null,
    string? field = null, int? attempts = null) : Exception(message, inner)
{
    public CollectionFailure Failure { get; } = failure;
    public string? Field { get; } = field;
    public int? Attempts { get; } = attempts;
    public CollectionDiagnostic? Diagnostic { get; set; }
}

internal sealed class SnapshotChangedException(string message, bool recapture = false) : Exception(message)
{
    public bool Recapture { get; } = recapture;
}

internal sealed record CollectionDiagnostic(string Id, string Code, string Phase, string? Directory, string Detail,
    string? Field, int? Attempts, int? NativeErrorCode);

internal sealed class CollectionRun(string output)
{
    private string Id { get; } = DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N");
    public string DirectoryPath => Path.Combine(output, "csharp-session-" + Id);
    public string ResultPath => Path.Combine(output, "export-result.json");
    public CollectionPhase Phase { get; set; }
    public uint? Pid { get; set; }

    public CollectionException Fail(Exception error, bool publishResult)
    {
        var failure = error as CollectionException ?? new CollectionException(Phase switch
        {
            CollectionPhase.Heap => CollectionFailure.HeapFailed,
            CollectionPhase.Model when error is Win32Exception or IOException => CollectionFailure.MemoryRead,
            CollectionPhase.Model => CollectionFailure.InvalidModel,
            CollectionPhase.Save => CollectionFailure.SaveFailed,
            _ => CollectionFailure.Unexpected
        }, error.Message, error);
        var diagnostic = new CollectionDiagnostic(Id, CamelCase(failure.Failure), CamelCase(Phase), DirectoryPath,
            failure.Message, failure.Field, failure.Attempts, (failure.GetBaseException() as Win32Exception)?.NativeErrorCode);
        var completedAt = DateTimeOffset.Now.ToString("o");
        bool logged = TryWriteDiagnostic(() => Json.Save(Path.Combine(DirectoryPath, "collection-error.json"),
            new { diagnostic, pid = Pid, completedAt, exception = error.ToString() }));
        if (!logged && !Directory.Exists(DirectoryPath)) diagnostic = diagnostic with { Directory = null };
        failure.Diagnostic = diagnostic;
        if (publishResult)
            TryWriteDiagnostic(() => Json.Save(ResultPath, new { success = false, backend = "csharp", pid = Pid, run = diagnostic.Directory, error = failure.Message, diagnostic, completedAt }));
        return failure;
    }

    internal static bool TryWriteDiagnostic(Action write)
    {
        try { write(); return true; }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException) { return false; }
    }

    private static string CamelCase<T>(T value) where T : Enum => JsonNamingPolicy.CamelCase.ConvertName(value.ToString());
}
