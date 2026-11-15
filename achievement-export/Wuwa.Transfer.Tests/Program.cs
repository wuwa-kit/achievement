using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Wuwa.Transfer;

var payload = await File.ReadAllBytesAsync(args.Length > 1 ? args[1] : "../fixtures/local/achievements.json");
if (args.FirstOrDefault() == "serve")
{
    await using var server = await TransferSession.StartAsync("http://127.0.0.1:5173", payload);
    await File.WriteAllTextAsync(args[2], server.BrowserUrl.AbsoluteUri);
    Console.WriteLine(await server.Completion);
    return;
}
int checks = 0;
void Check(bool value, string name) { if (!value) throw new Exception(name); checks++; Console.WriteLine("PASS " + name); }
using var client = new HttpClient(new HttpClientHandler { UseProxy = false });
await using var session = await TransferSession.StartAsync("http://127.0.0.1:5173", payload);
async Task<HttpResponseMessage> Send(string path = "export", string? origin = "http://127.0.0.1:5173", string? key = null, string method = "GET", string? host = null, string? id = null)
{
    using var request = new HttpRequestMessage(new HttpMethod(method), $"http://127.0.0.1:{session.Port}/v1/{path}");
    if (origin is not null) request.Headers.Add("Origin", origin);
    request.Headers.Add("Authorization", "Bearer " + (key ?? session.Key));
    if (host is not null) request.Headers.Host = host;
    if (id is not null) request.Content = JsonContent.Create(new { transferId = id });
    if (method == "OPTIONS") { request.Headers.Add("Access-Control-Request-Method", "GET"); request.Headers.Add("Access-Control-Request-Headers", "authorization"); }
    return await client.SendAsync(request);
}
Check((await Send(origin: null)).StatusCode == HttpStatusCode.Forbidden, "missing origin rejected");
Check((await Send(origin: "https://untrusted.example")).StatusCode == HttpStatusCode.Forbidden, "foreign origin rejected");
var hostStatus = (await Send(host: "untrusted.example")).StatusCode;
Check(hostStatus is HttpStatusCode.Forbidden or HttpStatusCode.BadRequest, "foreign host rejected: " + hostStatus);
Check((await Send(key: "bad")).StatusCode == HttpStatusCode.Unauthorized, "wrong key rejected");
Check((await Send(method: "OPTIONS")).StatusCode == HttpStatusCode.NoContent, "CORS preflight supported");
Check((await Send(path: "files")).StatusCode == HttpStatusCode.NotFound, "no filesystem endpoint");
using var received = await Send();
var json = JsonDocument.Parse(await received.Content.ReadAsByteArrayAsync());
Check(received.StatusCode == HttpStatusCode.OK && json.RootElement.GetProperty("payload").GetProperty("count").GetInt32() == JsonDocument.Parse(payload).RootElement.GetProperty("count").GetInt32(), "full real export received");
Check(received.Headers.CacheControl?.NoStore == true, "no store response");
Check(json.RootElement.GetProperty("expiresAt").GetDateTimeOffset() == DateTimeOffset.MaxValue, "non-expiring envelope stays compatible with v1 web clients");
Check((await Send(path: "ack", method: "POST", id: "wrong")).StatusCode == HttpStatusCode.BadRequest, "wrong acknowledgement rejected");
Check(!session.Completion.IsCompleted, "invalid acknowledgement preserves session");
foreach (var (body, expected) in new[] { ("[]", 400), ("{", 400), (new string('x', 1025), 413) })
{
    using var request = new HttpRequestMessage(HttpMethod.Post, $"http://127.0.0.1:{session.Port}/v1/ack");
    request.Headers.Add("Origin", "http://127.0.0.1:5173");
    request.Headers.Add("Authorization", "Bearer " + session.Key);
    request.Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
    using var result = await client.SendAsync(request);
    Check((int)result.StatusCode == expected, "invalid/oversized acknowledgement rejected: " + expected);
}
Check((await Send()).StatusCode == HttpStatusCode.OK, "invalid requests leave transfer usable");
Check((await Send(path: "ack", method: "POST", id: session.TransferId)).StatusCode == HttpStatusCode.NoContent, "acknowledgement accepted");
Check(await session.Completion.WaitAsync(TimeSpan.FromSeconds(5)) == TransferOutcome.Received, "received outcome");
bool closed = false;
try { await Send(); } catch (HttpRequestException) { closed = true; }
Check(closed, "acknowledged listener closes");
await using var cancelled = await TransferSession.StartAsync("https://example.com", payload);
Check(!cancelled.Completion.IsCompleted, "idle transfer awaits acknowledgement or cancellation");
await cancelled.DisposeAsync();
Check(await cancelled.Completion == TransferOutcome.Cancelled, "cancel closes transfer");
bool rejected = false;
try { TransferSession.ValidateWebsite("http://example.com"); } catch (ArgumentException) { rejected = true; }
Check(rejected, "remote HTTP rejected");
Console.WriteLine($"{checks} checks passed");



