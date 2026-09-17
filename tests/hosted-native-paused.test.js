'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('hosted startup experiments stay paused without converting a missing native gate into a pass',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../.github/workflows/ci.yml'),'utf8');
 assert.match(source,/hosted startup path paused/);assert.match(source,/throw 'Native DPI acceptance is NOT passed/);
 assert.doesNotMatch(source,/launch-native-ui-limited\.ps1|read-native-object-security\.ps1|CaptureControllerFailure|InspectDesktopSecurity/);
});
