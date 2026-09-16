const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { spawn } = require('node:child_process'), { EventEmitter } = require('node:events');
const adapter = require('../resources/js/stream-quality-job.js');

async function executeFixture(t, job) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sq-native-job-')), events = new EventEmitter(), owners = [], output = [], logs = [];
  let child, deadline;
  t.after(async () => { clearTimeout(deadline); if (child?.exitCode === null) { const closed = new Promise(r => child.once('close', r)); child.kill(); await closed; }
    for (const file of await fs.readdir(dir)) await fs.unlink(path.join(dir, file)); await fs.rmdir(dir); });
  const ns = { filesystem: { getJoinedPath: async (...p) => path.join(...p), writeFile: fs.writeFile, remove: fs.unlink },
    events: { on: async (name, fn) => events.on(name, fn), off: async (name, fn) => events.off(name, fn) }, os: {
      spawnProcess: async command => {
        const args = [...command.matchAll(/"([^"]*)"|(\S+)/g)].map(m => m[1] ?? m[2]);
        child = spawn(args[0], args.slice(1), { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        const id = 'test-owned-job';
        for (const [stream, action] of [['stdout', 'stdOut'], ['stderr', 'stdErr']]) child[stream].on('data', b => events.emit('spawnedProcess', { detail: { id, action, data: String(b) } }));
        child.once('close', code => events.emit('spawnedProcess', { detail: { id, action: 'exit', data: code } }));
        return { id, pid: child.pid };
      },
      updateSpawnedProcess: async () => { throw Error('Completed job must close its own pipe; no cancellation required'); },
      execCommand: async () => { throw Error('Natural completion must not terminate a process tree or touch daily core'); }
    } };
  let value, error;
  try {
    value = await Promise.race([adapter.execute({ ns, workDir: dir, nodePath: process.execPath,
      scriptPath: path.join(__dirname, '../resources/scripts/stream-quality-runner.cjs'), job },
      { onJob: owner => owners.push(owner), log: line => logs.push(line), isCancelled: () => false, onEvent: event => output.push(event) }),
      new Promise((_, reject) => { deadline = setTimeout(() => reject(Error('UI adapter remained pending after terminal result')), 4000); })]);
  } catch (e) { error = e; } finally { clearTimeout(deadline); }
  assert.equal(owners.at(-1), null, 'UI ownership must clear at terminal exit');
  assert.equal(events.listenerCount('spawnedProcess'), 0, 'native listener must detach');
  assert.equal((await fs.readdir(dir)).length, 0, 'private job must be removed');
  assert.equal(output.filter(e => e.type === 'result').length, 1);
  assert.deepEqual(logs, []); assert.notEqual(child.exitCode, null);
  return { value, error };
}

test('native adapter releases the real helper and UI pending state after endpoint failure', { timeout: 6000 }, async t => {
  const server = http.createServer((_req, res) => { res.writeHead(503); res.end('fixture unavailable'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => { server.closeAllConnections(); server.close(); });
  const { value, error } = await executeFixture(t, { endpoint: `http://127.0.0.1:${server.address().port}`, rounds: 3, nodes: [{ key: 'one' }, { key: 'two' }] });
  assert.ifError(error); assert.equal(value.ok, true); assert.equal(value.channelFailure.failureScope, 'endpoint');
  assert.equal(value.outcomes.length, 2); assert.ok(value.outcomes.every(o => o.value.failureScope === 'endpoint'));
});

test('native adapter rejects invalid work and clears UI ownership without waiting for watchdog', { timeout: 6000 }, async t => {
  const { value, error } = await executeFixture(t, { endpoint: 'https://unused.invalid', rounds: 2, nodes: [{ key: 'one' }] });
  assert.equal(value, undefined); assert.match(error.message, /invalid round count/);
});
