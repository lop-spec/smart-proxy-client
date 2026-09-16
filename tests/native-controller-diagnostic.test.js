'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('controller diagnostic verifies exact x64 callback bytes and observes only its owned child',()=>{
 const cs=fs.readFileSync(path.join(__dirname,'../scripts/native-controller-diagnostic.cs'),'utf8');
 assert.match(cs,/Controller callback signature changed/);assert.match(cs,/pid!=owner/);assert.match(cs,/creator!=GetCurrentThreadId\(\)/);assert.match(cs,/status=0x80010001/);
 assert.match(cs,/U32\(context,136\)/);assert.match(cs,/Marshal.ReadInt64\(context,184\)/);assert.match(cs,/Marshal.ReadInt64\(context,248\)/);
 assert.doesNotMatch(cs,/DebugActiveProcess|SetThreadContext|WriteProcessMemory|ReadProcessMemory|MiniDumpWriteDump|AdjustTokenPrivileges/);
 const ps=fs.readFileSync(path.join(__dirname,'../scripts/run-native-ui-audit.ps1'),'utf8');
 assert.match(ps,/if\(-not \$result\.debuggerAttached\)\{\$windows=\[IsolatedNative\]::Windows/);
 assert.match(ps,/VerifyImage\(\$exe\)/);assert.match(ps,/\$creationFlags=\$creationFlags -bor 2/);assert.match(ps,/diagnosticOnly=\[bool\]\$CaptureControllerFailure/);
});
