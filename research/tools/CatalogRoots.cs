using System;
using System.Collections.Generic;
using Graphs;
public static class CatalogRoots {
 public sealed class Item {public string Type;public ulong Address;public int Size;public ulong[] Children;}
 public static List<Item> Load(string path){
  var g=new GCHeapDump(path).MemoryGraph;var n=g.AllocNodeStorage();var t=g.AllocTypeNodeStorage();var list=new List<Item>();var counts=new Dictionary<string,int>();
  for(int i=0;i<(int)g.NodeIndexLimit;i++){
   g.GetNode((NodeIndex)i,n);g.GetType(n.TypeIndex,t);string name=t.Name;
   if(!(name.StartsWith("[static var ConfigCommon.")||name.StartsWith("[static var Aki.Config.ConfigAchievement")||name.StartsWith("[static var Aki.Config.ConfigMultiText")||name.StartsWith("TrimLru<")||name=="Google.FlatBuffers.ByteBuffer"||name=="Google.FlatBuffers.ByteArrayAllocator"||name=="CSharpScript.Game.Manager.ConfigManager"))continue;
   int count;counts.TryGetValue(name,out count);counts[name]=count+1;if(count>=3)continue;
   var c=new List<ulong>();for(var x=n.GetFirstChildIndex();(int)x>=0;x=n.GetNextChildIndex())c.Add(g.GetAddress(x));
   list.Add(new Item{Type=name,Address=g.GetAddress(n.Index),Size=n.Size,Children=c.ToArray()});
  }return list;
 }
}
