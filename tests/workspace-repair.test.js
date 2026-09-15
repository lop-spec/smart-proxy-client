"use strict";
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const {EventEmitter} = require('node:events');
const network = require('../resources/js/network-probe.js'), model = require('../resources/scripts/dual-model-probe.js');
const source = fs.readFileSync(path.join(__dirname,'../resources/js/main.js'),'utf8');
const entries = n => Array.from({length:n},(_,i)=>({key:'e'+i,node:'expired-cache-'+i,tag:'n'+i,subscriptionId:'expired'}));
function app() {
  const elements = new Map(), logs = [], context = vm.createContext({console, Map, Set, Date, Promise, JSON, Math, Array, Object, URL, AbortController, TextEncoder, performance,
    window:{__SMART_PROXY_TEST__:true},setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>{},
    SmartProxyConfig:require('../resources/js/config-helpers.js'),SmartProxyNetwork:network,
    document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',className:'',innerHTML:'',disabled:false,setAttribute(){},classList:{toggle(){}}});return elements.get(id)}},
    Neutralino:{filesystem:{getJoinedPath:async(...p)=>p.join('/'),writeFile:async()=>{}},os:{}},logs});
  vm.runInContext(source,context);
  const run=code=>vm.runInContext(code,context);
  run(`log=s=>logs.push(s);renderProxyNodes=()=>{};writeSettingsToForm=()=>{};scheduleSettingsPersist=()=>{};evaluateBenchmarkSubscriptionEvidence=()=>{};
    state.settingsLoaded=true;state.paths={work:'fixture',data:'fixture',settings:'fixture/settings.json'};
    state.settings.singBoxPath='fixture/old.exe';state.mainCoreReady=true;state.mainProcess={};state.currentNode='n0';
    saveSettings=()=>{throw Error('unrelated form save forbidden')};startMainCore=()=>{throw Error('restart forbidden')};switchToNode=()=>{throw Error('switch forbidden')};`);
  return {context,run,elements,logs};
}
function spawnResponse(text,code=0) { return (_file,_args,opts)=>{
  assert.equal(opts.windowsHide,true);
  const p=new EventEmitter();p.stdout=new EventEmitter();p.stderr=new EventEmitter();p.stdin=new EventEmitter();p.stdout.setEncoding=p.stderr.setEncoding=()=>{};
  p.kill=()=>p.emit('close',1);p.stdin.end=()=>queueMicrotask(()=>{p.stdout.emit('data',text);p.emit('close',code)});return p;
};}

test('recorded provider rejection detail survives and is model-scope, not node-scope',async()=>{
  const detail="The 'gpt-5.3-codex-spark' model is not supported when using Codex with a ChatGPT account.";
  const result=await model.runStreamProbe(41000,{profile:'codex',model:'gpt-5.3-codex-spark',auth:{accessToken:'fixture'},laneReady:async()=>true,spawn:spawnResponse(JSON.stringify({detail})+'\nT 400 0.1 0.2\n')});
  assert.equal(result.failureScope,'model');assert.equal(result.error,detail);assert.equal(result.tokPerSec,undefined);
});
test('generic request rejection is not connection-level evidence; local curl TLS errors are local',async()=>{
  for(const [http,exit,scope] of [[400,0,'measurement'],[0,60,'local']]){
    const result=await model.runStreamProbe(41000,{profile:'codex',auth:{accessToken:'fixture'},laneReady:async()=>true,spawn:spawnResponse('generic\nT '+http+' 0.1 0.2\n',exit)});
    assert.equal(result.failureScope,scope);
  }
});
test('a rejected model stops scheduling at most four active requests',async()=>{
  let calls=0;const detail='model is not supported';
  const result=await model.runRound({ports:Array.from({length:100},(_,i)=>41000+i),worker:async()=>{calls++;return {ok:false,failureScope:'model',error:detail}}});
  assert.ok(calls<=4);assert.equal(result.channelFailure.error,detail);assert.ok(result.outcomes.every(x=>x.value.failureScope==='model'));
});
test('account-free test includes expired-cache nodes, deduplicates keys and never exceeds four requests',async()=>{
  let active=0,peak=0,calls=0;const nodes=entries(20);
  const round=await network.runRound([...nodes,nodes[0]],{probe:async()=>{active++;peak=Math.max(peak,active);calls++;await new Promise(r=>setTimeout(r,2));active--;return 123}});
  assert.equal(calls,20);assert.equal(peak,4);assert.equal(round.peak,4);assert.ok([...round.results.values()].every(r=>r.delayMs===123));
});
test('mass target failure retains raw evidence, serial controls and bounded progress',async()=>{
  const progress=[],logs=[];let calls=0;
  const round=await network.runRound(entries(5),{probe:async()=>{calls++;throw Error('fixture timeout')},onProgress:p=>progress.push(p),log:l=>logs.push(l)});
  assert.equal(calls,8);assert.ok(progress.every(p=>p.completed<=p.total));assert.equal(progress.at(-1).completed,5);
  assert.ok([...round.results.values()].every(v=>v.failureScope==='round'&&v.error.includes('fixture timeout')));assert.equal(logs.length,2);
  const merged=network.merge({status:'done',delayMs:100,measuredAt:1},round.results.get('e0'));assert.equal(merged.lastSuccess.delayMs,100);
});
test('missing, null and string delays never become fake successful measurements',async()=>{
  for(const delay of [undefined,null,'123',NaN]){
    const round=await network.runRound(entries(1),{probe:async()=>delay});
    assert.equal(round.results.get('e0').failureScope,'measurement');
  }
});

