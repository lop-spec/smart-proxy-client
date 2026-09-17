'use strict';
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
test('native display inventory cannot label capability as UI acceptance or change desktop settings',()=>{
 const source=fs.readFileSync(path.join(root,'scripts/read-native-display-capability.ps1'),'utf8');
 assert.match(source,/nativeAcceptance=\$false/);
 assert.match(source,/GITHUB_ACTIONS -ne 'true'/);
 assert.match(source,/RUNNER_OS -ne 'Windows'/);
 for(const api of ['GetProcessWindowStation','GetDpiForWindow','EnumDisplayMonitors','DestroyWindow'])assert.ok(source.includes(api),api);
 assert.match(source,/SetThreadDpiAwarenessContext\(\$previous\)/);
 assert.doesNotMatch(source,/Import '(?:SwitchDesktop|ShowWindow|SetForegroundWindow|SetProcessWindowStation|ChangeDisplaySettings\w*|SetDisplayConfig)'/);
 assert.doesNotMatch(source,/(?:Set|New)-ItemProperty|force-device-scale-factor|--no-sandbox|Start-Process|CreateProcess/);
 assert.match(source,/Write-Warning/,'Unavailable capability must leave an unconditional reason');
});
test('CI records capability separately, with a hidden bounded legacy-PowerShell child and retained output',()=>{
 const ci=fs.readFileSync(path.join(root,'.github/workflows/ci.yml'),'utf8');
 assert.match(ci,/Read native display capability \(not UI acceptance\)/);
 assert.match(ci,/-WindowStyle Hidden/);
 assert.match(ci,/WaitForExit\(45000\)/);
 assert.match(ci,/native-display-capability\.json/);
 assert.match(ci,/Retain native display capability[\s\S]*?if: always\(\)/);
 assert.match(ci,/npm test/);assert.match(ci,/npm run verify:portable/);
});
