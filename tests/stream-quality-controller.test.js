const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const { spawn } = require('node:child_process'), { EventEmitter } = require('node:events');
const adapter = require('../resources/js/stream-quality-job.js');
test('native controller adapter launches a real hidden Node process, pairs without logging secrets and shuts it down', { timeout: 12000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sq-adapter-test-')), events = new EventEmitter(), logs = [];
  let child, handle, closed = false;
  t.after(async () => { await handle?.stop(); if (child?.exitCode === null) child.kill(); for (const file of await fs.readdir(dir)) await fs.unlink(path.join(dir, file)); await fs.rmdir(dir); });
  const ns = { filesystem: { getJoinedPath: async (...parts) => path.join(...parts), writeFile: fs.writeFile, remove: fs.unlink },
    events: { on: async (name, fn) => events.on(name, fn), off: async (name, fn) => events.off(name, fn) }, os: {
      spawnProcess: async command => {
        const argv = [...command.matchAll(/"([^"]*)"|(\S+)/g)].map(m => m[1] ?? m[2]);
        child = spawn(argv[0], argv.slice(1), { windowsHide: true, stdio: ['pipe','pipe','pipe'] });
        const id = 'owned-fixture'; child.stdout.on('data', data => events.emit('spawnedProcess', { detail: { id, action: 'stdOut', data: String(data) } }));
        child.stderr.on('data', data => events.emit('spawnedProcess', { detail: { id, action: 'stdErr', data: String(data) } }));
        child.on('close', code => events.emit('spawnedProcess', { detail: { id, action: 'exit', data: code } }));
        return { id, pid: child.pid };
      },
      updateSpawnedProcess: async (id, action, text) => { assert.equal(id, 'owned-fixture'); assert.equal(action, 'stdIn'); child.stdin.write(text); },
      execCommand: async () => { throw Error('normal stop must not need taskkill'); }
    } };
  handle = await adapter.serve({ ns, port: 0, workDir: dir, nodePath: process.execPath,
    scriptPath: path.join(__dirname, '../resources/scripts/controller.cjs'), job: { endpoint: 'https://example.com', corePath: '/unused', config: { outbounds: [{ type: 'direct', tag: 'fixture' }] }, nodes: [{ key: 'a', tag: 'fixture', subscriptions: ['one','two'] }] } },
    { log: message => logs.push(message), onClose: () => { closed = true; }, onEvent: () => {} });
  assert.ok(handle.port > 0); assert.ok(handle.token.length >= 64);
  const url = `http://127.0.0.1:${handle.port}`;
  assert.equal((await fetch(url + '/v1/status')).status, 401);
  const state = await (await fetch(url + '/v1/status', { headers: { authorization: `Bearer ${handle.token}` } })).json(); assert.equal(state.catalog.length, 1);
  const page = await fetch(url + '/controller.js'); assert.equal(page.status, 200); assert.match(await page.text(), /remote-run/);
  await handle.stop(); assert.equal(closed, true); assert.equal(events.listenerCount('spawnedProcess'), 0); assert.equal((await fs.readdir(dir)).length, 0);
  assert.equal(logs.some(line => line.includes(handle.token)), false); assert.equal(child.exitCode, 0);
});