test('network cancellation stops queue and preserves historical success',async()=>{
  const controller=new AbortController();let calls=0;
  const round=await network.runRound(entries(20),{signal:controller.signal,probe:async()=>{calls++;controller.abort();throw Error('stopped')}});
  assert.equal(calls,1);assert.equal(round.cancelled,true);assert.ok([...round.results.values()].every(v=>v.status==='cancelled'));
  const old={status:'done',delayMs:10,measuredAt:100};assert.equal(network.merge(old,round.results.get('e0')).lastSuccess.measuredAt,100);
});
test('UI network action uses only existing outbound GETs; no account, subscription download or selector writes',async()=>{
  const a=app();a.context.nodes=entries(3);const requests=[];a.context.requests=requests;
  a.run(`state.subscriptionNodeCatalog=nodes;state.subscriptionTraffic={expired:true};
    api=async(base,secret,path,opts={})=>{requests.push({path,method:opts.method||'GET'});if(path==='/proxies')return {proxies:{n0:{},n1:{}}};return {delay:77}};
    downloadSubscription=async()=>{throw Error('subscription request forbidden')};resolveProbeNodeRuntime=async()=>{throw Error('Node dependency forbidden')};`);
  const round=await a.run('testNetworkNodes()');assert.equal(round.results.size,3);assert.equal(round.results.get('e2').failureScope,'local');
  assert.equal(requests.length,3);assert.ok(requests.every(x=>x.method==='GET'));assert.ok(requests.slice(1).every(x=>x.path.includes('/delay?timeout=5000')));
  assert.equal(a.run('state.currentNode'),'n0');assert.equal(a.run('state.networkProbeJob'),null);assert.equal(a.run('state.settings.networkProbeStore.e0.delayMs'),77);
});
test('unavailable controller does not start a core and clears network busy state',async()=>{
  const a=app();a.run('api=async()=>{throw Error("controller unavailable")}');await assert.rejects(a.run('testNetworkNodes()'),/unavailable/);assert.equal(a.run('state.networkProbeJob'),null);
});
test('manual refresh failure persists its reason and never loses the live node catalog',async()=>{
  const a=app();a.run(`state.settings.subscriptions=[{id:'a',name:'fixture',url:'https://example.test/sub'}];state.settings.activeSubscriptionId='a';
    state.subscriptionNodeCatalog=[{key:'keep',node:'existing'}];setSubscriptionBusy=()=>{};syncSubscriptionInputs=()=>{};saveSubscriptionProfile=async()=>{};
    persistSettingsFile=async()=>{};setStatus=()=>{};loadSourceConfig=async()=>{state.subscriptionNodeCatalog=[];state.subscriptionRefreshOutcome={preserved:true,error:'HTTP 403'}};`);
  await a.run('refreshSubscription()');assert.equal(a.run("state.settings.subscriptionRefreshStatus.a.error"),'HTTP 403');
  assert.equal(a.run('state.subscriptionNodeCatalog[0].key'),'keep');assert.equal(a.run('state.currentNode'),'n0');
});

