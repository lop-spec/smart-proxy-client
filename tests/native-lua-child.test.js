'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('LUA launch lowers only a cloned same-user token and uses owned hidden process isolation',()=>{
 const cs=fs.readFileSync(path.join(__dirname,'../scripts/native-lua-child.cs'),'utf8');
 assert.match(cs,/OpenProcessToken\(Process.GetCurrentProcess\(\).Handle,0x008B,/);assert.match(cs,/operation\+" \(Win32 "/);
 assert.match(cs,/CreateRestrictedToken\(original,5,0,/);assert.match(cs,/SetTokenInformation\(token,25,/);assert.doesNotMatch(cs,/SetTokenInformation\(original/);
 assert.match(cs,/child\.reduced\.integrityRid!=8192/);assert.match(cs,/child\.reduced\.elevation!=0/);assert.match(cs,/child\.reduced\.sid!=child\.before\.sid/);
 assert.match(cs,/CreateEnvironmentBlock\(out environment,token,false\)/);assert.match(cs,/0x08000404/);
 assert.ok(cs.indexOf('AssignProcessToJobObject')<cs.indexOf('ResumeThread'));
 assert.match(cs,/SmartProxy-Lua-/);assert.match(cs,/TerminateJobObject/);assert.match(cs,/remaining=IsolatedNative\.ActiveProcesses/);
 assert.doesNotMatch(cs,/AdjustTokenPrivileges|ImpersonateLoggedOnUser|SwitchDesktop|SetProcessWindowStation|SetSecurityInfo|SetUserObjectSecurity|DebugActiveProcess/);
});
