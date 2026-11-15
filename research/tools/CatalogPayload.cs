using System;
using System.IO;
using System.Text;
using System.Reflection;
using System.Threading;
using System.Collections.Generic;
using System.Collections;

// Only configuration getters are invoked. No achievement, reward-claim or account mutation APIs.
public static class CatalogPayload {
 static readonly string Folder=Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
 static SynchronizationContext context;
 static MethodInfo achievement, star, drop, text, item;
 static string[] ids,languages;
 static int position;
 static int started;
 static readonly List<string> rows=new List<string>();
 static readonly List<int> missing=new List<int>();
 static int missingTexts,missingRewards;
 static object model;
 static MethodInfo groupConfig,getData,getGroupData;
 static readonly Dictionary<int,int> categories=new Dictionary<int,int>();
 static readonly Dictionary<int,string> groups=new Dictionary<int,string>();
 static readonly Dictionary<int,int> groupCategories=new Dictionary<int,int>();
 static readonly Dictionary<int,bool> groupVisibility=new Dictionary<int,bool>();
 static readonly List<string> categoryRows=new List<string>();
 static Type Find(string name){foreach(var a in AppDomain.CurrentDomain.GetAssemblies()){var t=a.GetType(name,false);if(t!=null)return t;}throw new Exception("Type not loaded: "+name);}
 static MethodInfo Getter(string name){var t=Find(name);var m=t.GetMethod("GetConfig",BindingFlags.Public|BindingFlags.Static,null,new Type[]{typeof(int),typeof(bool)},null);if(m==null)throw new Exception("Missing config getter: "+name);return m;}
 static object Config(MethodInfo m,int id){return m.Invoke(null,new object[]{id,true});}
 static object Prop(object value,string name){if(value==null)throw new Exception("Null configuration: "+name);var p=value.GetType().GetProperty(name);if(p==null)throw new Exception("Missing property: "+name);return p.GetValue(value,null);}
 static int Number(object value,string name){return Convert.ToInt32(Prop(value,name));}
 static string Str(object value,string name){return (string)Prop(value,name);}
 static string Q(string value){if(value==null)return "null";var b=new StringBuilder("\"");foreach(char c in value){switch(c){case '\\':b.Append("\\\\");break;case '"':b.Append("\\\"");break;case '\n':b.Append("\\n");break;case '\r':b.Append("\\r");break;case '\t':b.Append("\\t");break;default:if(c<32)b.Append("\\u"+((int)c).ToString("x4"));else b.Append(c);break;}}return b.Append('"').ToString();}
 static string Local(string key,string language){var value=(string)text.Invoke(null,new object[]{key,language});if(value==null||value.StartsWith("text not found|",StringComparison.Ordinal)){missingTexts++;return null;}return value;}
 static string Titles(string key){var output=new List<string>();foreach(string l in languages)output.Add(Q(l)+":{\"title\":"+Q(Local(key,l))+"}");return "{"+string.Join(",",output.ToArray())+"}";}
 static void InitHierarchy(){
  var modelType=Find("AchievementModel");model=modelType.GetProperty("Instance").GetValue(null,null);if(model==null)throw new Exception("Achievement model not initialized");
  getData=modelType.GetMethod("GetAchievementData",new Type[]{typeof(int)});getGroupData=modelType.GetMethod("GetAchievementGroupData",new Type[]{typeof(int?)});
  groupConfig=Getter("Aki.Config.ConfigAchievementGroupById");
  var groupsByCategory=Find("Aki.Config.ConfigAchievementGroupByCategory").GetMethod("GetConfigList",new Type[]{typeof(int),typeof(bool)});
  var achievementsByGroup=Find("Aki.Config.ConfigAchievementByGroupId").GetMethod("GetConfigList",new Type[]{typeof(int),typeof(bool)});
  var configuredIds=new Dictionary<int,bool>();
  var all=Find("Aki.Config.ConfigAchievementCategoryAll").GetMethod("GetConfigList",new Type[]{typeof(bool)});
  foreach(object c in (IEnumerable)all.Invoke(null,new object[]{true})){
   int id=Number(c,"Id"),function=Number(c,"FunctionType");string key=Str(c,"Name");categories[id]=function;
   categoryRows.Add("{\"id\":"+id+",\"functionType\":"+function+",\"inMainMenu\":"+(function==1?"true":"false")+",\"titleKey\":"+Q(key)+",\"texts\":"+Titles(key)+"}");
   var categoryGroups=(IEnumerable)groupsByCategory.Invoke(null,new object[]{id,true});
   if(categoryGroups==null)continue;
   foreach(object g in categoryGroups){
    int groupId=Number(g,"Id");EnsureGroup(groupId);
    var entries=(IEnumerable)achievementsByGroup.Invoke(null,new object[]{groupId,true});
    if(entries!=null)foreach(object a in entries)configuredIds.Add(Number(a,"Id"),true);
   }
  }
  // The model is lazy: e.g. 400205 is absent until the achievement menu asks for it.
  // Query every configured ID, preserving live IDs first; missing progress stays nullable.
  var requestedIds=new Dictionary<int,bool>();var allIds=new List<string>(ids);
  foreach(string id in ids){int value=int.Parse(id,System.Globalization.CultureInfo.InvariantCulture);if(!configuredIds.ContainsKey(value))throw new Exception("Live ID missing from configuration: "+id);requestedIds.Add(value,true);}
  foreach(int id in configuredIds.Keys)if(!requestedIds.ContainsKey(id))allIds.Add(id.ToString(System.Globalization.CultureInfo.InvariantCulture));
  ids=allIds.ToArray();
 }
 static int EnsureGroup(int id){
  if(groupCategories.ContainsKey(id))return groupCategories[id];
  var c=Config(groupConfig,id);if(c==null)throw new Exception("Missing group "+id);
  int category=Number(c,"Category");string key=Str(c,"Name");bool enabled=(bool)Prop(c,"Enable");
  object state=getGroupData.Invoke(model,new object[]{(int?)id});bool show=state!=null&&(bool)state.GetType().GetMethod("GetShowState").Invoke(state,null);
  groupCategories[id]=category;groupVisibility[id]=show;
  groups[id]="{\"id\":"+id+",\"categoryId\":"+category+",\"sort\":"+Number(c,"Sort")+",\"enabled\":"+(enabled?"true":"false")+",\"visibleForAccount\":"+(show?"true":"false")+",\"titleKey\":"+Q(key)+",\"texts\":"+Titles(key)+"}";
  return category;
 }
 static string Visibility(int id,int group,int category,bool hidden){
  object data=getData.Invoke(model,new object[]{id});if(data==null)throw new Exception("Missing live achievement "+id);
  Type t=data.GetType();bool show=(bool)t.GetMethod("GetShowState").Invoke(data,null);string finish=t.GetMethod("GetFinishState").Invoke(data,null).ToString();
  int previous=(int)t.GetField("LastAchievementId",BindingFlags.NonPublic|BindingFlags.Instance).GetValue(data);
  int next=(int)t.GetField("NextAchievementId",BindingFlags.NonPublic|BindingFlags.Instance).GetValue(data);
  bool main=categories.ContainsKey(category)&&categories[category]==1;
  string reason="visible";
  if(!main)reason="outside_main_menu";else if(!groupVisibility[group])reason="group_unavailable";
  else if(t.GetField("MaxProgress",BindingFlags.NonPublic|BindingFlags.Instance).GetValue(data)==null)reason="progress_unavailable";
  else if(hidden&&finish=="UnFinished")reason="hidden_until_completed";
  else if(!show&&finish=="HaveGetReward"&&next>0)reason="replaced_by_next_stage";
  else if(!show&&previous!=-1)reason="previous_reward_unclaimed";
  else if(!show)reason="client_filtered";
  return "\"inMainMenu\":"+(main?"true":"false")+",\"visibleForAccount\":"+(main&&groupVisibility[group]&&show?"true":"false")+",\"visibilityReason\":"+Q(reason)+",\"clientState\":"+Q(finish)+",\"previousId\":"+previous;
 }
 static void Status(string state){File.WriteAllText(Path.Combine(Folder,"catalog-status.json"),"{\"state\":"+Q(state)+",\"processed\":"+position+",\"total\":"+(ids==null?0:ids.Length)+"}",Encoding.UTF8);}
 static void Fail(Exception e){try{File.WriteAllText(Path.Combine(Folder,"catalog-error.txt"),e.ToString(),Encoding.UTF8);Status("failed");}catch{}}
 public static void Run(){
  try{
   if(Interlocked.Exchange(ref started,1)!=0)throw new Exception("Catalog query already started in this assembly instance");
   ids=File.ReadAllLines(Path.Combine(Folder,"catalog-ids.txt"));languages=File.ReadAllLines(Path.Combine(Folder,"catalog-languages.txt"));
   if(ids.Length<1||ids.Length>10000||languages.Length<1||languages.Length>30)throw new Exception("Input bounds");
   achievement=Getter("Aki.Config.ConfigAchievementById");star=Getter("Aki.Config.ConfigAchievementStarLevelByLevel");drop=Getter("Aki.Config.ConfigDropPackageById");item=Getter("Aki.Config.ConfigItemInfoById");
   text=Find("Aki.Config.ConfigMultiTextLang").GetMethod("GetLocalTextNew",new Type[]{typeof(string),typeof(string)});
   if(text==null)throw new Exception("Missing language getter");
   var syncType=Find("Sharphereal.UniTaskExtensions.Threading.Tasks.UniTaskSynchronizationContext");
   context=(SynchronizationContext)Activator.CreateInstance(syncType,true);
   Status("queued-on-game-thread");context.Post(Batch,null);
  }catch(Exception e){Fail(e);}
 }
 static void Batch(object unused){
  try{
   int end=Math.Min(position+4,ids.Length);
   if(position==0)InitHierarchy();
   for(;position<end;position++){
    int id=int.Parse(ids[position],System.Globalization.CultureInfo.InvariantCulture);object config=Config(achievement,id);
    if(config==null){missing.Add(id);continue;}
    if(Number(config,"Id")!=id)throw new Exception("ID mismatch");
    string title=Str(config,"Name"),description=Str(config,"Desc");int level=Number(config,"Level"),dropId=Number(config,"OverrideDropId");
    if(dropId<=0){var s=Config(star,level);if(s!=null)dropId=Number(s,"DropId");}
    var reward=dropId>0?Config(drop,dropId):null;var rewards=new List<string>();int? astrite=null;
    if(reward!=null){
     astrite=0;int n=Number(reward,"DropPreviewLength");if(n<0||n>100)throw new Exception("Drop preview bound");
     var get=reward.GetType().GetMethod("DropPreview",new Type[]{typeof(int)});
     for(int i=0;i<n;i++){object pair=get.Invoke(reward,new object[]{i});int key=Number(pair,"Key"),count=Number(pair,"Value");if(count<0)throw new Exception("Negative reward");rewards.Add("{\"itemId\":"+key+",\"quantity\":"+count+"}");if(key==3)astrite+=count;}
    }else missingRewards++;
    var localized=new List<string>();foreach(string language in languages){if(string.IsNullOrWhiteSpace(language))throw new Exception("Empty language");localized.Add(Q(language)+":{\"title\":"+Q(Local(title,language))+",\"description\":"+Q(Local(description,language))+"}");}
    int groupId=Number(config,"GroupId"),categoryId=EnsureGroup(groupId);bool hidden=(bool)Prop(config,"Hidden");
    rows.Add("{\"id\":"+id+",\"groupId\":"+groupId+",\"categoryId\":"+categoryId+",\"hidden\":"+(hidden?"true":"false")+",\"nextLink\":"+Number(config,"NextLink")+","+Visibility(id,groupId,categoryId,hidden)+",\"titleKey\":"+Q(title)+",\"descriptionKey\":"+Q(description)+",\"level\":"+level+",\"dropId\":"+dropId+",\"astrite\":"+(astrite.HasValue?astrite.Value.ToString():"null")+",\"rewards\":["+string.Join(",",rewards.ToArray())+"],\"texts\":{"+string.Join(",",localized.ToArray())+"}}");
   }
   Status("reading");
   if(position<ids.Length){context.Post(Batch,null);return;}
   // Verify item 3 through the same client item and text configuration.
   var currency=Config(item,3);string currencyKey=currency==null?null:Str(currency,"Name");
   var names=new List<string>();foreach(string language in languages)names.Add(Q(language)+":"+Q(currencyKey==null?null:Local(currencyKey,language)));
   var langs=new List<string>();foreach(string language in languages)langs.Add(Q(language));
   var missingIds=new List<string>();foreach(int id in missing)missingIds.Add(id.ToString());
   string output="{\"schemaVersion\":1,\"source\":\"client-config-api\",\"complete\":"+((missing.Count==0&&missingTexts==0&&missingRewards==0)?"true":"false")+",\"requestedCount\":"+ids.Length+",\"count\":"+rows.Count+",\"missingTextCount\":"+missingTexts+",\"missingRewardCount\":"+missingRewards+",\"missingIds\":["+string.Join(",",missingIds.ToArray())+"],\"languages\":["+string.Join(",",langs.ToArray())+"],\"astriteItem\":{\"id\":3,\"names\":{"+string.Join(",",names.ToArray())+"}},\"achievements\":["+string.Join(",",rows.ToArray())+"]}";
   output=output.Substring(0,output.Length-1)+",\"categories\":["+string.Join(",",categoryRows.ToArray())+"],\"groups\":["+string.Join(",",new List<string>(groups.Values).ToArray())+"]}";
   File.WriteAllText(Path.Combine(Folder,"achievement-catalog.runtime.json"),output,Encoding.UTF8);Status("complete");
  }catch(Exception e){Fail(e);}
 }
}
