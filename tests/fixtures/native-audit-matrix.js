/* Only loaded from the isolated native fixture. Never included in the shipped application. */
(async () => {
  const bridge=window.__auditBridge, out=window.NL_PATH.replace(/\\/g,'/')+'/output';
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const started=performance.now(), rows=[], screenshots=[];
  const write=(name,value)=>bridge.filesystem.writeFile(out+'/'+name,JSON.stringify(value,null,2));
  try {
    const deadline=Date.now()+15000;
    while(!window.__fixture?.ready){if(Date.now()>deadline)throw Error('Fixture readiness timeout');await sleep(50)}
    const faceIds=new WeakMap(),fontTrace=[];let nextFaceId=0;
    const traceFonts=phase=>fontTrace.push({phase,at:performance.now()-started,status:document.fonts.status,faces:[...document.fonts].map(f=>{if(!faceIds.has(f))faceIds.set(f,++nextFaceId);return{id:faceIds.get(f),family:f.family,weight:f.weight,status:f.status}})});
    traceFonts('before initial explicit load');
    await document.fonts.load('14px "SmartProxy CJK"','连接概览设置节点');await document.fonts.ready;
    traceFonts('after initial explicit load');
    const fontLoaded=()=>[...document.fonts].some(f=>f.family.includes('SmartProxy CJK')&&f.status==='loaded');
    const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};
    let rafReceived=false;await Promise.race([new Promise(resolve=>requestAnimationFrame(()=>{rafReceived=true;resolve()})),sleep(1000)]);
    if(!rafReceived)await write('paint-warning.json',{reason:'requestAnimationFrame unavailable on this inactive desktop; DOM metrics do not prove painting'});
    for(const size of [{name:'normal',width:1240,height:837},{name:'short',width:1040,height:680}]){
      traceFonts(size.name+' before resize');
      await bridge.window.setSize({width:size.width,height:size.height});await sleep(250);
      traceFonts(size.name+' after resize');
      // Native resize recreated the CSS-connected FontFace (trace IDs 1 -> 2 -> 3).
      // Explicitly verify the new face, rather than inspecting an unused replacement before it is loaded.
      await document.fonts.load('14px "SmartProxy CJK"','连接概览设置节点');await document.fonts.ready;
      traceFonts(size.name+' after resized-face load');
      for(const scenario of ['ready','empty','long','failed','pending']){
        __fixture.setScenario(scenario);
        for(const page of ['home','proxy-nodes','subscriptions','core','connections','logs','settings']){
          const content=document.querySelector('.content');content.scrollTop=content.scrollHeight;
          if(state.currentView===page)switchView(page==='home'?'settings':'home');
          document.querySelector('.nav-list [data-view="'+page+'"]').click();await sleep(90);
          if(scenario==='ready'&&['home','proxy-nodes'].includes(page))traceFonts(size.name+' '+scenario+' '+page+' after navigation');
          const navHost=document.querySelector('.nav-list'), navBounds=rect(navHost);
          const nav=[...navHost.querySelectorAll('.nav')].map(e=>{const r=rect(e);return{page:e.dataset.view,...r,visibleInViewport:r.y>=-1&&r.bottom<=innerHeight+1,reachable:r.height<=navHost.clientHeight+1&&(['auto','scroll'].includes(getComputedStyle(navHost).overflowY)||r.y>=-1&&r.bottom<=innerHeight+1)}});
          const overflow=[],truncations=[],intentionalOverflow=[],fontSamples=[];
          for(const e of document.querySelectorAll('main *,aside *')){
            if(!visible(e)||!e.clientWidth||e.scrollWidth<=e.clientWidth+1)continue;
            const s=getComputedStyle(e),entry={tag:e.tagName,id:e.id,className:String(e.className).slice(0,100),clientWidth:e.clientWidth,scrollWidth:e.scrollWidth};
            // A clipped, associated accessibility label is not visually painted overflow.
            if(e.matches('label.sr-only')&&e.control&&s.position==='absolute'&&/^rect\(0px,\s*0px,\s*0px,\s*0px\)$/.test(s.clip)){
              intentionalOverflow.push({...entry,reason:'Visually clipped label with a valid associated control',control:e.control.id});continue;
            }
            // The update indicator intentionally protrudes 2px from the logo; retain geometry proving it fits the rail.
            if(e.matches('.brand-mark')&&e.children.length===2){
              const mark=e.querySelector(':scope > .mark'),badge=e.querySelector(':scope > .core-update-hint'),rail=e.closest('.sidebar');
              if(mark&&badge&&rail){const er=rect(e),mr=rect(mark),br=rect(badge),rr=rect(rail);
                if(getComputedStyle(badge).position==='absolute'&&mr.right<=er.right+1&&br.right<=rr.right&&br.y>=rr.y&&br.bottom<=rr.bottom&&Math.abs(e.scrollWidth-e.clientWidth-(br.right-er.right))<=1){
                  intentionalOverflow.push({...entry,reason:'Absolutely positioned update indicator remains inside the sidebar',badge:br,sidebar:rr});continue;
                }
              }
            }
            if(s.textOverflow==='ellipsis'){truncations.push(entry);continue}
            if(['auto','scroll'].includes(s.overflowX)||['INPUT','TEXTAREA'].includes(e.tagName))continue;
            overflow.push(entry);
          }
          for(const selector of ['body','.page-head h1','.workspace-wordmark','.nav.active','.node-label','button','input','small']){
            const e=[...document.querySelectorAll(selector)].find(visible);if(!e)continue;const s=getComputedStyle(e);
            fontSamples.push({selector,family:s.fontFamily,size:s.fontSize,lineHeight:s.lineHeight,weight:s.fontWeight,color:s.color});
          }
          const row={size:size.name,requestedPhysicalSize:size,scenario,page,dpr:devicePixelRatio,viewport:{width:innerWidth,height:innerHeight},fontLoaded:fontLoaded(),horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,contentHorizontalOverflow:content.scrollWidth>content.clientWidth+1,scrollReset:content.scrollTop<=1,mainScrollReachable:content.scrollHeight<=content.clientHeight+1||['auto','scroll'].includes(getComputedStyle(content).overflowY),nav,navBounds,overflow,truncations,intentionalOverflow,fontSamples,errors:[...__fixture.errors]};rows.push(row);
          if(scenario==='ready'||scenario==='long'&&['home','proxy-nodes'].includes(page)){
            const name=size.name+'-'+scenario+'-'+page+'.png';await bridge.window.snapshot(out+'/'+name);screenshots.push(name);
          }
          await write('progress.json',{rows:rows.length,size:size.name,scenario,page,wallMs:Math.round(performance.now()-started)});
        }
      }
    }
    const failures=rows.filter(r=>!r.fontLoaded||r.horizontalOverflow||r.contentHorizontalOverflow||!r.scrollReset||!r.mainScrollReachable||r.nav.some(n=>!n.reachable)||r.overflow.length||r.errors.length);
    const report={scope:'Real native WebView2 in an inactive desktop, synthetic states; no CSS scale or iframe',fixtureOnly:true,productionInstalled:false,dpr:devicePixelRatio,rafReceived,wallMs:performance.now()-started,fontTrace,rows,failures,screenshots,fixtureCalls:__fixture.calls,externalResourceUrls:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>new URL(u,location.href).origin!==location.origin),nativeSize:await bridge.window.getSize(),userAgent:navigator.userAgent};
    await write('audit.json',report);await write('done.json',{ok:failures.length===0,rows:rows.length,failures:failures.length});await bridge.app.exit(0);
  }catch(e){await write('error.json',{error:String(e),stack:e.stack,completedRows:rows.length});await bridge.app.exit(1)}
})().catch(console.error);
