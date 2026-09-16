const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const helpers = require('../resources/js/config-helpers.js');
const guard = require('../resources/js/site-failover.js');
const SQ = require('../resources/scripts/stream-quality.js');
const result = () => ({ metricKind: 'stream-quality-v1', measurement: 'sse-only', ok: true, status: 'done', profileKey: 'fixed|sse-only',
  measuredAt: 1000, sampleCount: 3, successfulSamples: 3, successRate: 1, verified: true,
  stream: { ok: true, flowPass: true, firstSampleMs: 100, jitterMs: 8, maxExtraGapMs: 25, burstRatio: 0, receivedSamples: 401 } });

test('SSE-only results normalize and survive failures without requiring or fabricating Mbps', () => {
  const good = helpers.normalizeCodexProbeResult(result());
  assert.equal(SQ.isResult(good), true); assert.equal(good.measurement, 'sse-only'); assert.equal('download' in good, false);
  for (const failureScope of ['endpoint', 'measurement', 'node', 'cancelled']) {
    const saved = helpers.normalizeCodexProbeResult(helpers.mergeCodexProbeResult(good, { status: 'error', failureScope, error: 'fixture' }));
    assert.equal(saved.stream.jitterMs, 8); assert.equal(saved.lastAttempt.failureScope, failureScope);
    assert.equal(SQ.isResult(saved), true); assert.equal('download' in saved, false);
  }
  const invalid = { ...result(), measurement: undefined }; assert.equal(helpers.successfulCodexProbeResult(invalid), false);
});

test('switching to SSE-only archives legacy download results across success and cancellation', () => {
  const legacy = { ...result(), measurement: 'sse-and-download', profileKey: 'legacy', download: { ok: true, mbps: 12, bytes: 8388608 } };
  let saved = helpers.normalizeCodexProbeResult(helpers.mergeCodexProbeResult(legacy, result()));
  assert.equal('download' in saved, false); assert.equal(saved.legacyDownloadResult.download.mbps, 12);
  assert.equal(saved.legacyDownloadResult.profileKey, 'legacy');
  for (const next of [result(), { status: 'cancelled', failureScope: 'cancelled' }]) {
    saved = helpers.normalizeCodexProbeResult(helpers.mergeCodexProbeResult(saved, next));
    assert.equal(saved.legacyDownloadResult.download.mbps, 12); assert.equal(saved.profileKey, 'fixed|sse-only');
  }
});

test('verified SSE-only history remains usable for historical failover, no new probes', () => {
  const entries = [{ key: 'current', tag: 'current', subscriptionId: 'one' }, { key: 'other', tag: 'other', subscriptionId: 'two' }];
  const ranked = guard.rankHistoricalAlternates(entries, { other: result() }, 'current', ['current', 'other']);
  assert.equal(ranked.profile, 'fixed|sse-only'); assert.equal(ranked.entries[0].node, 'other');
  assert.equal(ranked.entries[0].result.measurement, 'sse-only');
});

test('desktop presentation renders real SSE fields without dereferencing missing download', () => {
  const main = fs.readFileSync(path.join(__dirname, '../resources/js/main.js'), 'utf8');
  const source = main.slice(main.indexOf('function nodeCodexPresentation('), main.indexOf('function codexProbeController('));
  const state = { codexProbePendingKeys: new Set(), codexProbeCancelRequested: false };
  const render = new Function('state', 'StreamQuality', source + '\nreturn nodeCodexPresentation;')(state, SQ);
  const view = render(result(), 'node'); assert.match(view.text, /流稳.*8 ms/); assert.doesNotMatch(view.text, /Mbps|tok/);
  assert.match(view.title, /首段 100 ms/);
  const html = fs.readFileSync(path.join(__dirname, '../resources/index.html'), 'utf8');
  assert.match(html, /id="testAllCodexBtn" class="primary">一键 SSE 网络测试/);
  assert.equal((html.match(/id="testAllCodexBtn"/g) || []).length, 1);
  assert.equal((html.match(/id="testNetworkBtn"/g) || []).length, 1);
  assert.match(main, /job: \{ endpoint, rounds, includeDownload: false/);
});
