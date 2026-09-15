"use strict";
// Evidence-based subscription auto-refresh (v1.2.2): benchmark node-level failures or an aged
// cache download the subscription in the background, compare entry endpoints, TCP-probe new
// entries and only stage cache + reminder. The running core, node and connections are untouched.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const helpers = require("../resources/js/config-helpers.js");
const source = fs.readFileSync(path.join(__dirname, "../resources/js/main.js"), "utf8");

const OLD = JSON.stringify({ proxies: [
  { name: "sg", server: "k.connectiontimeout.click", port: "42558" },
  { name: "hk", server: "k.connectiontimeout.click", port: "22733" },
  { name: "ru", server: "ru222.lovenao.top", port: 443 }
] });
const NEW = JSON.stringify({ proxies: [
  { name: "sg", server: "example-204.org", port: 42558 },
  { name: "hk", server: "example-204.org", port: 22733 },
  { name: "ru", server: "ru222.lovenao.top", port: 443 }
] });

function app(options = {}) {
  const files = new Map(), mtimes = new Map(), logs = [], notifications = [], commands = [], timers = new Map(), elements = new Map();
  let timer = 0, now = options.now || 1_800_000_000_000;
  const clock = { now: () => now, advance: ms => { now += ms; } };
  const context = vm.createContext({
    console, URL, URLSearchParams, Map, Set, Promise, JSON, Math, Array, Object, AbortController, TextEncoder, performance,
    Date: Object.assign(function (...args) { return args.length ? new Date(...args) : new Date(now); }, { now: () => now }),
    window: { __SMART_PROXY_TEST__: true, NL_ARGS: [] },
    SmartProxyConfig: helpers, SmartProxySiteFailover: require("../resources/js/site-failover.js"),
    setTimeout: (fn, ms) => { timers.set(++timer, { fn, ms }); return timer; }, clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => { timers.set(++timer, { fn, ms, interval: true }); return timer; }, clearInterval: id => timers.delete(id),
    document: { hidden: false, getElementById: id => { if (!elements.has(id)) elements.set(id, { value: "", checked: false, textContent: "", innerHTML: "", style: {}, classList: { toggle() {} } }); return elements.get(id); } },
    Neutralino: {
      filesystem: {
        getJoinedPath: async (...p) => p.join("/"),
        getStats: async p => { if (!files.has(p)) throw new Error("NE_FS_NOPATHE"); return { size: files.get(p).length, modifiedAt: mtimes.get(p) || 0 }; },
        readFile: async p => { if (!files.has(p)) throw new Error("NE_FS_FILRDER"); return files.get(p); },
        writeFile: async (p, text) => { files.set(p, String(text)); mtimes.set(p, now); },
        remove: async p => { files.delete(p); mtimes.delete(p); },
        readDirectory: async () => []
      },
      os: {
        execCommand: async cmd => {
          commands.push(cmd);
          if (/curl\.exe/.test(cmd)) {
            if (options.downloadFails) return { exitCode: 22, stdOut: "", stdErr: "curl: (22) The requested URL returned error: 503" };
            const out = cmd.match(/"-o"\s+"([^"]+)"/)[1];
            const headers = (cmd.match(/"-D"\s+"([^"]+)"/) || [])[1];
            files.set(out, options.live || NEW); mtimes.set(out, now);
            if (headers) { files.set(headers, options.liveHeaders || "HTTP/1.1 200 OK\r\nProfile-Update-Interval: 24\r\n"); mtimes.set(headers, now); }
            return { exitCode: 0, stdOut: "", stdErr: "" };
          }
          if (/powershell/.test(cmd)) {
            const decoded = Buffer.from(cmd.split("-EncodedCommand ")[1], "base64").toString("utf16le");
            const targets = [...decoded.matchAll(/'([^']+:\d+)'/g)].map(m => m[1]);
            const reachable = options.reachable || (() => true);
            return { exitCode: 0, stdOut: JSON.stringify(targets.map(t => ({ t, ok: reachable(t), ms: 42 }))), stdErr: "" };
          }
          throw new Error("unexpected command " + cmd.slice(0, 40));
        },
        showNotification: async (title, body) => { notifications.push({ title, body }); }
      }
    }
  });
  vm.runInContext(source, context);
  context.messages = logs;
  vm.runInContext(`
    log = s => messages.push(String(s));
    state.paths.work = 'W'; state.paths.data = 'D'; state.paths.settings = 'D/settings.json';
    state.settingsLoaded = true;
    readPortableTextFile = async p => Neutralino.filesystem.readFile(p);
    validateSubscriptionText = (text, label) => { const c = JSON.parse(text); if (!c.proxies || !c.proxies.length) throw new Error(label + ' has no proxy nodes'); return c; };
    buildPowerShellExecCommand = script => 'powershell -EncodedCommand ' + Buffer.from(script, 'utf16le').toString('base64');
    renderProxyNodes = () => {}; renderHomeTraffic = () => {}; setStatus = () => {};
    applyRuntimeSettings = async () => { throw new Error('applyRuntimeSettings must not run'); };
    startMainCore = async () => { throw new Error('startMainCore must not run'); };
    switchToNode = async () => { throw new Error('switchToNode must not run'); };
    state.settings.subscriptions = [
      { id: 'sub-a', name: 'lovenao', url: 'https://a.example/sub?token=x', cachedUrl: 'https://a.example/sub?token=x' },
      { id: 'sub-b', name: 'other', url: 'https://b.example/sub', cachedUrl: 'https://b.example/sub' },
      { id: 'sub-c', name: 'nourl', url: '', cachedUrl: '' }
    ];
    state.settings.activeSubscriptionId = 'sub-b';
  `, context);
  context.Buffer = Buffer;
  const seed = (id, text, ageMs = 0, headers = "HTTP/1.1 200 OK\r\nProfile-Update-Interval: 24\r\n") => {
    files.set(`W/subscription.${id}.yaml`, text); mtimes.set(`W/subscription.${id}.yaml`, now - ageMs);
    files.set(`W/subscription.${id}.headers.txt`, headers); mtimes.set(`W/subscription.${id}.headers.txt`, now - ageMs);
  };
  return { context, files, mtimes, logs, notifications, commands, timers, elements, clock, seed, run: code => vm.runInContext(code, context) };
}

