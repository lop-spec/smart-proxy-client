'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {validateNativeReport,expectedScreenshots}=require('../scripts/verify-native-ui.cjs');
function sample(){const rows=[];for(const size of ['normal','short'])for(const scenario of ['ready','empty','long','failed','pending'])for(const page of ['home','proxy-nodes','subscriptions','core','connections','logs','settings'])rows.push({size,scenario,page,viewport:{width:size==='normal'?1240:1040,height:size==='normal'?837:680},dpr:1,fontLoaded:true,horizontalOverflow:false,contentHorizontalOverflow:false,scrollReset:true,mainScrollReachable:true,nav:Array.from({length:7},()=>({reachable:true})),overflow:[],errors:[]});return{host:{ok:true,ownedProcessesRemaining:0,switchDesktopCalled:false,systemSettingsChanged:false,helperStationUnchanged:true,threadDpiRestored:true,windows:[{width:1040,height:680,dpi:96}]},audit:{fixtureOnly:true,productionInstalled:false,rows,failures:[],externalResourceUrls:[],screenshots:expectedScreenshots}}}
test('native matrix requires all 70 unique cases and exact real DPI/DPR',()=>{
 assert.equal(validateNativeReport(sample(),96).rows,70);
 for(const mutate of [s=>s.audit.rows.pop(),s=>s.audit.rows[1]={...s.audit.rows[0]},s=>s.audit.rows[0].dpr=1.25,s=>s.host.windows[0].dpi=120,s=>s.host.windows=[],s=>s.audit.rows.forEach(r=>r.viewport={width:1040,height:680})]){const s=sample();mutate(s);assert.throws(()=>validateNativeReport(s,96))}
});
test('native gate preserves font/layout/errors, isolation, process cleanup and screenshots requirements',()=>{
 for(const mutate of [s=>s.audit.rows[0].fontLoaded=false,s=>s.audit.rows[0].overflow.push({}),s=>s.audit.rows[0].errors.push('error'),s=>s.audit.rows[0].nav[0].reachable=false,s=>s.audit.rows[0].scrollReset=false,s=>s.audit.externalResourceUrls.push('https://example.com'),s=>s.host.ownedProcessesRemaining=1,s=>s.host.switchDesktopCalled=true,s=>s.host.systemSettingsChanged=true,s=>s.host.threadDpiRestored=false,s=>s.audit.screenshots=[]]){const s=sample();mutate(s);assert.throws(()=>validateNativeReport(s,96))}
});
test('startup graph keeps stream-quality and refuses unexpected loading order',()=>{
 const {startupFiles}=require('../scripts/prepare-native-ui-audit.cjs');
 const index=fs.readFileSync(path.join(__dirname,'../resources/index.html'),'utf8');
 assert.ok(startupFiles(index).includes('/scripts/stream-quality.js'));
 assert.throws(()=>startupFiles('var files = ["/js/main.js"];'));
 assert.throws(()=>startupFiles('var files = ["/js/neutralino.js", "/../secret.js", "/js/main.js"];'));
});
test('native harness has no display switching, forced scaling, sandbox override or production paths',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../scripts/run-native-ui-audit.ps1'),'utf8');
 assert.doesNotMatch(source,/SwitchDesktop\(|SetProcessWindowStation\(|CreateWindowStationW\(|force-device-scale-factor|--no-sandbox|C:\/Users\/lop|Set-ItemProperty/);
 assert.match(source,/AssignProcessToJobObject/);assert.match(source,/ActiveProcesses/);assert.match(source,/ExpectedExeSha256/);assert.match(source,/RUNNER_TEMP/);
});
