// Read-only UI fixture server. No native bridge, credentials, live settings or external requests.
'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../resources');
const port = Number(process.env.SMART_PROXY_PREVIEW_PORT || 4178);
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.otf':'font/otf', '.png':'image/png', '.svg':'image/svg+xml' };
http.createServer((req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'");
  let url; try { url = decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname); } catch { res.writeHead(400).end(); return; }
  if (req.method !== 'GET' || url.includes('..') || url.includes('private-config') || url.includes('smart-proxy-data')) { res.writeHead(403).end(); return; }
  if (url === '/__native-guard.js') { res.setHeader('Content-Type',mime['.js']); res.end(`window.__SMART_PROXY_TEST__=true; window.__fixture={calls:[],errors:[],ready:false}; window.addEventListener('error',e=>__fixture.errors.push(e.message)); window.addEventListener('unhandledrejection',e=>__fixture.errors.push(String(e.reason))); window.Neutralino=new Proxy({}, {get:(_,group)=>new Proxy({}, {get:(_,name)=>()=>{throw Error('Preview blocks native API: '+group+'.'+name)}})});`); return; }
  let file = url === '/__fixture.js' ? path.resolve(__dirname,'../tests/fixtures/atelier-preview.js') : path.join(root,url === '/' ? 'index.html' : url);
  if (url !== '/__fixture.js' && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    let body=fs.readFileSync(file);
    if (url === '/') body=body.toString('utf8').replace('"/js/neutralino.js",','"/__native-guard.js",').replace('"/js/main.js"','"/js/main.js", "/__fixture.js"');
    res.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream'); res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port,'127.0.0.1',()=>console.log(`Read-only ATELIER fixture: http://127.0.0.1:${port}/ (no live proxy access)`));
