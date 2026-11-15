using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Wuwa.Transfer;

public enum TransferOutcome { Received, Cancelled }

/// <summary>A loopback-only transfer that runs until acknowledged or stopped.</summary>
public sealed class TransferSession : IAsyncDisposable
{
    private readonly HttpListener listener = new();
    private readonly SemaphoreSlim requests = new(16);
    private readonly string origin;
    private readonly byte[] key;
    private readonly byte[] envelope;
    private readonly CancellationTokenSource lifetime = new();
    private readonly TaskCompletionSource<TransferOutcome> completion = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private int consumed;
    private int disposed;
    public string TransferId { get; } = Guid.NewGuid().ToString("N");
    public string Key { get; } = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(32));
    public int Port { get; private set; }
    public Uri BrowserUrl { get; private set; } = null!;
    public Task<TransferOutcome> Completion => completion.Task;

    public static Uri ValidateWebsite(string address)
    {
        if (!Uri.TryCreate(address.Trim(), UriKind.Absolute, out var uri) ||
            !(uri.Scheme == "https" || uri.Scheme == "http" && uri.IsLoopback) ||
            uri.UserInfo.Length != 0 || uri.Fragment.Length != 0 || uri.Query.Length != 0)
            throw new ArgumentException("网站地址应为 HTTPS；本机联调可使用 http://127.0.0.1:5173。请勿包含查询参数或 #", nameof(address));
        return uri;
    }

    private TransferSession(Uri website, byte[] payload)
    {
        if (payload.Length > 32 * 1024 * 1024) throw new InvalidDataException("导出文件超过 32 MB");
        using var document = JsonDocument.Parse(payload);
        var root = document.RootElement;
        if (root.GetProperty("schemaVersion").GetInt32() is not (2 or 3) || !root.GetProperty("complete").GetBoolean() ||
            root.GetProperty("count").GetInt32() != root.GetProperty("achievements").GetArrayLength())
            throw new InvalidDataException("需要完整的 v2 或 v3 成就导出文件");
        origin = website.GetLeftPart(UriPartial.Authority);
        key = Encoding.ASCII.GetBytes(Key);
        // Older web clients require a future expiresAt in the v1 envelope.
        envelope = JsonSerializer.SerializeToUtf8Bytes(new { version = 1, transferId = TransferId, expiresAt = DateTimeOffset.MaxValue, payload = root });
    }

    public static async Task<TransferSession> StartAsync(string website, byte[] payload, CancellationToken cancellation = default)
    {
        var target = ValidateWebsite(website);
        var session = new TransferSession(target, payload);
        try
        {
            cancellation.ThrowIfCancellationRequested();
            // HTTP.sys owns parsing; probe an ephemeral port, retry if another process takes it.
            for (int attempt = 0; ; attempt++)
            {
                using var probe = new System.Net.Sockets.TcpListener(IPAddress.Loopback, 0);
                probe.Start();
                session.Port = ((IPEndPoint)probe.LocalEndpoint).Port;
                probe.Stop();
                session.listener.Prefixes.Clear();
                session.listener.Prefixes.Add($"http://127.0.0.1:{session.Port}/");
                try { session.listener.Start(); break; }
                catch (HttpListenerException error) when (attempt < 4 && error.ErrorCode == 183) { }
            }
            session.BrowserUrl = new UriBuilder(target) { Fragment = $"handoff=v1&port={session.Port}&key={session.Key}" }.Uri;
            _ = session.ListenAsync();
            return session;
        }
        catch { await session.DisposeAsync(); throw; }
    }

    private async Task ListenAsync()
    {
        try
        {
            while (listener.IsListening)
            {
                var context = await listener.GetContextAsync();
                if (!requests.Wait(0)) { context.Response.StatusCode = 503; context.Response.Close(); continue; }
                _ = ServeAsync(context);
            }
        }
        catch (Exception error) when (error is HttpListenerException or ObjectDisposedException) { }
    }

    private async Task ServeAsync(HttpListenerContext context)
    {
        bool acknowledged = false;
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token);
        deadline.CancelAfter(TimeSpan.FromSeconds(10));
        using var abort = deadline.Token.Register(() => context.Response.Abort());
        try { acknowledged = await HandleRequest(context, deadline.Token); }
        catch (Exception error) when (error is IOException or HttpListenerException or OperationCanceledException or ObjectDisposedException)
        { context.Response.Abort(); }
        finally
        {
            try { context.Response.Close(); } catch (Exception error) when (error is HttpListenerException or ObjectDisposedException) { }
            requests.Release();
        }
        if (acknowledged) Close(TransferOutcome.Received);
    }

    private async Task<bool> HandleRequest(HttpListenerContext context, CancellationToken cancellation)
    {
        var request = context.Request;
        var response = context.Response;
        response.Headers["Cache-Control"] = "no-store";
        response.Headers["Referrer-Policy"] = "no-referrer";
        // Checking Origin server-side also rejects requests that cannot read CORS responses.
        if (!IPAddress.IsLoopback(request.RemoteEndPoint.Address) ||
            request.Headers.GetValues("Origin")?.Length != 1 || request.Headers["Origin"] != origin ||
            request.Headers["Host"] != $"127.0.0.1:{Port}")
        { response.StatusCode = 403; return false; }
        if ((request.Headers.ToString()?.Length ?? 0) > 8192) { response.StatusCode = 431; return false; }
        response.Headers["Access-Control-Allow-Origin"] = origin;
        response.Headers["Vary"] = "Origin";
        if (request.Url!.AbsolutePath != "/v1/export" && request.Url!.AbsolutePath != "/v1/ack") { response.StatusCode = 404; return false; }
        if (request.HttpMethod == "OPTIONS")
        {
            string method = request.Headers["Access-Control-Request-Method"] ?? "";
            string[] headers = (request.Headers["Access-Control-Request-Headers"] ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (method != (request.Url!.AbsolutePath == "/v1/export" ? "GET" : "POST") || headers.Any(h => !h.Equals("authorization", StringComparison.OrdinalIgnoreCase) && !h.Equals("content-type", StringComparison.OrdinalIgnoreCase)))
            { response.StatusCode = 403; return false; }
            response.Headers["Access-Control-Allow-Methods"] = "GET, POST";
            response.Headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
            response.StatusCode = 204; return false;
        }
        string authorization = request.Headers["Authorization"] ?? "";
        byte[] supplied = Encoding.ASCII.GetBytes(authorization.StartsWith("Bearer ", StringComparison.Ordinal) ? authorization[7..] : "");
        if (!CryptographicOperations.FixedTimeEquals(key, supplied)) { response.StatusCode = 401; return false; }
        if (Volatile.Read(ref consumed) != 0) { response.StatusCode = 410; return false; }
        if (request.Url!.AbsolutePath == "/v1/export" && request.HttpMethod == "GET")
        {
            response.ContentType = "application/json; charset=utf-8";
            response.ContentLength64 = envelope.Length;
            await response.OutputStream.WriteAsync(envelope, cancellation);
        }
        else if (request.Url!.AbsolutePath == "/v1/ack" && request.HttpMethod == "POST")
        {
            if (!string.Equals(request.ContentType?.Split(';')[0].Trim(), "application/json", StringComparison.OrdinalIgnoreCase)) { response.StatusCode = 415; return false; }
            try
            {
                if (request.ContentLength64 > 1024) { response.StatusCode = 413; return false; }
                byte[] buffer = new byte[1025];
                int length = 0, read;
                while (length < buffer.Length && (read = await request.InputStream.ReadAsync(buffer.AsMemory(length), cancellation)) > 0) length += read;
                if (length > 1024) { response.StatusCode = 413; return false; }
                using var body = JsonDocument.Parse(buffer.AsMemory(0, length));
                if (body.RootElement.ValueKind != JsonValueKind.Object) { response.StatusCode = 400; return false; }
                if (!body.RootElement.TryGetProperty("transferId", out var id) || id.ValueKind != JsonValueKind.String || id.GetString() != TransferId)
                { response.StatusCode = 400; return false; }
            }
            catch (JsonException) { response.StatusCode = 400; return false; }
            if (Interlocked.CompareExchange(ref consumed, 1, 0) != 0) { response.StatusCode = 410; return false; }
            response.StatusCode = 204;
            return true;
        }
        else response.StatusCode = 405;
        return false;
    }

    public ValueTask DisposeAsync()
    {
        Close(TransferOutcome.Cancelled);
        return new ValueTask(completion.Task);
    }

    private void Close(TransferOutcome outcome)
    {
        if (Interlocked.Exchange(ref disposed, 1) != 0) return;
        lifetime.Cancel();
        listener.Close();
        completion.TrySetResult(outcome);
    }
}
