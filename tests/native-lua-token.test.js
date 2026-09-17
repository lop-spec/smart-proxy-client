'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('built-in Administrator token probe is capability-only and never enables sandbox exemptions',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../scripts/read-native-lua-token.ps1'),'utf8');
 assert.match(source,/CreateRestrictedToken\(original,5,0,/);assert.match(source,/processStarted=false/);assert.match(source,/parentUnchanged/);
 assert.doesNotMatch(source,/CreateProcess|Start-Process|SetTokenInformation|AdjustTokenPrivileges|Impersonate|Set-Acl|Set-ItemProperty/);
 const launcher=fs.readFileSync(path.join(__dirname,'../scripts/launch-native-ui-limited.ps1'),'utf8');assert.match(launcher,/EndsWith\('-500'\)/);assert.match(launcher,/known-failing task path will not be repeated/);
});
