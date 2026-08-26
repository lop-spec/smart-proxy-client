const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const helpers = require("../resources/js/config-helpers.js");
const batchProbe = require("../resources/scripts/dual-model-probe.js");

const previous = {
  status: "done",
  node: "node-a",
  anthropicOk: true,
  tokPerSec: 42.5,
  tokEst: 256,
  tokTtftMs: 320,
  tokStreamMs: 6024,
  requestedModel: "gpt-5.3-codex-spark",
  resolvedModel: "gpt-5.3-codex-spark",
  resolvedModelVerified: true,
  measuredAt: 100
};

assert.deepEqual(
  helpers.mergeCodexProbeResult(previous, { status: "pending" }),
  previous,
  "pending must not replace the last successful tok/s"
);
assert.deepEqual(
  helpers.mergeCodexProbeResult(previous, { status: "cancelled" }),
  previous,
  "cancelling an unfinished probe must not be treated as a measured node failure"
);
const failedProbe = helpers.mergeCodexProbeResult(previous, { status: "error", error: "timeout" });
assert.equal(failedProbe.status, "error", "an attempted node failure must replace the previous success");
assert.equal(failedProbe.error, "timeout");
assert.equal(failedProbe.tokPerSec, undefined, "an attempted node failure must clear the previous tok/s");

const failedGate = helpers.mergeCodexProbeResult(previous, {
    status: "done",
    anthropicOk: false,
    anthropicHttp: 0,
    error: "gate failed"
  });
assert.equal(failedGate.anthropicOk, false, "an attempted gate failure must replace the previous success");
assert.equal(failedGate.tokPerSec, undefined, "an attempted gate failure must clear the previous tok/s");
assert.deepEqual(
  Object.keys(helpers.normalizeCodexProbeStore({ results: { a: failedProbe } }).results),
  [],
  "a finalized failure must remove the previous success from restart persistence"
);

const fresh = helpers.mergeCodexProbeResult(previous, {
  status: "done",
  anthropicOk: true,
  tokPerSec: 88.8,
  tokEst: 300,
  tokTtftMs: 210,
  tokStreamMs: 3378,
  requestedModel: "gpt-5.3-codex-spark",
  resolvedModel: "gpt-5.3-codex-spark",
  resolvedModelVerified: true
});
assert.equal(fresh.tokPerSec, 88.8, "successful new tok/s must replace the old value");

const entries = [
  { key: "a", tag: "tag-a", node: "node-a" },
  { key: "b", tag: "tag-b", node: "node-b" },
  { key: "c", tag: "tag-c", node: "node-c" },
  { key: "d", tag: "tag-d", node: "node-d" }
];
const ranked = helpers.rankCodexProbeEntries(entries, {
  a: { status: "done", anthropicOk: true, tokPerSec: 50, tokTtftMs: 400 },
  b: { status: "done", anthropicOk: true, tokPerSec: 50, tokTtftMs: 180 },
  c: { status: "done", anthropicOk: true, tokPerSec: 20, tokTtftMs: 100 }
});
assert.deepEqual(
  ranked.map((entry) => entry.key),
  ["b", "a", "c", "d"],
  "next probe queue must follow the previous tok/s ranking and TTFB tie-break"
);

const crossModelEntries = [
  { key: "slow-best" },
  { key: "slow-base" },
  { key: "fast-base" },
  { key: "fast-best" }
];
const crossModelRanked = helpers.rankCodexProbeEntries(crossModelEntries, {
  "slow-best": { status: "done", anthropicOk: true, tokPerSec: 30, tokTtftMs: 220, resolvedModel: "model-slow" },
  "slow-base": { status: "done", anthropicOk: true, tokPerSec: 20, tokTtftMs: 220, resolvedModel: "model-slow" },
  "fast-base": { status: "done", anthropicOk: true, tokPerSec: 60, tokTtftMs: 220, resolvedModel: "model-fast" },
  "fast-best": { status: "done", anthropicOk: true, tokPerSec: 70, tokTtftMs: 220, resolvedModel: "model-fast" }
});
assert.deepEqual(
  crossModelRanked.map((entry) => entry.key),
  ["slow-best", "fast-best", "fast-base", "slow-base"],
  "cross-model ranking must compare each node with its model median instead of comparing incompatible raw tok/s"
);

