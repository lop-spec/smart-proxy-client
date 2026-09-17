'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../resources/styles.css'),'utf8');
function variable(name){const value=css.match(new RegExp('--'+name+':(#[0-9a-f]{6})'))?.[1];assert.ok(value,'Missing theme variable '+name);return value}
function luminance(hex){const c=hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
test('Atelier supporting text remains readable on porcelain and lavender surfaces',()=>{
 for(const name of ['bg','surface','surface-2','accent-dim'])assert.ok(contrast(variable('muted'),variable(name))>=4.5,`${name}: ${contrast(variable('muted'),variable(name)).toFixed(3)} < 4.5`);
});
test('placeholder text meets normal-text contrast on form and transparent search surfaces',()=>{
 const declaration=css.match(/input::placeholder,textarea::placeholder\{color:([^;}]+)/)?.[1];assert.ok(declaration);
 const color=declaration==='var(--muted)'?variable('muted'):declaration;
 for(const background of ['bg','surface'])assert.ok(contrast(color,variable(background))>=4.5,`${background}: ${contrast(color,variable(background)).toFixed(3)} < 4.5`);
});
