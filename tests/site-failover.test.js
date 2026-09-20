"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const guardApi = require("../resources/js/site-failover.js");
const catalog = [
  {key:"bad",node:"bad",subscriptionId:"a"}, {key:"same",node:"same",subscriptionId:"a"},
  {key:"shared",node:"shared",subscriptionId:"b",subscriptionIds:["a","b"]},
  {key:"best",node:"best",subscriptionId:"b"}, {key:"second",node:"second",subscriptionId:"b"},
  {key:"third",node:"third",subscriptionId:"c"}
];
const score = (tokPerSec, extra={}) => ({status:"done",tokPerSec,profileKey:"p",verified:true,sampleCount:3,successRate:1,
  measuredAt:1000,requestedModel:"m",resolvedModel:"m",resolvedModelVerified:true,...extra});
const history = new Map([["same",score(9999)],["shared",score(9998)],["best",score(100)],["second",score(80)],["third",score(90)]]);
function fixture(extra = {}) {
  let time = 100000, current = "bad", switches = [], logs = [], candidateReads = 0, revision = 0;
  const config = { siteFailoverEnabled:true, siteFailoverTargets:"chatgpt.com", siteFailoverThreshold:2,
    siteFailoverWindowSeconds:60, siteFailoverCooldownSeconds:180 };
  const guard=guardApi.createGuard({now:()=>time,log:s=>logs.push(s),settings:()=>config,
    snapshot:()=>({ready:true,node:current,revision}),candidates:async excluded=>{candidateReads++;return guardApi.rankHistoricalAlternates(catalog,history,current,catalog.map(e=>e.node),excluded);},
    select:async(node,context)=>{switches.push({node,context});current=node;return true;},...extra});
  const event=(id,host="chatgpt.com",node="bad",error="connection upload closed: write tcp 192.168.1.133:123->3.1.218.116:45945: wsasend: An established connection was aborted by the software in your host machine.")=>{
    guard.ingest("info",`[${id} 0ms] outbound/${node==="direct"?"direct":"vmess"}[${node}]: outbound connection to ${host}:443`);
    return guard.ingest("error",`[${id} 19.32s] connection: ${error}`);
  };
  return {guard,event,logs,switches,config,reads:()=>candidateReads,advance:n=>time+=n,manual:node=>{current=node;revision++;}};
}
test("custom website list validates and suffix matching respects DNS labels",()=>{
  const t=guardApi.parseTargets("chatgpt.com\nhttps://api.example.com/health\nchatgpt.com");assert.equal(t.length,2);
  assert.equal(guardApi.matchTarget(t,"a.chatgpt.com").host,"chatgpt.com");
  for(const host of ["evilchatgpt.com","chatgpt.com.evil.org"])assert.equal(guardApi.matchTarget(t,host),null);
  for(const input of ["http://chatgpt.com","https://user:secret@a.com","https://a.com/?token=x","https://127.0.0.1","https://localhost","","a..com"])assert.throws(()=>guardApi.parseTargets(input));
});
test("historical champion comes from another subscription; shared deduplicated node is excluded",()=>{
  const r=guardApi.rankHistoricalAlternates(catalog,history,"bad",catalog.map(e=>e.node));
  assert.deepEqual(r.entries.map(e=>e.node),["best","third"]);
  assert.deepEqual(guardApi.rankHistoricalAlternates(catalog,history,"bad",["third"]).entries.map(e=>e.node),["third"]);
});
test("latest compatible profile only; retained success survives local benchmark failure",()=>{
  const h=new Map(history);h.set("third",score(10,{profileKey:"new",measuredAt:2000,lastAttempt:{status:"error",failureScope:"local"}}));
  assert.deepEqual(guardApi.rankHistoricalAlternates(catalog,h,"bad",catalog.map(e=>e.node)).entries.map(e=>e.node),["third"]);
});
test("without valid history, randomly choose another subscription then a live node; never probe",()=>{
  const r=guardApi.rankHistoricalAlternates(catalog,new Map(),"bad",catalog.map(e=>e.node),new Set(),()=>0);
  assert.equal(r.entries[0].node,"best");assert.equal(r.entries[0].result,null);assert.match(r.reason,/random.*fallback/);
  const c=guardApi.rankHistoricalAlternates(catalog,new Map(),"bad",catalog.map(e=>e.node),new Set(["best","second"]),()=>0);
  assert.equal(c.entries[0].node,"third");
  assert.equal(guardApi.rankHistoricalAlternates(catalog,new Map(),"bad",["bad","same","shared"]).entries.length,0);
});
test("04:01 signature: two unique correlated failures directly select history winner, zero probes",async()=>{
  const f=fixture();await f.event(1);assert.equal(f.switches.length,0);await f.event(2);
  assert.equal(f.switches.length,1);assert.equal(f.switches[0].node,"best");assert.equal(f.reads(),1);assert.ok(f.logs.some(l=>l.includes("probes=0")));
});
test("unrelated, direct, local cancellation, stale-node errors and duplicate IDs never trigger",async()=>{
  const f=fixture();for(let i=0;i<3;i++){
    await f.event(i+10,"chatgpt.com.evil");await f.event(i+20,"chatgpt.com","direct");await f.event(i+30,"chatgpt.com","other");
    await f.event(i+40,"chatgpt.com","bad","read tcp 127.0.0.1:1->127.0.0.1:2: connection reset");await f.event(i+50,"chatgpt.com","bad","context canceled");}
  await f.event(80);await f.event(80);assert.equal(f.switches.length,0);
});
test("disabled guard and expired evidence do not switch; threshold 1 is configurable",async()=>{
  const f=fixture();f.config.siteFailoverEnabled=false;await f.event(1);await f.event(2);assert.equal(f.reads(),0);
  f.config.siteFailoverEnabled=true;await f.event(3);f.advance(61000);await f.event(4);assert.equal(f.switches.length,0);
  f.config.siteFailoverThreshold=1;await f.event(5);assert.equal(f.switches.length,1);
});
test("cooldown prevents ping-pong and no-candidate branch is logged",async()=>{
  const f=fixture({candidates:async()=>({entries:[],reason:"no other-subscription node"})});await f.event(1);await f.event(2);
  assert.equal(f.switches.length,0);assert.ok(f.logs.some(l=>l.includes("no other-subscription")));
  await f.event(3);await f.event(4);assert.ok(f.logs.some(l=>l.includes("cooldown")));
});
test("manual selection or setting changes cancel in-flight recovery; one recovery at a time",async()=>{
  for(const kind of ["manual","settings","concurrent"]){
    let release;const gate=new Promise(r=>release=r);const f=fixture({candidates:async()=>{await gate;return guardApi.rankHistoricalAlternates(catalog,history,"bad",catalog.map(e=>e.node));}});
    await f.event(1);const pending=f.event(2),also=f.event(3);
    if(kind==="manual")f.manual("manual-node");if(kind==="settings")f.config.siteFailoverEnabled=false;
    release();await Promise.all([pending,also]);assert.equal(f.switches.length,kind==="concurrent"?1:0);
  }
});
test("unknown attribution is observable and connection map is bounded",()=>{
  const f=fixture();f.guard.ingest("error","[123 1s] connection: connection reset");assert.ok(f.logs.some(l=>l.includes("unattributed")));
  for(let i=0;i<6000;i++)f.guard.ingest("info",`[${i} 0ms] outbound/vmess[bad]: outbound connection to unrelated.com:443`);
  assert.ok(f.guard.stats().connections<=5000);
});
function appFixture(){
  const source=fs.readFileSync(require("node:path").join(__dirname,"../resources/js/main.js"),"utf8");
  const paths=[],logs=[];let selected="bad";
  const context=vm.createContext({window:{__SMART_PROXY_TEST__:true},console,Map,Set,Date,Promise,JSON,Math,Array,Object,URL,AbortController,TextEncoder,performance,
    SmartProxyConfig:require("../resources/js/config-helpers.js"),SmartProxySiteFailover:guardApi,setTimeout,clearTimeout,setInterval,clearInterval,
    document:{getElementById:()=>({textContent:"",dataset:{},setAttribute(){},classList:{toggle(){}}})},Neutralino:{}});
  vm.runInContext(source,context);context.messages=logs;
  vm.runInContext(`state.settings.siteFailoverEnabled=true;state.settings.siteFailoverTargets='chatgpt.com';state.mainProcess={};state.mainCoreReady=true;
    log=s=>messages.push(s);renderProxyNodes=()=>{};`,context);
  context.api=async(base,secret,path,options={})=>{
    paths.push([path,options.method||"GET"]);
    if(path==="/proxies/SmartProxy"){
      if(options.method==="PUT")selected=JSON.parse(options.body).name;
      return {now:selected,all:["bad","best"]};
    }
    if(path==="/connections")return {connections:[
      {id:"target",metadata:{host:"chatgpt.com"},chains:["bad","SmartProxy"]},
      {id:"unrelated",metadata:{host:"github.com"},chains:["bad","SmartProxy"]},
      {id:"othernode",metadata:{host:"chatgpt.com"},chains:["best","SmartProxy"]},
      {id:"direct",metadata:{host:"chatgpt.com"},chains:["direct"]},
      {id:"probe",metadata:{host:"chatgpt.com"},chains:["bad","CodexProbe-1"]}]};return {};
  };
  return {context,paths,logs,run:code=>vm.runInContext(code,context)};
}
test("runtime hot switch readback only closes failed-site old-node connections; manual-only legacy remains",async()=>{
  const a=appFixture();const r=await a.run(`applySiteFailoverSelection('best',{node:'bad',host:'chatgpt.com',revision:0,valid:()=>true})`);
  assert.equal(r,true);assert.deepEqual(a.paths.filter(p=>p[1]==="DELETE"),[["/connections/target","DELETE"]]);
  assert.equal(await a.run(`switchToNode('unrequested','test')`),false);assert.ok(a.logs.some(l=>l.includes("Blocked non-manual")));
  assert.ok(!a.paths.some(p=>/delay|configs|restart/.test(p[0])));
});
test("runtime refuses stale snapshot or disabled guard before a selector write",async()=>{
  for(const setup of [`state.siteFailoverRevision++`,`state.settings.siteFailoverEnabled=false`]){
    const a=appFixture();a.run(setup);assert.equal(await a.run(`applySiteFailoverSelection('best',{node:'bad',host:'chatgpt.com',revision:0,valid:()=>true})`),false);
    assert.ok(!a.paths.some(p=>p[1]==="PUT"));
  }
});
