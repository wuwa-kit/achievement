using System;
using System.Collections.Generic;
using Graphs;
public static class HeapObjects {
 public sealed class Item {public string Type=string.Empty;public ulong Address;public int Size;public ulong[] Children=new ulong[0];}
 public static List<Item> Load(string path){
  var graph=new GCHeapDump(path).MemoryGraph;
  var node=graph.AllocNodeStorage();var type=graph.AllocTypeNodeStorage();
  var result=new List<Item>();
  for(int i=0;i<(int)graph.NodeIndexLimit;i++){
   graph.GetNode((NodeIndex)i,node);graph.GetType(node.TypeIndex,type);
   if(!type.Name.StartsWith("Achievement",StringComparison.Ordinal) && !type.Name.StartsWith("Aki.Config.Achievement",StringComparison.Ordinal) && type.Name!="MultiTextCsvModule" && type.Name!="TextConfig" && type.Name!="LanguageSystem" && type.Name!="LanguageDefine" && type.Name!="Aki.Config.ConfigMultiTextLang")continue;
   var children=new List<ulong>();
   for(var c=node.GetFirstChildIndex();(int)c>=0;c=node.GetNextChildIndex())children.Add(graph.GetAddress(c));
   result.Add(new Item{Type=type.Name,Address=graph.GetAddress(node.Index),Size=node.Size,Children=children.ToArray()});
  }
  return result;
 }
}
