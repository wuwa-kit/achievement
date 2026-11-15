namespace Wuwa.Export;

internal static class RuntimeProfile
{
    public const string Hash = "A70D006791E65CD2A1235C966090AA7CB14C7845405C18ED688B14A6A3F662C0";

    public static void Verify(string path)
    {
        string actual;
        try { actual = Catalog.HashFile(path); }
        catch (Exception error) when (error is FileNotFoundException or DirectoryNotFoundException)
        {
            throw new CollectionException(CollectionFailure.RuntimeMissing, $"Runtime file is missing: {path}", error);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            throw new CollectionException(CollectionFailure.RuntimeUnreadable, $"Cannot read runtime file: {path}", error);
        }
        if (actual != Hash)
            throw new CollectionException(CollectionFailure.UnsupportedRuntime, $"Runtime SHA-256 mismatch for {path}. Expected {Hash}, found {actual}");
    }
}
