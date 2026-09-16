'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pages=['home','proxy-nodes','subscriptions','core','connections','logs','settings'],sizes=['normal','short'],scenarios=['ready','empty','long','failed','pending'];
const expectedCases=sizes.flatMap(size=>scenarios.flatMap(scenario=>pages.map(page=>`${size}/${scenario}/${page}`))).sort();
const expectedScreenshots=sizes.flatMap(size=>[...pages.map(page=>`${size}-ready-${page}.png`),...['home','proxy-nodes'].map(page=>`${size}-long-${page}.png`)]).sort();
function validateNativeReport({host,audit},dpi){
 assert.ok([96,120,144,168].includes(dpi),'Unexpected target DPI');
 for(const key of ['ok','helperStationUnchanged','threadDpiRestored'])assert.equal(host[key],true,key);
 for(const key of ['switchDesktopCalled','systemSettingsChanged'])assert.equal(host[key],false,key);
 assert.notEqual(host.diagnosticOnly,true,'A debugger diagnostic cannot count as native UI acceptance');
 assert.equal(host.ownedProcessesRemaining,0,'Owned native processes remain');
 const windows=host.windows.filter(w=>w.width>0&&w.height>0);assert.ok(windows.length,'No real native window');assert.deepEqual([...new Set(windows.map(w=>w.dpi))],[dpi],'Real window DPI mismatch');
 assert.equal(audit.fixtureOnly,true);assert.equal(audit.productionInstalled,false);assert.deepEqual(audit.failures,[]);assert.deepEqual(audit.externalResourceUrls,[]);
 assert.deepEqual(audit.rows.map(r=>`${r.size}/${r.scenario}/${r.page}`).sort(),expectedCases,'Missing/duplicate native matrix case');
 for(const row of audit.rows){assert.equal(row.dpr,dpi/96,'DPR mismatch');for(const key of ['fontLoaded','scrollReset','mainScrollReachable'])assert.equal(row[key],true,key);for(const key of ['horizontalOverflow','contentHorizontalOverflow'])assert.equal(row[key],false,key);assert.equal(row.nav.length,7);assert.ok(row.nav.every(n=>n.reachable===true),'Navigation unreachable');assert.deepEqual(row.overflow,[]);assert.deepEqual(row.errors,[])}
 const viewports=sizes.map(size=>{const group=audit.rows.filter(r=>r.size===size),first=group[0].viewport;assert.ok(first?.width>0&&first?.height>0,'Viewport geometry absent');assert.ok(group.every(r=>r.viewport.width===first.width&&r.viewport.height===first.height),'Unstable viewport within size');return first});
 assert.ok(viewports[0].width>viewports[1].width&&viewports[0].height>viewports[1].height,'Both distinct actual window sizes are required');
 assert.deepEqual([...audit.screenshots].sort(),expectedScreenshots,'Missing native screenshots');
 return{rows:audit.rows.length,failures:0,dpi,dpr:dpi/96,screenshots:audit.screenshots.length,visualReviewRequired:true};
}
if(require.main===module){const stage=path.resolve(process.argv[2]),dpi=Number(process.argv[3]),read=file=>JSON.parse(fs.readFileSync(path.join(stage,'output',file),'utf8').replace(/^\uFEFF/,''));const result=validateNativeReport({host:read('host.json'),audit:read('audit.json')},dpi);for(const name of expectedScreenshots){const bytes=fs.readFileSync(path.join(stage,'output',name));assert.ok(bytes.length>1000&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Missing/invalid PNG: '+name)}console.log(JSON.stringify(result))}
module.exports={validateNativeReport,expectedScreenshots};
