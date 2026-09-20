/* Browser-only synthetic data; never bundled in the desktop executable. */
(async function () {
  state.surfaceVisible=true;
  const markerStyle=document.createElement('style');
  markerStyle.textContent='@media(max-width:760px){.workspace-wordmark>span{display:block;font-size:9px;margin:0}}';
  document.head.append(markerStyle);
  const entries = ['香港 02 · 专线', '日本 01 · 东京', '新加坡 03 · 直连', '美国 01 · 洛杉矶', '香港 04 · 备用', '德国 02 · 法兰克福'].map((node, i) => ({key:'fixture-'+i,node,tag:'fixture-node-'+i,subscriptionId:i<4?'sample-a':'sample-b',subscriptionName:i<4?'示例订阅 A':'示例订阅 B'}));
  function populate(mode='ready') {
    state.settings={...DEFAULT_SETTINGS, subscriptions:mode==='empty'?[]:[{id:'sample-a',name:'示例订阅 A',url:'https://example.test/a'},{id:'sample-b',name:'示例订阅 B',url:'https://example.test/b'}],activeSubscriptionId:'sample-a',networkProbeStore:{},singBoxPath:'sing-box.exe',configPath:''};
    state.subscriptionNodeCatalog=mode==='empty'?[]:entries;
    state.nodes=state.subscriptionNodeCatalog.map(x=>x.tag);
    state.currentNode=mode==='empty'?'-':entries[0].tag;
    state.mainProcess=['empty','stopped','starting','core-error'].includes(mode)?null:{};state.mainCoreReady=!!state.mainProcess;
    state.coreActionPending=mode==='starting'?'starting':'';state.coreActionError=mode==='core-error'?'操作失败：示例内核路径不可用。请在内核页选择有效路径后重试。':'';
    state.networkProbeJob=null;state.networkProgress='';state.codexProbeRunning=false;state.codexProbeMode='';
    state.nodeCodexResults.clear();state.codexProbePendingKeys.clear();state.networkPendingKeys.clear();
    for (const [i,e] of state.subscriptionNodeCatalog.entries()) {
      if(i===4)continue;
      state.settings.networkProbeStore[e.key]={status:'done',delayMs:258+i*59,measuredAt:Date.UTC(2026,8,16,2,20)};
      state.nodeCodexResults.set(e.key,{metricKind:'stream-quality-v1',measurement:'sse-and-download',status:'done',ok:true,download:{ok:true,mbps:18+i*3},profileKey:'fixture-sse',endpoint:'https://example.test',location:'fixture',measuredAt:Date.UTC(2026,8,16,2,20),sampleCount:3,successfulSamples:3,successRate:1,verified:true,stream:{ok:true,flowPass:i!==3,firstSampleMs:170+i*25,jitterMs:4+i*6,maxExtraGapMs:12+i*10,burstRatio:0}});
    }
    if(mode==='failed'){state.nodeCodexResults.get(entries[0].key).lastAttempt={status:'error',error:'fixture timeout'};state.settings.networkProbeStore[entries[0].key]={status:'error',lastSuccess:{delayMs:258}};}
    if(mode==='pending'){state.codexProbePendingKeys.add(entries[0].key);state.codexProbeRunning=true;state.codexProbeMode='all';state.codexProbeTotal=entries.length;}
    if(mode==='network-pending'){state.networkPendingKeys.add(entries[0].key);state.networkProbeJob={};state.networkProgress='网络测试中 · 示例进度 0/6';}
    if(mode==='unmeasured'){state.nodeCodexResults.clear();state.settings.networkProbeStore={};}
    if(mode==='cancelled')state.nodeCodexResults.get(entries[0].key).lastAttempt={status:'cancelled'};
    if(mode==='long'){state.subscriptionNodeCatalog=entries.map(e=>({...e,node:e.node+' — 长名称边界验证 '.repeat(12),subscriptionName:'订阅边界验证 '.repeat(12)}));}
    state.codexProbeRenderAt=0;
    writeSettingsToForm();setStatus();renderProxyNodes();renderCustomRules();renderConnections();
    document.querySelector('.workspace-wordmark > span').textContent='/ 隔离预览 · 示例数据';
    document.body.dataset.preview='true';
  }
  // Stub only effectful operations; retain production navigation, rendering, filtering and event delegation.
  log=message=>__fixture.calls.push({action:'log',message});
  refreshConnections=async()=>renderConnections();scheduleSettingsPersist=()=>{};
  persistSettingsFile=async()=>{};
  selectCatalogNode=async(key,options)=>{__fixture.calls.push({action:'select',key,manual:options.manual});state.currentNode=state.subscriptionNodeCatalog.find(e=>e.key===key).tag;renderProxyNodes();};
  testNetworkNodes=async(options)=>{__fixture.calls.push({action:'network',...options});};
  testCodexNode=async(key)=>{__fixture.calls.push({action:'quality',key});};
  testAllCodexNodes=async()=>{__fixture.calls.push({action:'quality-all'});};
  startMainCore=async()=>{__fixture.calls.push({action:'start'});await new Promise(r=>setTimeout(r,150));if(__fixture.failCoreAction)throw Error('示例启动失败');state.mainProcess={};state.mainCoreReady=true;};
  stopMainCore=async()=>{__fixture.calls.push({action:'stop'});await new Promise(r=>setTimeout(r,150));if(__fixture.failCoreAction)throw Error('示例停止失败');state.mainProcess=null;state.mainCoreReady=false;};
  populate(new URLSearchParams(location.search).get('scenario')||'ready');
  await bindEvents();switchView(new URLSearchParams(location.search).get('view')||'home');
  __fixture.setScenario=populate;__fixture.ready=true;
})().catch(error=>{__fixture.errors.push(error.stack);console.error(error);});