test('new subscription view reads its visible form, not stale hidden settings fields',()=>{
  const a=app();a.run(`state.currentView='subscriptions';$('homeSubscriptionName').value='visible';$('subscriptionName').value='stale';$('homeSubscriptionUrl').value='https://example.test/new';$('subscriptionUrl').value='https://example.test/old';`);
  assert.equal(a.run('subscriptionFormDraft().name'),'visible');assert.equal(a.run('subscriptionFormDraft().url'),'https://example.test/new');
  assert.equal((source.match(/function setStatus\(/g)||[]).length,1);assert.doesNotMatch(source,/setStatus = function/);
});

test('core check reports running/selected/official versions without saving unrelated forms',async()=>{
  const a=app();a.run(`getCoreLocalInfo=async()=>({local:'sing-box version 1.13.13',exists:true});runCoreManager=async()=>({latest:'v1.14.1'});api=async()=>({version:'1.13.13'});`);
  await a.run('checkCoreVersions()');const text=a.elements.get('coreVersionStatus').textContent;
  assert.match(text,/运行中 1.13.13/);assert.match(text,/官方 v1.14.1/);assert.match(text,/可下载更新/);assert.equal(a.elements.get('checkCoreBtn').disabled,false);
});
test('core check errors remain visible alongside local version',async()=>{
  const a=app();a.run(`getCoreLocalInfo=async()=>({local:'sing-box version 1.13.13',exists:true});runCoreManager=async()=>{throw Error('timeout')}`);
  await assert.rejects(a.run('checkCoreVersions()'),/timeout/);assert.match(a.elements.get('coreVersionStatus').textContent,/1.13.13.*检查失败.*timeout/);
});
test('core install changes only next-start path; failed download or persistence retains old path',async()=>{
  for(const failure of ['none','download','persist']){
    const a=app();a.context.failure=failure;a.run(`runCoreManager=async()=>{if(failure==='download')throw Error('hash mismatch');return {path:'fixture/new.exe',sha256:'fixture',latest:'v1.14.1'}};persistSettingsFile=async()=>{if(failure==='persist')throw Error('disk full')};`);
    if(failure==='none'){await a.run('downloadCoreLatest()');assert.equal(a.run('state.settings.singBoxPath'),'fixture/new.exe');assert.match(a.elements.get('coreVersionStatus').textContent,/当前内核未重启/)}
    else{await assert.rejects(a.run('downloadCoreLatest()'));assert.equal(a.run('state.settings.singBoxPath'),'fixture/old.exe');assert.match(a.elements.get('coreVersionStatus').textContent,/原内核保留/)}
    assert.equal(a.run('state.currentNode'),'n0');assert.equal(a.elements.get('downloadSingBoxBtn').disabled,false);
  }
});
test('core updater safety contract: official asset, independent network, digest, size, version and config checks',()=>{
  const ps=fs.readFileSync(path.join(__dirname,'../resources/scripts/core-manager.ps1'),'utf8');
  for(const pattern of [/--noproxy '\*'/,/--max-time \$Seconds/,/digest -notmatch/,/\.Length -ne \$asset.size/,/SHA256 mismatch/,/Executable version does not match/,/check -c \$ConfigPath/,/guid.*ToString/])assert.match(ps,pattern);
  assert.doesNotMatch(ps,/legacy-windows-7|Stop-Process|Copy-Item[^\n]*-Force/);
  assert.match(source,/if \(state.coreUpdateRunning\).*already running/);
  assert.match(ps,/\[Console\]::Error.WriteLine\(\$reason\)/,'mirror fallback must always disclose its reason');
  assert.match(ps,/180 - \$deadline.Elapsed.TotalSeconds/,'all download routes share one deadline');
  assert.match(ps,/Download \$asset.url \$zip 180 'application\/octet-stream'/,'official asset API avoids the blocked web download host');
});

test('PowerShell 5.1 accepts native stderr warnings only when config check exits zero', {skip:process.platform!=='win32'},()=>{
  const os=require('node:os'),cp=require('node:child_process');const temp=fs.mkdtempSync(path.join(os.tmpdir(),'smart-proxy-native-warning-'));
  const ps=fs.readFileSync(path.join(__dirname,'../resources/scripts/core-manager.ps1'),'utf8');
  const begin=ps.indexOf('    $previousPreference',ps.indexOf('if ($ConfigPath'));
  const end=ps.indexOf('\n  }',begin);const block=ps.slice(begin,end);
  try {for(const expected of [0,1]){
    const code=block.replace('& $exe check -c $ConfigPath',`& $exe /d /s /c 'echo fixture diagnostic 1>&2 & exit ${expected}'`);
    const target=path.join(temp,'check.ps1');fs.writeFileSync(target,`$ErrorActionPreference='Stop'\n$exe=Join-Path $env:SystemRoot 'System32/cmd.exe'\n$job='${temp.replace(/'/g,"''")}'\ntry {\n${code}\nexit 0\n} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }`);
    const res=cp.spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File',target],{windowsHide:true,encoding:'utf8',timeout:6000});
    assert.equal(res.status,expected,res.stderr);assert.match(res.stderr,expected===0?/succeeded with diagnostic/:/rejected the running configuration/);
  }} finally {fs.rmSync(temp,{recursive:true,force:true})}
});
test('UI has unique IDs, separate network/model actions and no obsolete auto-switch promises',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../resources/index.html'),'utf8');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
  for(const id of ['view-subscriptions','view-core','coreVersionStatus','testNetworkBtn','testAllCodexBtn','nodeSearch','nodeFilter','subscriptionRefreshDetails'])assert.ok(ids.includes(id));
  assert.doesNotMatch(html,/v35|CF Upload|才切到本轮最快节点|立即应用请点/);
});
