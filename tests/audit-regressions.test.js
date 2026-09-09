"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const helpers = require("../resources/js/config-helpers.js");
const engine = require("../resources/scripts/dual-model-probe.js");
const source = fs.readFileSync(path.join(__dirname, "../resources/js/main.js"), "utf8");
const success = { status: "done", anthropicOk: null, tokPerSec: 42, tokEst: 100, requestedModel: "m", resolvedModel: "m", resolvedModelVerified: true,
  profileKey: "fixed", roundId: "r", verified: true, sampleCount: 3, successfulSamples: 3, successRate: 1, measuredAt: 1000 };
function app() {
  const elements = new Map(), timers = new Map(); let nextTimer = 0;
  const context = vm.createContext({ console, Map, Set, Date, Promise, JSON, Math, Array, Object, URL, AbortController,
    TextEncoder, performance, crypto: require("node:crypto").webcrypto,
    window: { __SMART_PROXY_TEST__: true, confirm: () => true },
    setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: id => timers.delete(id),
    setInterval: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearInterval: id => timers.delete(id),
    SmartProxyConfig: { ...helpers }, Neutralino: { filesystem: {}, os: {} },
    document: { hidden: false, getElementById(id) { if (!elements.has(id)) elements.set(id, { value: "", innerHTML: "", textContent: "", classList: { toggle() {} } }); return elements.get(id); } }
  });
  vm.runInContext(source, context);
  return { context, elements, timers, run: code => vm.runInContext(code, context) };
}
function stream(model = "gpt-4o-mini", withUsage = true, done = true) {
  return [
    'data: ' + JSON.stringify({ model, choices: [{ delta: { role: "assistant", content: "" } }] }),
    'data: ' + JSON.stringify({ model, choices: [{ delta: { content: "Speed ".repeat(20) } }] }),
    'data: ' + JSON.stringify({ model, choices: [{ delta: {}, finish_reason: "stop" }] }),
    ...(withUsage ? ['data: ' + JSON.stringify({ model, choices: [], usage: { completion_tokens: 27 } })] : []),
    ...(done ? ['data: [DONE]'] : [])
  ].join("\n") + '\nT 200 0.1 1.0\n';
}
function fakeSpawn(body, exitCode = 0, onConfig) {
  return (_file, _argv, options) => {
    assert.equal(options.windowsHide, true);
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.stdin = new EventEmitter();
    child.stdout.setEncoding = child.stderr.setEncoding = () => {};
    let closed = false;
    child.kill = () => { if (!closed) { closed = true; queueMicrotask(() => child.emit("close", 1)); } };
    child.stdin.end = value => {
      onConfig?.(value);
      if (body === null) return;
      queueMicrotask(() => { if (!closed) { child.stdout.emit("data", body); closed = true; child.emit("close", exitCode); } });
    };
    return child;
  };
}
function options(body, exit = 0) { return { profile: "tokenmix", model: "gpt-4o-mini", auth: { accessToken: "fixture-not-real" }, laneReady: async () => true, spawn: fakeSpawn(body, exit) }; }
function good(port) { return { ok: true, resolvedModel: "m", requestedModel: "m", resolvedModelVerified: true, tokPerSec: port, ttftMs: 100, tokEst: 27, tokenCountSource: "api-usage" }; }