const entries = (id, count) => Array.from({ length: count }, (_, i) => ({ key: `${id}-${i}`, subscriptionId: id, tag: `${id}${i}`, node: `${id}${i}` }));
const results = (list, status, scope) => new Map(list.map(e => [e.key, status === "ok" ? { status: "ok" } : { status: "error", failureScope: scope }]));

test("helpers: endpoint diff, interval parsing and per-subscription node-level evidence", () => {
  const diff = helpers.diffSubscriptionEndpoints(JSON.parse(OLD), JSON.parse(NEW));
  assert.deepEqual(diff.added, ["example-204.org:42558", "example-204.org:22733"]);
  assert.deepEqual(diff.removed, ["k.connectiontimeout.click:42558", "k.connectiontimeout.click:22733"]);
  assert.equal(diff.changed, true);
  assert.equal(helpers.diffSubscriptionEndpoints(JSON.parse(NEW), JSON.parse(NEW)).changed, false);
  assert.equal(helpers.diffSubscriptionEndpoints(null, JSON.parse(NEW)).added.length, 3);
  assert.equal(helpers.parseProfileUpdateIntervalHours("HTTP/1.1 200 OK\r\nprofile-update-interval: 12\r\n"), 12);
  assert.equal(helpers.parseProfileUpdateIntervalHours("no header", 24), 24);
  assert.equal(helpers.parseProfileUpdateIntervalHours("Profile-Update-Interval: 0"), 24);
  assert.equal(helpers.parseProfileUpdateIntervalHours("Profile-Update-Interval: 999"), 168);
  const a = entries("sub-a", 4), b = entries("sub-b", 2), local = entries("__offline-yaml__", 1);
  const map = new Map([...results(a.slice(0, 1), "ok"), ...results(a.slice(1), "error", "node"), ...results(b, "error", "model"), ...results(local, "error", "node")]);
  const evidence = helpers.subscriptionRefreshEvidence([...a, ...b, ...local], map, { ratio: 0.25, excludeIds: ["__offline-yaml__"] });
  assert.deepEqual(evidence.stale.map(s => s.subscriptionId), ["sub-a"]);
  assert.equal(evidence.stats.find(s => s.subscriptionId === "sub-b").nodeFailures, 0, "model/account failures are not subscription evidence");
  assert.equal(evidence.stats.some(s => s.subscriptionId === "__offline-yaml__"), false);
});