const sparseModelRanked = helpers.rankCodexProbeEntries(crossModelEntries.slice(0, 3), {
  "slow-best": { status: "done", anthropicOk: true, tokPerSec: 30, tokTtftMs: 220, resolvedModel: "model-slow" },
  "fast-base": { status: "done", anthropicOk: true, tokPerSec: 60, tokTtftMs: 220, resolvedModel: "model-fast" }
});
assert.deepEqual(
  sparseModelRanked.map((entry) => entry.key),
  ["fast-base", "slow-best", "slow-base"],
  "cross-model ranking must fall back to raw tok/s until every model has at least two successful samples"
);

const currentWinners = helpers.rankCurrentCodexProbeEntries(
  entries,
  {
    a: { ...previous, tokPerSec: 100 },
    b: { ...previous, tokPerSec: 60 }
  },
  new Map([
    ["a", { ok: false }],
    ["b", { ok: true }]
  ]),
  new Set(["b"])
);
assert.deepEqual(
  currentWinners.map((entry) => entry.key),
  ["b"],
  "a stale fast result must not win after its current gate or tok probe failed"
);

const currentScopedEntries = [
  ...crossModelEntries,
  { key: "stale-fast-low-1" },
  { key: "stale-fast-low-2" }
];
const currentResult = (model, tokPerSec) => ({
  status: "done",
  anthropicOk: true,
  tokPerSec,
  tokTtftMs: 220,
  requestedModel: model,
  resolvedModel: model,
  resolvedModelVerified: true
});
const currentScopedResults = {
  "slow-best": currentResult("model-slow", 30),
  "slow-base": currentResult("model-slow", 20),
  "fast-base": currentResult("model-fast", 60),
  "fast-best": currentResult("model-fast", 70),
  "stale-fast-low-1": currentResult("model-fast", 1),
  "stale-fast-low-2": currentResult("model-fast", 2)
};
const currentKeys = new Set(crossModelEntries.map((entry) => entry.key));
const currentScopedRanked = helpers.rankCurrentCodexProbeEntries(
  currentScopedEntries,
  currentScopedResults,
  new Map(currentScopedEntries.map((entry) => [entry.key, { ok: currentKeys.has(entry.key) }])),
  currentKeys
);
assert.deepEqual(
  currentScopedRanked.map((entry) => entry.key),
  ["slow-best", "fast-best", "fast-base", "slow-base"],
  "current-round model medians must exclude stale or failed samples"
);

const store = helpers.normalizeCodexProbeStore({
  version: 1,
  updatedAt: 123,
  results: {
    a: previous,
    bad: { status: "error", tokPerSec: 0, error: "timeout" }
  }
});
assert.deepEqual(Object.keys(store.results), ["a"], "only successful tok/s values are restart-persistent");
assert.equal(store.results.a.tokPerSec, 42.5);

const effectiveStore = helpers.normalizeCodexProbeStore({
  results: {
    current: {
      ...previous,
      tokPerSec: 23.4,
      tokElapsedMs: 4529,
      tokDeltaCount: 3,
      tokStreamBuffered: true,
      timingSource: "request-end-to-end-tok",
      probeModelId: "codex-acct2"
    }
  }
});
assert.equal(effectiveStore.results.current.tokElapsedMs, 4529, "the unified elapsed window must survive restart persistence");
assert.equal(effectiveStore.results.current.tokStreamBuffered, true, "buffer correction evidence must survive restart persistence");
assert.equal(effectiveStore.results.current.probeModelId, "codex-acct2", "the measuring route must survive restart persistence");

const rejectedStore = helpers.normalizeCodexProbeStore({
  version: 1,
  results: {
    failedGate: { ...previous, anthropicOk: false },
    unverifiedModel: { ...previous, resolvedModelVerified: false }
  }
});
assert.deepEqual(
  Object.keys(rejectedStore.results),
  [],
  "failed gates and unverified models must never enter the persistent speed history"
);

assert.equal(
  helpers.findRestorableNode(entries, { lastSelectedNodeKey: "b", lastSelectedNodeTag: "tag-a" }).key,
  "b",
  "stable node key must win during restart restore"
);
assert.equal(
  helpers.findRestorableNode(entries, { lastSelectedNodeKey: "gone", lastSelectedNodeTag: "tag-a" }).key,
  "a",
  "saved tag must recover when the stable key no longer exists"
);

