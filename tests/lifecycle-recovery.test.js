"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../resources/js/main.js'),'utf8');
function app(){
  const files=new Map(),writes=[],logs=[],timers=new Map(),elements=new Map();let timer=0;
  const context=vm.createContext({console,URL,URLSearchParams,Map,Set,Date,Promise,JSON,Math,Array,Object,AbortController,TextEncoder,performance,
    window:{__SMART_PROXY_TEST__:true,NL_ARGS:[],location:{pathname:'/',search:'',replace:url=>{context.navigation=url;}}},
    SmartProxyConfig:require('../resources/js/config-helpers.js'),SmartProxySiteFailover:require('../resources/js/site-failover.js'),
    setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),setInterval:fn=>{timers.set(++timer,fn);return timer;},clearInterval:id=>timers.delete(id),
    document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{value:'',checked:false,textContent:'',innerHTML:'',style:{},querySelector:()=>null,querySelectorAll:()=>[],classList:{toggle(){}}});return elements.get(id);}},
    Neutralino:{filesystem:{readDirectory:async()=>[...files.keys()].map(p=>({entry:p.split('/').at(-1),type:'FILE'})),
      writeFile:async(p,text)=>{writes.push(p);files.set(p,text);},getJoinedPath:async(...p)=>p.join('/')},window:{hide:async()=>{}},os:{}}});
  vm.runInContext(source,context);context.messages=logs;context.readFile=p=>files.get(p);
  vm.runInContext(`log=s=>messages.push(s);state.paths.settings='C:/fixture/settings.json';state.paths.data='C:/fixture';state.paths.work='C:/fixture/runtime';state.paths.appRoot='C:/fixture';
    readPortableTextFile=async p=>readFile(p);ensureDefaultCorePaths=async()=>false;clearGeneratedRuntimeConfig=async()=>{};migrateLastNodeBootstrap=async()=>{};
    renderSubscriptionControls=()=>{};setStatus=()=>{};`,context);
  return {context,files,writes,logs,timers,run:code=>vm.runInContext(code,context)};
}
test('completed handoff reload authenticates self owner, consumes stale flag, never kills or rewrites lock',async()=>{
  const a=app();a.context.window.NL_ARGS=['--handoff-from-pid=11'];a.run(`getCurrentAppProcess=async()=>({pid:22,exe:'fixture.exe'});state.paths.instanceLock='C:/fixture/lock';readInstanceJson=async()=>({pid:'22'});state.handoffFromPid=11;`);
  assert.equal(await a.run('ensureSingleInstanceOrExit()'),true);assert.equal(a.run('state.handoffFromPid'),0);assert.equal(a.run('state.instanceIdentity.pid'),'22');assert.equal(a.writes.length,0);
  assert.ok(a.logs.some(l=>l.includes('handoff already completed')));
});
test('handoff still rejects a different owner rather than stealing ownership',async()=>{
  const a=app();a.context.window.NL_ARGS=['--handoff-from-pid=11'];a.run(`getCurrentAppProcess=async()=>({pid:22,exe:'fixture.exe'});state.paths.instanceLock='C:/fixture/lock';readInstanceJson=async()=>({pid:'33'});`);
  await assert.rejects(a.run('ensureSingleInstanceOrExit()'),/owner does not match/);assert.equal(a.writes.length,0);
});
test('all settings save entrances reject an uninitialized/default form without writing or mutating settings',async()=>{
  for(const call of ['persistSettingsFile()','saveSettingsNow()','saveSettingsFileOnly()','saveSettings()']){
    const a=app();a.run(`state.settings.subscriptionUrl='preserve-existing';`);
    await assert.rejects(Promise.resolve().then(()=>a.run(call)),/not initialized|not ready/);
    assert.equal(a.writes.length,0,call);assert.equal(a.run('state.settings.subscriptionUrl'),'preserve-existing',call);assert.ok(a.logs.some(l=>/blocked/.test(l)));
  }
});
test('loaded settings cannot be overwritten by a form before UI readiness',async()=>{
  const a=app();a.run(`state.settingsLoaded=true;state.settings.subscriptionUrl='preserve-existing';`);
  await assert.rejects(a.run('saveSettingsNow()'),/not ready/);assert.equal(a.writes.length,0);assert.equal(a.run('state.settings.subscriptionUrl'),'preserve-existing');
});
test('a malformed existing settings file fails closed and is preserved byte-for-byte',async()=>{
  const a=app(),raw='{"secret":"must-not-be-logged", broken';a.files.set('C:/fixture/settings.json',raw);
  await assert.rejects(a.run('loadSettings()'),/Settings load failed/);assert.equal(a.run('state.settingsLoaded'),false);
  await assert.rejects(a.run('persistSettingsFile()'),/not initialized/);assert.equal(a.files.get('C:/fixture/settings.json'),raw);assert.equal(a.writes.length,0);assert.ok(!a.logs.join('\n').includes('must-not-be-logged'));
});
test('inaccessible settings directory never masquerades as a fresh installation',async()=>{
  const a=app();a.context.Neutralino.filesystem.readDirectory=async()=>{throw {code:'NE_FS_ACSFAIL',message:'private details'};};
  await assert.rejects(a.run('loadSettings()'),/Settings load failed/);assert.equal(a.writes.length,0);assert.equal(a.run('state.settingsLoaded'),false);assert.ok(a.logs.some(l=>l.includes('NE_FS_ACSFAIL')));
});
test('missing settings in a readable directory initialize and persist defaults normally',async()=>{
  const a=app();await a.run('loadSettings()');assert.equal(a.run('state.settingsLoaded'),true);assert.ok(a.files.has('C:/fixture/settings.json'));assert.equal(JSON.parse(a.files.get('C:/fixture/settings.json')).siteFailoverEnabled,false);
});
test('valid subscription and failover settings survive load and subsequent persistence',async()=>{
  const a=app();const saved=a.run(`({...DEFAULT_SETTINGS,subscriptions:[{id:'a',name:'fixture',url:'https://example.test/sub'}],activeSubscriptionId:'a',siteFailoverEnabled:true,siteFailoverTargets:'chatgpt.com',configVersion:APP_CONFIG_VERSION})`);
  a.files.set('C:/fixture/settings.json',JSON.stringify(saved));await a.run('loadSettings()');await a.run('persistSettingsFile()');const after=JSON.parse(a.files.get('C:/fixture/settings.json'));
  assert.equal(after.subscriptions.length,1);assert.equal(after.subscriptions[0].url,saved.subscriptions[0].url);assert.equal(after.siteFailoverEnabled,true);
});
test('failure after settings load revokes writes and cancels queued persistence',async()=>{
  const a=app();a.run(`state.settingsLoaded=true;state.uiReady=true;scheduleSettingsPersist('fixture');handleBootFailure(Error('fixture failure'));`);
  assert.equal(a.run('state.settingsLoaded'),false);assert.equal(a.run('state.uiReady'),false);assert.equal(a.run('state.settingsPersistTimer'),null);
  await assert.rejects(a.run('persistSettingsFile()'),/not initialized/);assert.equal(a.writes.length,0);
});
test('reload of a failed UI skips unsafe save and remains recoverable, including repeated reloads',async()=>{
  const a=app();a.run(`stopContinuousCompetition=()=>{};requestCodexProbeCancel=async()=>{};flushLogBuffer=async()=>{};sleep=async()=>{};`);
  for(let i=0;i<2;i++)assert.equal(await a.run(`reloadAppSurface('test',{hidden:true})`),true);
  assert.equal(a.writes.length,0);assert.match(a.context.navigation,/hidden=1/);assert.ok(a.logs.some(l=>/blocked/.test(l)));
});
test('healthy hidden reload saves real settings and carries no-activate intent across WebView navigation',async()=>{
  const a=app();a.run(`state.settingsLoaded=true;state.uiReady=true;writeSettingsToForm();stopContinuousCompetition=()=>{};requestCodexProbeCancel=async()=>{};flushLogBuffer=async()=>{};sleep=async()=>{};`);
  assert.equal(await a.run(`reloadAppSurface('test',{hidden:true})`),true);assert.equal(a.writes.length,1,a.logs.join('\n'));assert.match(a.context.navigation,/hidden=1/);
});
