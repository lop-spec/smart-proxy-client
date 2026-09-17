'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('startup-boundary probe only reads existing objects and cannot launch or change their security',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../scripts/read-native-object-security.ps1'),'utf8');
 assert.match(source,/information=0x17/);assert.match(source,/GetUserObjectSecurity/);assert.match(source,/readOnly=\$true/);assert.match(source,/processStarted=\$false/);
 assert.doesNotMatch(source,/SetUserObjectSecurity|SetSecurityInfo|Set-Acl|CreateDesktop|CreateProcess|SwitchDesktop|SetProcessWindowStation/);
 const launcher=fs.readFileSync(path.join(__dirname,'../scripts/launch-native-ui-limited.ps1'),'utf8');assert.ok(launcher.indexOf('if($InspectDesktopSecurity)')<launcher.indexOf('[NativeLuaChild]::Start'));assert.match(launcher,/failed Medium wrapper was not rerun/);
});