test("benchmark evidence refreshes only the stale subscription; changed reachable entries stage cache + reminder without touching the core", async () => {
  const a = app({ reachable: t => t.startsWith("example-204.org") });
  a.seed("sub-a", OLD); a.seed("sub-b", NEW);
  const A = entries("sub-a", 4), B = entries("sub-b", 4);
  const map = new Map([...results(A, "error", "node"), ...results(B, "ok")]);
  a.context.entriesFixture = [...A, ...B]; a.context.mapFixture = map;
  const evidence = a.run("evaluateBenchmarkSubscriptionEvidence(entriesFixture, mapFixture, { cancelled: false, channelFailure: false })");
  assert.deepEqual(evidence.stale.map(s => s.subscriptionId), ["sub-a"]);
  await a.run("state.subscriptionRefreshPromise");
  assert.equal(a.commands.filter(c => /curl\.exe/.test(c)).length, 1, "exactly one download, for the stale subscription only");
  assert.match(a.commands.find(c => /curl\.exe/.test(c)), /a\.example/);
  assert.equal(a.files.get("W/subscription.sub-a.yaml"), NEW, "cache rewritten with the fresh subscription");
  assert.equal(a.files.get("W/subscription.sub-b.yaml"), NEW, "other subscription cache untouched");
  assert.equal(a.files.has("W/subscription.download.tmp.yaml"), false, "temp download removed");
  const pending = a.run("state.pendingConfigApply");
  assert.equal(pending.profileId, "sub-a"); assert.equal(pending.added, 2); assert.equal(pending.reachable, 2); assert.equal(pending.notified, true);
  assert.equal(a.notifications.length, 1); assert.match(a.notifications[0].body, /lovenao/);
  assert.match(a.elements.get("subscriptionStatus").textContent, /待下次手动启动代理生效/);
  assert.ok(a.logs.some(l => /node-level failures this round/.test(l)));
  assert.ok(a.logs.some(l => /entry endpoints changed \+2\/-2; new entries reachable 2\/2/.test(l)));
  assert.ok(a.logs.some(l => /running core unchanged/.test(l)));
  assert.equal(a.run("state.autoRecoverBusy"), false);
});

test("cancelled rounds, account/model channel failures and sub-threshold failures never download", async () => {
  const a = app(); a.seed("sub-a", OLD);
  const A = entries("sub-a", 4);
  a.context.A = A; a.context.nodeMap = results(A, "error", "node");
  assert.equal(a.run("evaluateBenchmarkSubscriptionEvidence(A, nodeMap, { cancelled: true })"), null);
  assert.equal(a.run("evaluateBenchmarkSubscriptionEvidence(A, nodeMap, { channelFailure: true })"), null);
  a.context.modelMap = results(A, "error", "model");
  assert.equal(a.run("evaluateBenchmarkSubscriptionEvidence(A, modelMap, {})").stale.length, 0);
  const five = entries("sub-a", 5); a.context.five = five;
  a.context.lowMap = new Map([...results(five.slice(0, 4), "ok"), ...results(five.slice(4), "error", "node")]);
  assert.equal(a.run("evaluateBenchmarkSubscriptionEvidence(five, lowMap, {})").stale.length, 0, "1/5 is below the 25% ratio");
  assert.equal(a.run("state.subscriptionRefreshPromise"), null);
  assert.equal(a.commands.length, 0);
  assert.ok(a.logs.some(l => /round cancelled/.test(l)) && a.logs.some(l => /channel failure/.test(l)));
});

