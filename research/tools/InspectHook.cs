using System;
using System.IO;
using System.Text;
using System.Reflection;

// Diagnostic-only hook: enumerate metadata, never call game methods or read account fields.
public class StartupHook
{
    public static void Initialize()
    {
        string output=Path.Combine(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location),"managed-achievement-metadata.txt");
        try {
            var text=new StringBuilder();
            foreach(var assembly in AppDomain.CurrentDomain.GetAssemblies()) {
                text.AppendLine("ASSEMBLY "+assembly.GetName().Name);
                if(assembly.IsDynamic)continue;
                Type[] types;
                try { types=assembly.GetTypes(); }
                catch(ReflectionTypeLoadException ex) { types=ex.Types; }
                catch(Exception ex) { text.AppendLine("ERROR "+ex.GetType().Name);continue; }
                foreach(var type in types) {
                    if(type==null || type.FullName==null || type.FullName.IndexOf("Achievement",StringComparison.OrdinalIgnoreCase)<0)continue;
                    text.AppendLine("TYPE "+type.FullName+" BASE "+type.BaseType);
                    const BindingFlags flags=BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Instance|BindingFlags.Static|BindingFlags.DeclaredOnly;
                    foreach(var f in type.GetFields(flags))text.AppendLine("  FIELD "+(f.IsStatic?"static ":"")+f.FieldType+" "+f.Name);
                    foreach(var p in type.GetProperties(flags))text.AppendLine("  PROPERTY "+p.PropertyType+" "+p.Name);
                    foreach(var m in type.GetMethods(flags))text.AppendLine("  METHOD "+m);
                }
            }
            File.WriteAllText(output,text.ToString(),Encoding.UTF8);
        } catch(Exception ex) { try { File.WriteAllText(output,"ERROR "+ex.GetType().Name+": "+ex.Message); }catch{} }
    }
}
