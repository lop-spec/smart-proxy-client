'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {sanitizeErrors}=require('../scripts/collect-native-error-logs.cjs');
test('startup diagnostics keep errors but never raw credentials, URLs or verbose profile records',()=>{
 const result=sanitizeErrors('[INFO] profile record\n[ERROR] restricted token cannot open desktop\n[ERROR] NL_TOKEN=private\n[FATAL] Authorization: Bearer private\n[ERROR] Cookie: private\n[ERROR] open https://user:password@example.com/path failed');
 assert.deepEqual(result.lines,['[ERROR] restricted token cannot open desktop','[ERROR] open [URL redacted] failed']);assert.equal(result.redactedCredentialLines,3);
 assert.equal(sanitizeErrors(Array(80).fill('[ERROR] same').join('\n')).lines.length,20);
});
test('startup context remains read-only, owned-process-scoped and outside private profiles',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../scripts/collect-native-startup-context.ps1'),'utf8');
 assert.match(source,/ownedPid/);assert.match(source,/AppPath/);assert.match(source,/Get-WinEvent/);assert.match(source,/nativeAcceptance=\$false/);
 assert.doesNotMatch(source,/Set-ItemProperty|Set-Acl|Start-Process|SwitchDesktop|Stop-Process|\.dmp/);
});