const probeScript = fs.readFileSync(
  path.join(__dirname, "..", "resources", "scripts", "codex-subscription-probe.ps1"),
  "utf8"
);
assert.match(probeScript, /mcp_servers=\{\}/, "probe child must disable inherited MCP servers");
assert.match(probeScript, /loopbackBypass\s*=\s*"127\.0\.0\.1,localhost,::1"/, "loopback bypass must be explicit");
assert.match(probeScript, /EnvironmentVariables\["NO_PROXY"\]\s*=\s*\$loopbackBypass/, "loopback traffic must bypass the measured node");
assert.doesNotMatch(
  probeScript,
  /resolvedModel\s*=\s*\$Model/,
  "missing model evidence must fail instead of being filled from the request"
);

const mainScript = fs.readFileSync(
  path.join(__dirname, "..", "resources", "js", "main.js"),
  "utf8"
);
const storeResultSource = mainScript.slice(
  mainScript.indexOf("function storeCodexProbeResult("),
  mainScript.indexOf("function markCodexProbePending(")
);
assert.match(
  storeResultSource,
  /syncCodexProbeStore\(\)/,
  "every finalized probe result must persist so a failed node cannot resurrect its previous tok/s after restart"
);
assert.doesNotMatch(
  mainScript,
  /previous value kept/,
  "failure logs must not claim that the previous tok/s was kept"
);
const catalogRefreshSource = mainScript.slice(
  mainScript.indexOf("async function refreshSubscriptionNodeCatalog("),
  mainScript.indexOf("async function loadMergedCachedSubscriptionPoolForStartup()")
);
assert.doesNotMatch(
  catalogRefreshSource,
  /nodeCodexResults\s*=.*filter/,
  "catalog refresh and restart hydration must retain historical tok/s until a new valid tok/s replaces it"
);
assert.equal(
  (mainScript.match(/selectCatalogNode\(/g) || []).length,
  2,
  "catalog selection remains limited to the selector definition and the explicit manual click"
);
assert.match(
  mainScript,
  /selectCatalogNode\(button\.dataset\.nodeKey, \{ manual: true \}\)/,
  "the remaining node selection path must be explicitly manual"
);
const switchFunctionSource = mainScript.slice(
  mainScript.indexOf("async function switchToNode("),
  mainScript.indexOf("async function resetActiveConnections(")
);
assert.match(
  switchFunctionSource,
  /options\.manual !== true/,
  "the low-level node switch must reject callers without an explicit manual origin"
);
const leagueWinnerSource = mainScript.slice(
  mainScript.indexOf("const verifiedRanked = SmartProxyConfig.rankCurrentCodexProbeEntries("),
  mainScript.indexOf("const successful = entries.filter(")
);
assert.match(
  leagueWinnerSource,
  /options\.autoSwitchWinner === true[\s\S]*!options\.continuous[\s\S]*!state\.codexProbeCancelRequested[\s\S]*tokModelFailureCount === 0/,
  "only a completed manual benchmark with no unresolved model failures may authorize the winner switch"
);
assert.match(
  leagueWinnerSource,
  /switchToNode\([\s\S]*manual: true[\s\S]*manualProbeWinner: true/,
  "the benchmark winner switch must be marked as originating from the manual benchmark"
);
assert.match(
  mainScript,
  /testAllCodexNodes\(\{ autoSwitchWinner: true \}\)/,
  "the manual full-benchmark button must request a winner switch"
);
assert.match(
  mainScript,
  /testAllCodexNodes\(\{ entries, autoSwitchWinner: true \}\)/,
  "the manual group benchmark must request a winner switch within that group"
);
assert.doesNotMatch(
  mainScript.slice(mainScript.indexOf("async function runContinuousCompetition()"), mainScript.indexOf("// ---- 入口域名健康检查 ----")),
  /autoSwitchWinner\s*:\s*true|switchToNode\(/,
  "continuous/background probing must never switch nodes"
);
assert.doesNotMatch(
  mainScript,
  /重启代理以应用新订阅节点/,
  "missing probe lanes must be skipped without asking an active runtime restart"
);
const scheduledApplySource = mainScript.slice(
  mainScript.indexOf("function scheduleConfigApply()"),
  mainScript.indexOf("// ---- 节点分组与抖动判别 ----")
);
assert.doesNotMatch(
  scheduledApplySource,
  /applyRuntimeSettings\(|loadMergedCachedSubscriptionPoolForStartup\(/,
  "subscription recovery must not restart or rebuild the running core"
);
const runtimeApplySource = mainScript.slice(
  mainScript.indexOf("async function applyRuntimeSettings()"),
  mainScript.indexOf("function saveSettings(options = {})")
);
assert.doesNotMatch(
  runtimeApplySource,
  /killProcess\(|killCorePorts\(|startMainCore\(|switchToNode\(/,
  "saving configuration must leave the running core and selected node untouched"
);
assert.match(mainScript, /dual-model-probe\.js/, "the UI must launch one out-of-process batch helper per round");
assert.match(mainScript, /gpt-5\.3-codex-spark/, "the Codex subscription model must remain in the pool");
assert.match(mainScript, /gpt-4o-mini/, "the TokenMix model must be restored as the second pool member");
assert.doesNotMatch(
  mainScript,
  /TOK_BATCH_SIZE/,
  "model availability must span the whole round, not reset per mini-batch"
);
assert.match(
  mainScript,
  /runBatchTokProbe\(reachable\.map\(/,
  "all remaining nodes must stay in one pool so a failed model cannot re-enter later in the round"
);
const bulkProbePreamble = mainScript.slice(
  mainScript.indexOf("async function testAllCodexNodes(options = {})"),
  mainScript.indexOf("state.codexProbeRunning = true", mainScript.indexOf("async function testAllCodexNodes(options = {})"))
);
assert.match(
  bulkProbePreamble,
  /if \(!state\.subscriptionNodeCatalog\.length\) await refreshSubscriptionNodeCatalog\(\)/,
  "a warm manual benchmark must reuse the live catalog instead of rereading every YAML cache"
);
const bulkProbeDnsSource = mainScript.slice(
  mainScript.indexOf("const deferEndpointDnsRefresh ="),
  mainScript.indexOf("// 分组测速", mainScript.indexOf("const deferEndpointDnsRefresh ="))
);
assert.match(bulkProbeDnsSource, /if \(!deferEndpointDnsRefresh\)[\s\S]*await refreshEndpointDnsHealth/, "forced and continuous DNS checks must still block for fresh evidence");
assert.match(bulkProbeDnsSource, /if \(deferEndpointDnsRefresh\)[\s\S]*setTimeout\([\s\S]*refreshEndpointDnsHealth/, "normal manual benchmarking must defer an expired DNS refresh until after the measured round");
assert.match(mainScript, /elapsedMs:\s*benchmarkElapsedMs/, "the UI result must expose click-to-completion benchmark time");

const batchFunctionSource = mainScript.slice(
  mainScript.indexOf("async function runBatchTokProbe(items)"),
  mainScript.indexOf("// 单节点完整测速")
);
assert.match(batchFunctionSource, /Neutralino\.os\.execCommand\(/, "the round must cross Neutralino's serialized process boundary only once");
assert.match(batchFunctionSource, /dualModelProbeScriptPath\(/, "the one process launch must be the batch helper");
assert.doesNotMatch(
  batchFunctionSource,
  /runCodexSubscriptionModelProbe\(|runTokenMixModelProbe\(/,
  "the round must not launch one Neutralino command per node"
);

const batchScript = fs.readFileSync(path.join(__dirname, "..", "resources", "scripts", "dual-model-probe.js"), "utf8");
assert.match(batchScript, /child_process/, "the helper must own the real child-process concurrency");
assert.match(batchScript, /createSemaphore\(plan\.tokenMixProcesses\)/, "TokenMix child processes must stay below the verified streaming limit");
assert.match(batchScript, /chatgpt\.com\/backend-api\/codex\/responses/, "Codex routes must skip the per-node app-server startup delay");
assert.match(batchScript, /DEFAULT_ROUND_DEADLINE_MS = 8000/, "model failover must share one hard whole-round time budget");
assert.match(mainScript, /CODEX_TOK_PROBE_TIMEOUT_S = 8/, "Codex nodes must receive the full round budget before a node failure is final");
assert.match(mainScript, /TOKENMIX_TOK_PROBE_TIMEOUT_S = 8/, "TokenMix nodes must use the same full-round ceiling");
assert.match(batchScript, /roundDeadlineAt/, "late takeover work must inherit the remaining round deadline");
assert.match(batchScript, /const routeTimeoutSeconds = Math\.ceil\(roundDeadlineMs \/ 1000\)/, "the live pre-upgrade UI's 5s argument must be raised to the 8s round budget");
assert.match(batchScript, /codexAccountAuth\(options\.codexHome,\s*options\)/, "each Codex route must load and refresh its own discovered account");
assert.match(batchScript, /header = "Authorization: Bearer /, "the account token must be sent to the real Codex endpoint");
assert.match(batchScript, /header = "chatgpt-account-id: /, "the real account id must select the matching subscription");
assert.match(batchScript, /child\.stdin\.end\(\[/, "credentials must travel through child stdin");
const codexCurlArgSource = batchScript.slice(
  batchScript.indexOf('child = child_process.spawn(\n          "curl.exe"'),
  batchScript.indexOf('child.stdout.setEncoding("utf8")')
);
assert.doesNotMatch(codexCurlArgSource, /accessToken|accountId/, "credentials must never enter the curl argv");
assert.doesNotMatch(batchScript, /fs\.(?:copyFile|link|writeFile)Sync\([^\n]*auth/, "account credentials must not be copied or rewritten");
const codexRequestHotPath = batchScript.slice(
  batchScript.indexOf("function runCodexProbe("),
  batchScript.indexOf("let tokenMixKeyPromise")
);
assert.doesNotMatch(codexRequestHotPath, /app-server/, "the slow per-node Codex runtime must not return to the request hot path");
assert.match(batchScript, /CODEX_AUTH_CACHE/, "a lightweight auth refresh must be shared once per account, never once per node");
assert.match(batchScript, /Do not use tools, count words, verify a length, reason, or explain/, "the speed request must avoid model-side counting work");
assert.match(batchScript, /roughly 80 words; exact length does not matter/, "the real Codex benchmark must retain a useful streamed payload without an exact-count trap");
assert.match(batchScript, /reasoning:\s*\{ effort: "low" \}/, "Spark must use its lowest supported reasoning effort");
assert.doesNotMatch(batchScript, /reasoning\.encrypted_content/, "a one-turn speed probe must not download unused encrypted reasoning state");
assert.match(batchScript, /chatgpt-responses-sse-model/, "the resolved model must come from the real SSE response");
assert.match(batchScript, /Count from 1 to 60 in words/, "the real TokenMix streamed benchmark must remain intact");
assert.match(batchScript, /tokPerSec: effectiveTokPerSec\(textTokens, elapsedMs\)/, "Codex must score the full request interval");
assert.match(batchScript, /tokPerSec: effectiveTokPerSec\(tokEst, elapsedMs\)/, "TokenMix must use the same full-request score");
assert.match(batchScript, /deltaCount < 4 \|\| deltaStreamMs < CODEX_BUFFERED_STREAM_MS/, "short or coalesced Codex streams must retain buffering evidence");
assert.equal(
  (batchScript.match(/timingSource: EFFECTIVE_RATE_TIMING_SOURCE/g) || []).length,
  2,
  "both live model implementations must persist one comparable timing source"
);
assert.equal(
  (batchScript.match(/streamMs: elapsedMs/g) || []).length,
  2,
  "a currently running pre-upgrade UI must receive an end-to-end denominator immediately"
);
assert.match(mainScript, /tok\.deliveryStreamMs \?\? tok\.streamMs/, "the next UI load must retain the separate delivery window");
assert.equal(batchProbe.codexChannelFailure(401, "unauthorized"), true, "account authentication failure must disable only that route");
assert.equal(batchProbe.codexChannelFailure(429, "rate limit"), true, "account quota failure must trigger takeover");
assert.equal(batchProbe.codexChannelFailure(400, "generic exit response"), false, "a generic node HTTP response must not disable an account");
assert.equal(batchProbe.codexChannelFailure(400, "Unsupported parameter: test"), true, "a protocol-level rejection must disable the affected route");
assert.equal(batchProbe.codexChannelFailure(403, "blocked by this exit"), false, "a node-specific 403 must stay final for that node");

const bufferedIndiaRate = batchProbe.effectiveTokPerSec(106, 4529);
const fasterSingaporeRate = batchProbe.effectiveTokPerSec(102, 2390);
assert.equal(bufferedIndiaRate, 23.4, "a 51ms buffered burst must include its 4478ms first-token wait");
assert.equal(fasterSingaporeRate, 42.7, "effective tok/s must cover the whole request-to-last-token interval");
assert.ok(
  fasterSingaporeRate > bufferedIndiaRate,
  "the real screenshot samples must rank by user-visible completion speed, not buffered delivery burst"
);
assert.equal(batchProbe.effectiveTokPerSec(100, 0), 0, "an invalid elapsed time must never create an infinite speed");

(async () => {
  const homesFixture = fs.mkdtempSync(path.join(os.tmpdir(), "smart-proxy-codex-homes-"));
  try {
    for (const id of ["acct3", "primary", "acct2"]) {
      fs.mkdirSync(path.join(homesFixture, id), { recursive: true });
      fs.writeFileSync(path.join(homesFixture, id, "auth.json"), "{}\n", "utf8");
    }
    fs.mkdirSync(path.join(homesFixture, "ignored-no-auth"), { recursive: true });
    assert.deepEqual(
      batchProbe.discoverCodexHomes(homesFixture).map((item) => item.id),
      ["primary", "acct2", "acct3"],
      "the three existing account homes must be auto-discovered in stable order"
    );
  }
  finally {
    fs.rmSync(homesFixture, { recursive: true, force: true });
  }

  const refreshFixture = fs.mkdtempSync(path.join(os.tmpdir(), "smart-proxy-codex-refresh-"));
  try {
    const accountHome = path.join(refreshFixture, "expired-account");
    const fakeCli = path.join(refreshFixture, "fake-codex.js");
    fs.mkdirSync(accountHome, { recursive: true });
    const jwt = (expiresAt) => `header.${Buffer.from(JSON.stringify({ exp: expiresAt })).toString("base64url")}.signature`;
    const freshToken = jwt(Math.floor(Date.now() / 1000) + 3600);
    const freshAuth = {
      auth_mode: "chatgpt",
      tokens: { access_token: freshToken, refresh_token: "fixture-refresh", account_id: "fixture-account" }
    };
    fs.writeFileSync(path.join(accountHome, "auth.json"), JSON.stringify({
      auth_mode: "chatgpt",
      tokens: {
        access_token: jwt(Math.floor(Date.now() / 1000) - 60),
        refresh_token: "fixture-refresh",
        account_id: "fixture-account"
      }
    }), "utf8");
    fs.writeFileSync(fakeCli, [
      'const fs = require("node:fs");',
      'const readline = require("node:readline");',
      `const auth = ${JSON.stringify(freshAuth)};`,
      'const rl = readline.createInterface({ input: process.stdin });',
      'rl.on("line", (line) => {',
      '  const message = JSON.parse(line);',
      '  if (message.method === "initialize") process.stdout.write(JSON.stringify({ id: message.id, result: {} }) + "\\n");',
      '  if (message.method === "account/read") {',
      '    fs.writeFileSync(require("node:path").join(process.env.CODEX_HOME, "auth.json"), JSON.stringify(auth));',
      '    process.stdout.write(JSON.stringify({ id: message.id, result: { account: {} } }) + "\\n");',
      '  }',
      '});'
    ].join("\n"), "utf8");
    const refreshedAuth = await batchProbe.codexAccountAuth(accountHome, { codexPath: fakeCli });
    assert.equal(refreshedAuth.accessToken, freshToken, "an expired account must be refreshed through the lightweight account API");
    assert.equal(refreshedAuth.accountId, "fixture-account");
  }
  finally {
    fs.rmSync(refreshFixture, { recursive: true, force: true });
  }

  const roundPlan = batchProbe.concurrencyForRound(179, { codexAccountCount: 3 });
  assert.equal(roundPlan.codexAccounts, 3, "all three GPT-5.3 accounts must be independent routes");
  assert.equal(roundPlan.codex, 50, "each GPT account must use the verified direct-request window");
  assert.equal(roundPlan.tokenMixProcesses, 20, "TokenMix must stay below its observed concurrent-stream 429 limit");
  assert.equal(roundPlan.routeCount, 4, "three GPT accounts plus TokenMix must form four routes");
  assert.equal(roundPlan.maxActiveTotal, 170, "the healthy full round must use all four stable route windows together");

  const calls = new Map();
  const routeIds = ["codex-primary", "codex-acct2", "codex-acct3", "tokenmix"];
  const modelCalls = new Map(routeIds.map((id) => [id, 0]));
  const activeByModel = new Map(routeIds.map((id) => [id, 0]));
  const maxByModel = new Map(routeIds.map((id) => [id, 0]));
  let activeTotal = 0;
  let maxTotal = 0;
  const startedAt = Date.now();
  const healthy = await helpers.runCodexProbeModelPool(
    [
      ...Array.from({ length: 179 }, (_, index) => ({ port: 41001 + index })),
      { port: 41001 }
    ],
    {
      keyOf: (item) => item.port,
      models: routeIds.map((id) => ({
        id,
        concurrency: id === "tokenmix" ? roundPlan.tokenMixProcesses : roundPlan.codex,
        worker: async (item) => {
          calls.set(item.port, (calls.get(item.port) || 0) + 1);
          modelCalls.set(id, modelCalls.get(id) + 1);
          activeTotal += 1;
          activeByModel.set(id, activeByModel.get(id) + 1);
          maxTotal = Math.max(maxTotal, activeTotal);
          maxByModel.set(id, Math.max(maxByModel.get(id), activeByModel.get(id)));
          await new Promise((resolve) => setTimeout(resolve, 20));
          activeTotal -= 1;
          activeByModel.set(id, activeByModel.get(id) - 1);
          return { ok: true, port: item.port, modelId: id };
        }
      }))
    }
  );
  const syntheticElapsedMs = Date.now() - startedAt;
  assert.equal(calls.size, 179, "a healthy round must de-duplicate all current static ports");
  assert.ok([...calls.values()].every((count) => count === 1), "each healthy node must be measured exactly once");
  assert.equal(maxTotal, 170, "the four healthy routes must fill every verified route window together");
  for (const id of routeIds) {
    assert.ok(modelCalls.get(id) > 0, `${id} must pull different nodes from the shared queue`);
    assert.ok(maxByModel.get(id) > 0, `${id} must have real concurrent activity`);
  }
  assert.equal(healthy.outcomes.size, 179, "every unique node must reach one final outcome");
  assert.ok(syntheticElapsedMs < 10000, `the 179-node scheduler round must stay below 10s (${syntheticElapsedMs}ms)`);

  const accountFailureAttempts = new Map();
  const accountFailure = await helpers.runCodexProbeModelPool(
    Array.from({ length: 24 }, (_, index) => ({ port: 45001 + index })),
    {
      keyOf: (item) => item.port,
      models: routeIds.map((id) => ({
        id,
        concurrency: 24,
        worker: async (item) => {
          const attempts = accountFailureAttempts.get(item.port) || [];
          attempts.push(id);
          accountFailureAttempts.set(item.port, attempts);
          if (id === "codex-primary") {
            return { ok: false, failureScope: "model", error: "simulated account outage" };
          }
          return { ok: true, port: item.port, modelId: id };
        }
      }))
    }
  );
  assert.equal(accountFailure.modelStates.get("codex-primary").disabled, true, "only the failed account route must be retired");
  assert.equal(accountFailure.outcomes.size, 24, "the other three routes must drain every unfinished node");
  assert.ok([...accountFailure.outcomes.values()].every((outcome) => outcome.ok), "account failure takeover must leave no unfinished node");

  const tokenMixTakeoverAttempts = new Map();
  const tokenMixTakeover = await helpers.runCodexProbeModelPool(
    Array.from({ length: 12 }, (_, index) => ({ port: 46001 + index })),
    {
      keyOf: (item) => item.port,
      models: routeIds.map((id) => ({
        id,
        concurrency: 12,
        worker: async (item) => {
          const attempts = tokenMixTakeoverAttempts.get(item.port) || [];
          attempts.push(id);
          tokenMixTakeoverAttempts.set(item.port, attempts);
          return id === "tokenmix"
            ? { ok: true, port: item.port, modelId: id }
            : { ok: false, failureScope: "model", error: "simulated GPT account outage" };
        }
      }))
    }
  );
  for (const id of routeIds.filter((item) => item !== "tokenmix")) {
    assert.equal(tokenMixTakeover.modelStates.get(id).disabled, true, `${id} must stay disabled after its account outage`);
  }
  assert.equal(tokenMixTakeover.modelStates.get("tokenmix").disabled, false, "TokenMix must remain healthy");
  assert.equal(tokenMixTakeover.outcomes.size, 12, "TokenMix must drain the queue after all GPT accounts fail");
  assert.ok(
    [...tokenMixTakeover.outcomes.values()].every((outcome) => outcome.ok && outcome.modelId === "tokenmix"),
    "every final outcome must come from TokenMix after all GPT routes fail"
  );
  assert.ok(
    [...tokenMixTakeoverAttempts.values()].every((attempts) => attempts.filter((id) => id === "tokenmix").length === 1),
    "TokenMix must measure each taken-over node exactly once"
  );

  const nodeAttempts = new Map();
  const nodeFailure = await helpers.runCodexProbeModelPool(
    [{ port: 42001 }, { port: 42002 }, { port: 42003 }],
    {
      keyOf: (item) => item.port,
      models: ["codex", "tokenmix"].map((id) => ({
        id,
        concurrency: 2,
        worker: async (item) => {
          const attempts = nodeAttempts.get(item.port) || [];
          attempts.push(id);
          nodeAttempts.set(item.port, attempts);
          if (item.port === 42001) {
            return { ok: false, failureScope: "node", error: "simulated node timeout" };
          }
          return { ok: true, port: item.port };
        }
      }))
    }
  );
  assert.equal(nodeAttempts.get(42001).length, 1, "a node-specific failure must never be tried by the other model");
  assert.equal(nodeFailure.outcomes.get("42001").ok, false);
  assert.equal(nodeFailure.outcomes.get("42001").failureScope, "node");
  assert.equal(nodeFailure.outcomes.size, 3, "node failures are final outcomes and must not stall the queue");

  const takeoverAttempts = new Map();
  const takeover = await helpers.runCodexProbeModelPool(
    [{ port: 43001 }, { port: 43002 }, { port: 43003 }, { port: 43004 }, { port: 43005 }, { port: 43006 }],
    {
      keyOf: (item) => item.port,
      models: [
        {
          id: "failed-model",
          concurrency: 2,
          worker: async (item) => {
            const attempts = takeoverAttempts.get(item.port) || [];
            attempts.push("failed-model");
            takeoverAttempts.set(item.port, attempts);
            return { ok: false, failureScope: "model", error: "simulated model outage" };
          }
        },
        {
          id: "survivor",
          concurrency: 2,
          worker: async (item) => {
            const attempts = takeoverAttempts.get(item.port) || [];
            attempts.push("survivor");
            takeoverAttempts.set(item.port, attempts);
            await new Promise((resolve) => setTimeout(resolve, 5));
            return { ok: true, port: item.port };
          }
        }
      ]
    }
  );
  assert.equal(takeover.modelStates.get("failed-model").disabled, true, "a model outage must retire that model");
  assert.equal(takeover.outcomes.size, 6, "the surviving model must drain every unfinished node");
  for (const port of [43001, 43002, 43003, 43004, 43005, 43006]) {
    assert.equal(takeover.outcomes.get(String(port)).ok, true, `port ${port} must be completed by the surviving model`);
    assert.equal(takeoverAttempts.get(port).filter((id) => id === "survivor").length, 1, `port ${port} must be measured once by the survivor`);
  }

  let retryCalls = 0;
  const failedOnce = await helpers.runCodexProbeWithRetry(
    async () => {
      retryCalls += 1;
      return { status: "error", connectionCount: 0, error: "timeout" };
    },
    { maxAttempts: 1 }
  );
  assert.equal(retryCalls, 1, "a node must not be measured twice in one run");
  assert.equal(failedOnce.attemptCount, 1);

  console.log("smart-proxy state tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
