using System.Diagnostics;

namespace Wuwa.Export;

internal sealed class ExportTimings(string directory, Action<string> report)
{
    private readonly List<object> entries = [];
    public IDisposable Measure(string name)
    {
        report(name + "…");
        return new Measurement(elapsed =>
        {
            entries.Add(new { stage = name, elapsedMilliseconds = elapsed, recordedAt = DateTimeOffset.Now });
            CollectionRun.TryWriteDiagnostic(() => Json.Save(Path.Combine(directory, "timings.json"), entries));
            report($"{name}：{elapsed / 1000d:F2} 秒");
        });
    }
    private sealed class Measurement(Action<long> complete) : IDisposable
    {
        private readonly Stopwatch watch = Stopwatch.StartNew();
        private bool disposed;
        public void Dispose()
        {
            if (disposed) return;
            disposed = true;
            complete(watch.ElapsedMilliseconds);
        }
    }
}
