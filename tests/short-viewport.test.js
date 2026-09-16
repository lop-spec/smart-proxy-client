'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('view change resets document position without focusing, saving, or touching native APIs; refresh preserves position',()=>{
 const scrolls=[],elements=new Map();const context=vm.createContext({console,Map,Set,Date,Promise,JSON,Math,Array,Object,URL,AbortController,TextEncoder,performance,setTimeout,clearTimeout,
  window:{__SMART_PROXY_TEST__:true,scrollTo:p=>scrolls.push(p)},SmartProxyConfig:require('../resources/js/config-helpers.js'),
  document:{querySelectorAll:()=>[],getElementById:id=>{if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',className:'',setAttribute(){},classList:{toggle(){}}});return elements.get(id)}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../resources/js/main.js'),'utf8'),context);
 vm.runInContext('switchView("settings")',context);assert.equal(scrolls.length,1);assert.equal(scrolls[0].top,0);assert.equal(scrolls[0].behavior,'instant');
 vm.runInContext('switchView("settings")',context);assert.equal(scrolls.length,1);
 vm.runInContext('switchView("cores")',context);assert.equal(scrolls.length,2);
});
test('short-height navigation has an independent overflow fallback and nodes precede quality options in DOM order',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../resources/styles.css'),'utf8'),html=fs.readFileSync(path.join(__dirname,'../resources/index.html'),'utf8');
 assert.match(css,/\.sidebar\{[^}]*min-height:0;overflow-y:auto;overscroll-behavior:contain/);
 assert.doesNotMatch(css,/min-height:(?:590|535)px/);assert.match(css,/@media\(max-height:650px\)/);
 assert.ok(html.indexOf('id="nodeGroups"')<html.indexOf('class="model-options panel"'));
});
