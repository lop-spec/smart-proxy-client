const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const helpers = require('../resources/js/config-helpers.js');
const guard = require('../resources/js/site-failover.js');
const SQ = require('../resources/scripts/stream-quality.js');
const runner = require('../resources/scripts/stream-quality-runner.cjs');
const sample = (key = 'fixed', mbps = 50) => ({ metricKind: 'stream-quality-v1', ok: true, status: 'done', profileKey: key,
  measuredAt: 1000, roundId: 'r', sampleCount: 3, successfulSamples: 3, successRate: 1, verified: true,
  stream: { ok: true, flowPass: true, firstSampleMs: 100, jitterMs: 8, maxExtraGapMs: 25, burstRatio: 0 },
  download: { ok: true, mbps, bytes: 8388608, shortSample: false } });
test('new metrics persist exactly and failures/cancel keep historical success separate', () => {
  const good = sample();
  for (const failureScope of ['node','endpoint','measurement','cancelled','unsupported']) {
    const merged = helpers.mergeCodexProbeResult(good, { status: 'error', failureScope, error: 'fixture' });
    const saved = helpers.normalizeCodexProbeResult(merged);
    assert.equal(saved.download.mbps, 50); assert.equal(saved.stream.jitterMs, 8); assert.equal(saved.lastAttempt.failureScope, failureScope);
    assert.equal('tokPerSec' in saved, false); assert.equal(saved.profileKey, 'fixed');
  }
  assert.equal(helpers.normalizeCodexProbeResult(sample()).stream.flowPass, true);
});
test('passing fixed streams tie regardless of Mbps; profiles never mix; failed trials excluded', () => {
  const entries = [{ key: 'a' }, { key: 'b' }], results = new Map([['a', sample('same', 10)], ['b', sample('same', 100)]]);
  assert.deepEqual(helpers.rankCodexProbeEntries(entries, results), entries);
  const current = () => helpers.rankCurrentCodexProbeEntries(entries, results, new Map(entries.map(e => [e.key, { ok: null }])), new Set(['a','b']));
  assert.equal(current().length, 2); results.get('b').profileKey = 'different-edge'; assert.equal(current().length, 0);
  results.get('b').profileKey = 'same'; results.get('b').lastAttempt = { status: 'cancelled' }; assert.deepEqual(current(), [entries[0]]);
});
test('historical website failover accepts verified stream quality without model/account fields', () => {
  const entries = [{ key: 'current', tag: 'current', subscriptionId: 'one' }, { key: 'other', tag: 'other', subscriptionId: 'two' }];
  const result = guard.rankHistoricalAlternates(entries, { other: sample() }, 'current', ['current','other']);
  assert.equal(result.entries.length, 1); assert.equal(result.entries[0].node, 'other'); assert.equal(result.profile, 'fixed');
});
test('model store is archived untouched, independent execution has no model credential inputs', () => {
  const main = fs.readFileSync(path.join(__dirname, '../resources/js/main.js'), 'utf8');
  const body = main.slice(main.indexOf('async function runBatchTokProbe('), main.indexOf('// Shared result envelope'));
  assert.doesNotMatch(body, /codex-homes|tokenmix-key|benchmarkCodexModel|mainController\(|switchToNode\(|startMainCore\(/);
  assert.match(body, /nodes: usable.map/); assert.match(body, /SmartProxyStreamQuality.execute/);
  assert.doesNotMatch(main, /state\.settings\.codexProbeStore\s*=/);
  const html = fs.readFileSync(path.join(__dirname, '../resources/index.html'), 'utf8');
  assert.doesNotMatch(html, /id="probeProfile"|id="benchmarkCodexModel"|消耗账户额度/);
  assert.match(html, /stream-quality-job\.js/); assert.equal(SQ.PROFILE.downloadBytes, 8388608);
  assert.equal(typeof runner.isolatedConfig, 'function');
});
test('vendored protocol and runner match the pinned upstream bytes', () => {
  const manifest = require('../stream-quality.vendor.json');
  for (const [file, expected] of Object.entries(manifest.sha256)) {
    const data = fs.readFileSync(path.join(__dirname, '../resources/scripts', file));
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), expected, file);
  }
});
