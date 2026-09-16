'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('native CI task uses the same interactive user without elevation and retains cleanup identity',()=>{
 const ps=fs.readFileSync(path.join(__dirname,'../scripts/launch-native-ui-limited.ps1'),'utf8');
 assert.match(ps,/RunLevel=0/);assert.match(ps,/LogonType=3/);assert.match(ps,/ExpectedSid/);assert.match(ps,/ExpectedSession/);assert.match(ps,/RequireNonElevated/);
 assert.match(ps,/exportSha256/);assert.match(ps,/Xml -cne \$export/);assert.match(ps,/DeleteTask\(\$name,0\)/);
 assert.doesNotMatch(ps,/RunLevel=1|RunAs|Set-Acl|Set-ItemProperty|AdjustTokenPrivileges|SwitchDesktop/);
});