test("disabled switch, cooldown, busy state and download failure all log a reason and leave cache/core alone", async () => {
  const a = app({ downloadFails: true }); a.seed("sub-a", OLD);
  a.run("state.settings.autoRecoverOnEndpointFailure = false");
  assert.equal(await a.run("stageSubscriptionRefresh(state.settings.subscriptions[0], 'benchmark', '4/4')"), null);
  assert.ok(a.logs.some(l => /disabled by settings; lovenao not refreshed \(benchmark: 4\/4\)/.test(l)));
  a.run("state.settings.autoRecoverOnEndpointFailure = true; state.subscriptionBusy = true");
  assert.equal(await a.run("stageSubscriptionRefresh(state.settings.subscriptions[0], 'scheduled')"), null);
  assert.ok(a.logs.some(l => /another subscription operation is running/.test(l)));
  a.run("state.subscriptionBusy = false");
  const failed = await a.run("stageSubscriptionRefresh(state.settings.subscriptions[0], 'scheduled')");
  assert.equal(failed.downloaded, false);
  assert.ok(a.logs.some(l => /download failed; cache and running core unchanged/.test(l)));
  assert.equal(a.files.get("W/subscription.sub-a.yaml"), OLD, "failed download keeps the previous cache");
  assert.equal(await a.run("stageSubscriptionRefresh(state.settings.subscriptions[0], 'benchmark')"), null);
  assert.ok(a.logs.some(l => /cooldown, \d+ min remaining/.test(l)));
  a.clock.advance(21 * 60 * 1000);
  assert.equal((await a.run("stageSubscriptionRefresh(state.settings.subscriptions[0], 'benchmark')")).downloaded, false, "cooldown expired, download attempted again");
  assert.equal(a.run("state.pendingConfigApply"), null);
  assert.equal(a.notifications.length, 0);
});

test("unchanged upstream refreshes cache silently; changed unverified entries remain visibly staged",  async () => {
  const a = app({ live: OLD }); a.seed("sub-a", OLD, 0, "HTTP/1.1 200 OK\r\nSubscription-Userinfo: old\r\n");
  const same = await a.run("stageSubscriptionRefresh(state.settings.subscriptions[0], 'scheduled', 'cache age 30h >= interval 24h')");
  assert.equal(same.diff.changed, false);
  assert.match(a.files.get("W/subscription.sub-a.headers.txt"), /Profile-Update-Interval/, "headers refreshed even when nodes are unchanged");
  assert.ok(a.logs.some(l => /upstream entry endpoints unchanged \(3\); cache and headers refreshed, nothing to apply/.test(l)));
  assert.equal(a.run("state.pendingConfigApply"), null);
  assert.equal(a.commands.filter(c => /powershell/.test(c)).length, 0, "no TCP probe when nothing changed");

  const b = app({ reachable: () => false }); b.seed("sub-a", OLD);
  const dead = await b.run("stageSubscriptionRefresh(state.settings.subscriptions[0], 'benchmark', '4/4')");
  assert.equal(dead.diff.changed, true); assert.equal(dead.reachable.length, 0); assert.equal(dead.unreachable.length, 2);
  assert.equal(b.run("state.pendingConfigApply").reachable, 0);
  assert.equal(b.notifications.length, 1);
  assert.match(b.notifications[0].body, /已验证连通 0/);
  assert.ok(b.logs.some(l => /new entries not verified; cache staged, reachability is advisory only/.test(l)));
  assert.equal(b.files.get("W/subscription.sub-a.yaml"), NEW);
});

test("failed scheduled downloads retry after cooldown, not after another full subscription interval", async () => {
  const a = app({ downloadFails: true }); a.seed("sub-a", OLD, 30 * 3600000); a.seed("sub-b", NEW);
  await a.run("subscriptionScheduledRefreshTick()");
  const first = a.commands.length;
  a.clock.advance(21 * 60000);
  await a.run("subscriptionScheduledRefreshTick()");
  assert.equal(a.commands.length, first + 1);
  assert.equal(a.files.get("W/subscription.sub-a.yaml"), OLD);
  assert.match(a.run("state.settings.subscriptionRefreshStatus['sub-a'].error"), /下载失败/);
});

test("same endpoint but changed credential is staged, and never-started subscriptions are downloaded", async () => {
  const changed = JSON.parse(OLD); changed.proxies[0].password = 'fixture-new-password';
  const a = app({ live: JSON.stringify(changed) }); a.seed('sub-a', OLD);
  const outcome = await a.run("stageSubscriptionRefresh(state.settings.subscriptions[0], 'scheduled')");
  assert.equal(outcome.diff.changed, false); assert.equal(outcome.contentChanged, true);
  assert.equal(a.run("state.settings.subscriptionRefreshStatus['sub-a'].pending"), true);
  const b = app(); b.seed('sub-b', NEW);
  const outcomes = await b.run('subscriptionScheduledRefreshTick()');
  assert.equal(outcomes.length, 1); assert.equal(outcomes[0].profileId, 'sub-a');
});