test("F4: pending, skipped gate, account outage and cancellation preserve last success", () => {
  for (const next of [{status:"pending"}, {status:"done",gateOnly:true}, {status:"error",failureScope:"model",error:"quota"}, {status:"cancelled"}]) {
    const merged = helpers.mergeCodexProbeResult(success, next);
    assert.equal(merged.tokPerSec, 42);
    assert.equal(helpers.normalizeCodexProbeStore({results:{a:merged}}).results.a.tokPerSec, 42);
  }
  const failed = helpers.mergeCodexProbeResult(success, {status:"error",failureScope:"round",error:"environment"});
  assert.equal(failed.lastAttempt.error, "environment");
});
test("F5: skipped gate is unknown, never Anthropic reachable", async () => {
  const a = app(); a.run('ensureProbeAssets=async()=>({})');
  const result = await a.run('runBatchGateScan([{port:40919}])');
  assert.equal(result.get(40919).ok, null);
  assert.equal(helpers.normalizeCodexProbeResult({...success,anthropicOk:true,gateRounds:0}).anthropicOk, null);
});
test("F6: truncated SSE, curl failure and post-200 API error cannot produce speed", async () => {
  for (const [body, code] of [[stream(undefined,true,false),0],[stream(),28],[stream().replace('data: [DONE]', 'data: {"error":{"message":"quota"}}\ndata: [DONE]'),0]]) {
    const value=await engine.runStreamProbe(40919, options(body,code)); assert.equal(value.ok,false); assert.equal(value.tokPerSec,undefined);
  }
});
test("T1/T2: actual usage is mandatory and TTFT starts at first nonempty content", async () => {
  let clock = 100;
  const parser = engine.createStreamParser("tokenmix",()=>clock);
  parser.consume('data: {"model":"m","choices":[{"delta":{"role":"assistant","content":""}}]}');
  clock=1000; parser.consume('data: {"choices":[{"delta":{"content":"hello"}}]}');
  assert.equal(parser.result().firstAt,1000);
  const ok = await engine.runStreamProbe(40919,options(stream())); assert.equal(ok.tokEst,27); assert.equal(ok.tokenCountSource,"api-usage");
  const missing = await engine.runStreamProbe(40919,options(stream(undefined,false))); assert.equal(missing.ok,false); assert.equal(missing.failureScope,"measurement");
});
test("P1/F3: global <=4, every queued request gets its own full timeout", async () => {
  let active=0, peak=0; const budgets=[];
  const result=await engine.runRound({ports:Array.from({length:16},(_,i)=>41000+i),concurrency:999,timeoutSeconds:30,codexHomes:[{id:"fixture",home:"fixture"}],worker:async(port,opts)=>{
    budgets.push(opts.timeoutSeconds); active++; peak=Math.max(active,peak);
    await new Promise(resolve=>setTimeout(resolve,2)); active--; return good(port);
  }});
  assert.equal(peak,4); assert.ok(budgets.every(n=>n===30)); assert.equal(result.activity.maxActiveTotal,4);
  assert.equal(result.outcomes.filter(item=>item.value.verified).length,3);
  assert.equal(result.outcomes.length,16);
});
test("T4: mixed profiles never elect a winner; three successful samples required", () => {
  const entries=[{key:"a"},{key:"b"}], gate=new Map(entries.map(e=>[e.key,{ok:null}])), keys=new Set(["a","b"]);
  const results=new Map([["a",success],["b",{...success,profileKey:"different",tokPerSec:1000}]]);
  assert.equal(helpers.rankCurrentCodexProbeEntries(entries,results,gate,keys).length,0);
  results.set("b",{...success,sampleCount:1,verified:false});
  assert.deepEqual(helpers.rankCurrentCodexProbeEntries(entries,results,gate,keys).map(e=>e.key),["a"]);
});
test("mass network failure is rechecked serially and cannot mark all nodes dead", async () => {
  let calls=0;
  const result=await engine.runRound({ports:[41000,41001,41002,41003],worker:async()=>{calls++; return {ok:false,failureScope:"node",error:"timeout"};}});
  assert.equal(calls,7);
  assert.ok(result.outcomes.every(item=>item.failureScope==="round"));
  assert.ok(result.warnings.some(w=>w.includes("serial")));
});
test("F7: cancellation kills an active curl and stops scheduling new work", async () => {
  const c = new AbortController();
  const pending=engine.runStreamProbe(40919,{...options(null),signal:c.signal});
  await new Promise(resolve=>setImmediate(resolve)); c.abort();
  const value=await pending; assert.equal(value.failureScope,"cancelled");
  const other=new AbortController(); let started=0;
  const round=await engine.runRound({ports:Array.from({length:10},(_,i)=>41000+i),concurrency:1,signal:other.signal,worker:async port=>{started++;other.abort();return good(port);}});
  assert.equal(started,1); assert.equal(round.cancelled,true); assert.ok(round.outcomes.every(x=>x.failureScope==="cancelled"));
});
test("P2: storing N scores performs O(N), not O(N^2), normalization", () => {
  const a=app(); let count=0;
  a.context.SmartProxyConfig.normalizeCodexProbeResult=value=>{count++;return helpers.normalizeCodexProbeResult(value);};
  a.context.good=success;
  a.run('for(let i=0;i<166;i++) state.nodeCodexResults.set(String(i),good); for(let i=0;i<166;i++) storeCodexProbeResult({key:String(i)},good)');
  assert.ok(count<=166,`normalized ${count} records`);
  assert.equal(a.run('Object.keys(state.settings.codexProbeStore.results).length'),166);
});
test("P8: controller reads have an abort signal and overlapping polls coalesce", async () => {
  const a=app(); let calls=0, release;
  const blocked=new Promise(resolve=>release=resolve);
  a.context.fetch=async(_url,opts)=>{calls++;assert.ok(opts.signal);await blocked;return {ok:true,status:200,json:async()=>({connections:[]})};};
  a.run('state.mainProcess={}; renderConnections=()=>{}; updateCurrentNode=async()=>{}; logNewConnections=()=>{};');
  const first=a.run('refreshConnections()'),second=a.run('refreshConnections()');
  release(); await Promise.all([first,second]); assert.equal(calls,1);
});
test("P6/P7: hidden connection view does not rebuild DOM; current-node read targets one group", async () => {
  const a=app(); a.elements.set('connRows',{innerHTML:'sentinel'});
  a.run('state.currentView="home"; state.connections=[]; renderConnections()');
  assert.equal(a.elements.get('connRows').innerHTML,'sentinel');
  const paths=[];a.context.paths=paths;
  a.run('api=async(base,secret,path)=>{paths.push(path); return {now:"n"}}');
  assert.equal(await a.run('getCurrentMainNode()'),'n'); assert.ok(paths.every(p=>p!=="/proxies"));
});
test("F1: removing offline source preserves YAML and does not restart/switch core", async () => {
  const a=app();let removed=0,saved=0,refreshed=0;
  a.context.Neutralino.filesystem.remove=async()=>removed++;
  a.context.saved=()=>saved++;a.context.refreshed=()=>refreshed++;
  a.run('state.settings.configPath="C:/fixture/source.yaml"; persistSettingsFile=async()=>saved(); refreshSubscriptionNodeCatalog=async()=>refreshed(); renderProxyNodes=()=>{}; writeSettingsToForm=()=>{}; setStatus=()=>{};');
  await a.run('removeOfflineYamlSource()');
  assert.equal(a.run('state.settings.configPath'),''); assert.equal(removed,0);assert.equal(saved,1);assert.equal(refreshed,1);
});
test("F2: system DNS failures are advisory, including A/AAAA, and never blacklist routes", async () => {
  const a=app();let cmd='';a.context.Neutralino.os.execCommand=async command=>{cmd=command;return {stdOut:'[{"h":"example.test","ok":false}]'}};
  a.run('state.subscriptionNodeCatalog=[{server:"example.test"}]; buildPowerShellExecCommand=x=>x; renderProxyNodes=()=>{};');
  await a.run('refreshEndpointDnsHealth({force:true})');
  assert.equal(a.run('entryEndpointDead({server:"example.test"})'),false); assert.ok(cmd.includes('AAAA'));
});
test("F8: benchmark entry points cannot implicitly switch nodes", () => {
  const body=source.slice(source.indexOf('async function testAllCodexNodes('),source.indexOf('// 分组测速'));
  assert.doesNotMatch(body,/switchToNode\(/);
  assert.doesNotMatch(source,/autoSwitchWinner:\s*true/);
});
test("P3/P4/P5: log batching has a bounded queue, rotation, and throttled render", async () => {
  const a=app();let appends=0;
  a.context.Neutralino.filesystem.getStats=async()=>({size:0});a.context.Neutralino.filesystem.appendFile=async()=>{appends++;};
  a.context.Neutralino.filesystem.getJoinedPath=async(...parts)=>parts.join('/');
  a.run('state.paths.appLog="C:/fixture/smart-proxy.log"; state.currentView="home"; for(let i=0;i<1000;i++) log("message "+i)');
  assert.equal(appends,0);await a.run('flushLogBuffer()');assert.equal(appends,1);
  a.run('for(let i=0;i<4000;i++) log("x".repeat(1024))');
  assert.ok(a.run('state.logBufferBytes')<=256*1024);
  assert.match(source,/LOG_MAX_FILE_BYTES/);assert.match(source,/rotateLogFile/);
  assert.match(source,/scheduleLogRender/);
});

test("median speed retains the matching sample's token count and elapsed time", () => {
  const values=[{...good(30),tokEst:60,elapsedMs:2000,ttftMs:1500},{...good(10),tokEst:30,elapsedMs:3000,ttftMs:2800},{...good(50),tokEst:100,elapsedMs:2000,ttftMs:800}];
  const result=engine.aggregateSamples(values,'p','r');
  assert.equal(result.tokPerSec,30);assert.equal(result.tokEst,60);assert.equal(result.elapsedMs,2000);assert.equal(result.ttftMs,1500);
  assert.equal(result.tokPerSec,engine.effectiveTokPerSec(result.tokEst,result.elapsedMs));
  assert.equal(result.samples[0].tokEst,60);
});
test("progress totals include only real finalist/control work", async () => {
  const events=[];
  await engine.runRound({ports:[41000],worker:async port=>good(port),onEvent:e=>events.push(e)});
  const progress=events.filter(e=>e.type==='progress');
  assert.equal(progress.at(-1).completed,3);assert.equal(progress.at(-1).total,3);
  assert.ok(progress.every(e=>e.completed<=e.total));
});
test("log rotation archives the original oversized asset and bounds managed files", async () => {
  const a=app(),file='C:/fixture/smart-proxy.log',files=new Map([[file,72*1024*1024]]),moves=[],deletes=[];
  a.context.Neutralino.filesystem={getStats:async p=>{if(!files.has(p))throw Error('missing');return {size:files.get(p)}},
    getJoinedPath:async(...p)=>p.join('/'),move:async(from,to)=>{moves.push([from,to]);files.set(to,files.get(from));files.delete(from)},
    remove:async p=>{deletes.push(p);files.delete(p)}};
  a.context.exists=p=>files.has(p);a.run('access=async p=>exists(p); ensureDirectory=async()=>{}; state.paths.appLog="C:/fixture/smart-proxy.log";state.paths.work="C:/fixture";');
  await a.run('rotateLogFile(100)');assert.ok(moves[0][1].includes('_历史版本/'));assert.equal(files.get(moves[0][1]),72*1024*1024);assert.equal(deletes.length,0);
  for(let i=0;i<4;i++){files.set(file,8*1024*1024);a.run('state.logFileBytes=LOG_MAX_FILE_BYTES');await a.run('rotateLogFile(100)');}
  assert.ok(deletes.every(p=>p===file+'.2'));assert.ok(files.has(moves[0][1]));
});
test("UI handoff authenticates previous lock owner and never kills it during verification", async () => {
  const a=app();a.context.window.NL_ARGS=['--handoff-from-pid=11'];
  a.run('getCurrentAppProcess=async()=>({pid:22,exe:"fixture.exe"});readInstanceJson=async()=>({pid:"11"});state.paths.instanceLock="C:/fixture/lock";');
  a.context.Neutralino.filesystem.writeFile=async()=>{throw Error('premature lock takeover')};
  assert.equal(await a.run('ensureSingleInstanceOrExit()'),true);assert.equal(a.run('state.handoffFromPid'),11);
  a.run('readInstanceJson=async()=>({pid:"12"})');
  await assert.rejects(a.run('ensureSingleInstanceOrExit()'),/owner does not match/);
});
test("native helper cancellation reaches stdin and removes its event listener", async () => {
  const a=app();let listener=null,cancels=0;
  a.run('dualModelProbeScriptPath=async()=>"C:/fixture/helper.js"');
  a.context.Neutralino.events={on:async(_name,fn)=>{listener=fn},off:async()=>{listener=null}};
  a.context.Neutralino.os={spawnProcess:async()=>({id:101,pid:202}),updateSpawnedProcess:async(id,action,data)=>{
    assert.equal(id,101);assert.equal(action,'stdIn');assert.equal(JSON.parse(data).action,'cancel');cancels++;
    listener({detail:{id:101,action:'stdOut',data:JSON.stringify({type:'result',ok:true,cancelled:true,outcomes:[{port:40919,value:{ok:false,failureScope:'cancelled'}}]})+'\n'}});
    listener({detail:{id:101,action:'exit',data:0}});
  }};
  const pending=a.run('runBatchTokProbe([{port:40919}])');await new Promise(resolve=>setImmediate(resolve));
  await a.run('requestCodexProbeCancel()');const result=await pending;
  assert.equal(cancels,1);assert.equal(result.get(40919).failureScope,'cancelled');assert.equal(listener,null);assert.equal(a.run('state.probeJob'),null);
});
test("hidden window rendering is gated and unchanged connection DOM is reused", () => {
  const a=app();let writes=0,html='sentinel';a.elements.set('connRows',{get innerHTML(){return html},set innerHTML(v){html=v;writes++}});
  a.run('state.currentView="connections";state.surfaceVisible=false;state.connections=[];renderConnections()');assert.equal(writes,0);
  a.run('state.surfaceVisible=true;renderConnections();renderConnections()');assert.equal(writes,1);
});
