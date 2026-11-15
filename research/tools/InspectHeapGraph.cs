using System;
using System.Collections.Generic;
using System.Text;
using Graphs;

public static class InspectHeapGraph
{
    public static string Inspect(string path)
    {
        var dump=new GCHeapDump(path);var graph=dump.MemoryGraph;
        var text=new StringBuilder();
        text.AppendLine("CompleteAchievementExport\tfalse");
        text.AppendLine("ScalarFieldValuesAvailable\tfalse");
        text.AppendLine("GraphNodes\t"+graph.NodeCount);
        text.AppendLine("AverageCountMultiplier\t"+dump.AverageCountMultiplier);
        text.AppendLine("AverageSizeMultiplier\t"+dump.AverageSizeMultiplier);
        var node=graph.AllocNodeStorage();var type=graph.AllocTypeNodeStorage();
        var relevant=new Dictionary<NodeTypeIndex,string>();var counts=new Dictionary<NodeTypeIndex,int>();
        var modelNodes=new List<NodeIndex>();
        for(int i=0;i<(int)graph.NodeTypeIndexLimit;i++) {
            graph.GetType((NodeTypeIndex)i,type);string name=type.Name;
            if(name=="AchievementModel"||name=="AchievementData"||name=="AchievementGroupData"||name=="AchievementCategoryData"||name.StartsWith("Aki.Protocol.Achievement",StringComparison.Ordinal)) {
                relevant[type.Index]=name;counts[type.Index]=0;text.AppendLine("TYPE\t"+i+"\t"+type.ModuleName+"\t"+name);
            }
        }
        for(int i=0;i<(int)graph.NodeIndexLimit;i++) {
            graph.GetNode((NodeIndex)i,node);
            if(relevant.ContainsKey(node.TypeIndex)){counts[node.TypeIndex]++;if(relevant[node.TypeIndex]=="AchievementModel")modelNodes.Add(node.Index);}
        }
        foreach(var pair in counts)text.AppendLine("COUNT\t"+relevant[pair.Key]+"\t"+pair.Value);
        var visited=new HashSet<NodeIndex>();var queue=new Queue<Tuple<NodeIndex,int>>();
        foreach(var index in modelNodes){queue.Enqueue(Tuple.Create(index,0));text.AppendLine("MODEL_ADDRESS\t0x"+graph.GetAddress(index).ToString("X"));}
        var summary=new SortedDictionary<string,int>();
        while(queue.Count>0 && visited.Count<20000) {
            var current=queue.Dequeue();if(!visited.Add(current.Item1))continue;
            graph.GetNode(current.Item1,node);graph.GetType(node.TypeIndex,type);
            string name=type.Name;string key=current.Item2+"\t"+name;
            if(!summary.ContainsKey(key))summary[key]=0;summary[key]++;
            bool container=name.StartsWith("System.Collections.Generic.",StringComparison.Ordinal)||name.StartsWith("Achievement",StringComparison.Ordinal);
            if(!container||current.Item2>=5)continue;
            for(var child=node.GetFirstChildIndex();(int)child>=0;child=node.GetNextChildIndex())queue.Enqueue(Tuple.Create(child,current.Item2+1));
        }
        foreach(var pair in summary)text.AppendLine("REACHABLE\t"+pair.Key+"\t"+pair.Value);
        return text.ToString();
    }
}