test("TCP probe targets distinct new hosts first, at most three, through a hidden PowerShell TcpClient", async () => {
  const a = app({ reachable: t => t === "h1.example:1" });
  const probes = await a.run("probeEntryEndpointsTcp(preferDistinctHosts(['h1.example:1','h1.example:2','h2.example:3','h3.example:4','h4.example:5']))");
  assert.deepEqual(probes.map(p => p.endpoint), ["h1.example:1", "h2.example:3", "h3.example:4"]);
  assert.deepEqual(probes.map(p => p.ok), [true, false, false]);
  const decoded = Buffer.from(a.commands[0].split("-EncodedCommand ")[1], "base64").toString("utf16le");
  assert.match(decoded, /System\.Net\.Sockets\.TcpClient/); assert.match(decoded, /ConnectAsync\(\$h,\$p\)\.Wait\(5000\)/);
});

test("scheduled tick honours Profile-Update-Interval and cache age; disabled switch logs once; scheduler is armed at boot", async () => {
  const a = app({ reachable: () => true });
  a.seed("sub-a", OLD, 30 * 3600 * 1000, "HTTP/1.1 200 OK\r\nProfile-Update-Interval: 24\r\n");
  a.seed("sub-b", NEW, 30 * 3600 * 1000, "HTTP/1.1 200 OK\r\nProfile-Update-Interval: 48\r\n");
  a.run("state.settings.autoRecoverOnEndpointFailure = false");
  assert.equal(await a.run("subscriptionScheduledRefreshTick()"), null);
  assert.equal(await a.run("subscriptionScheduledRefreshTick()"), null);
  assert.equal(a.logs.filter(l => /Scheduled subscription refresh disabled by settings/.test(l)).length, 1, "disabled reason logged once, not every tick");
  a.run("state.settings.autoRecoverOnEndpointFailure = true");
  const outcomes = await a.run("subscriptionScheduledRefreshTick()");
  assert.equal(outcomes.length, 1, "only the cache older than its own interval is refreshed (30h >= 24h, not 30h >= 48h)");
  assert.equal(outcomes[0].profileId, "sub-a");
  assert.ok(a.logs.some(l => /auto-refresh \(scheduled\) for lovenao: cache age 30h >= interval 24h/.test(l)));
  assert.equal(a.run("state.pendingConfigApply").profileId, "sub-a");
  const again = await a.run("subscriptionScheduledRefreshTick()");
  assert.equal(again.length, 0, "fresh cache mtime stops repeated refreshes");
  a.run("startSubscriptionRefreshScheduler(); startSubscriptionRefreshScheduler();");
  const armed = [...a.timers.values()].filter(t => t.ms === 60 * 1000 && t.interval);
  assert.equal(armed.length, 1, "one interval timer even when started twice");
  assert.ok([...a.timers.values()].some(t => t.ms === 15 * 1000 && !t.interval), "first tick after fifteen seconds");
});

test("auto-refresh code paths never restart the core, switch nodes or rebuild the running pool; DNS stays advisory", () => {
  const start = source.indexOf("// 针对单个订阅下载并落缓存");
  const end = source.indexOf("// ---- Website failure hot-switch:");
  assert.ok(start > 0 && end > start);
  const region = source.slice(start, end);
  assert.doesNotMatch(region, /applyRuntimeSettings\(|startMainCore\(|switchToNode\(|killProcess\(|killCorePorts\(|loadMergedCachedSubscriptionPoolForStartup\(|refreshSubscriptionNodeCatalog\(/);
  assert.doesNotMatch(source, /autoRecoverFromEndpointFailure\(|liveEndpointNodeCount\(/, "dead DNS-based recovery removed");
  assert.match(source, /no automatic subscription update/, "system DNS advisory wording retained");
  assert.match(source.slice(source.indexOf("function startNodeGuard()")), /startSubscriptionRefreshScheduler\(\);/, "scheduler armed from the boot path");
  const html = fs.readFileSync(path.join(__dirname, "../resources/index.html"), "utf8");
  assert.match(html, /id="autoRecoverOnEndpointFailure" type="checkbox" checked>/, "switch is enabled again");
});
