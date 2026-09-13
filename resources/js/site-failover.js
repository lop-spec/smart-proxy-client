/* Event-driven website failover. Historical scores only: no network/model probes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartProxySiteFailover = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function parseTargets(value) {
    const lines = String(value || "").split(/[\s,;]+/).filter(Boolean);
    if (!lines.length || lines.length > 32) throw Error("监测网站须填写 1–32 个域名或 HTTPS URL");
    const seen = new Set();
    return lines.map(line => {
      const url = new URL(line.includes("://") ? line : `https://${line}`);
      const host = url.hostname.toLowerCase().replace(/\.$/, "");
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.port
        || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/i.test(host)
        || /\.(?:local|localhost|internal|test|invalid)$/.test(host)) {
        throw Error("监测网站必须是公网 HTTPS 域名；不接受凭据、查询参数、端口或 IP");
      }
      return { host };
    }).filter(target => { if (seen.has(target.host)) return false; seen.add(target.host); return true; });
  }
  function matchTarget(targets, host) {
    const normalized = String(host || "").toLowerCase().replace(/\.$/, "");
    return targets.find(t => normalized === t.host || normalized.endsWith(`.${t.host}`)) || null;
  }
  const number = (value, fallback, low, high) => Number.isFinite(Number(value))
    ? Math.max(low, Math.min(high, Math.trunc(Number(value)))) : fallback;
  function config(settings) {
    return { enabled: settings.siteFailoverEnabled === true,
      targets: parseTargets(settings.siteFailoverTargets === undefined ? "chatgpt.com" : settings.siteFailoverTargets),
      threshold: number(settings.siteFailoverThreshold, 2, 1, 10),
      windowMs: number(settings.siteFailoverWindowSeconds, 60, 10, 600) * 1000,
      cooldownMs: number(settings.siteFailoverCooldownSeconds, 180, 30, 3600) * 1000 };
  }
  const memberships = entry => new Set(entry?.subscriptionIds?.length ? entry.subscriptionIds : [entry?.subscriptionId].filter(Boolean));
  // A deduplicated node that also belongs to the failing subscription is NOT an
  // independent backup. Scores from different models/accounts are not comparable.
  function rankHistoricalAlternates(catalog, results, currentNode, liveTags, excluded = new Set(), random = Math.random) {
    const current = catalog.find(e => (e.tag || e.node) === currentNode);
    const currentSubs = memberships(current);
    if (!currentSubs.size) return { entries: [], reason: "current subscription unknown" };
    const live = new Set(liveTags);
    const alternatives = catalog.filter(entry => {
      const node = entry.tag || entry.node, subs = memberships(entry);
      return node !== currentNode && !excluded.has(node) && live.has(node) && subs.size
        && ![...subs].some(id => currentSubs.has(id));
    });
    const rows = alternatives.flatMap(entry => {
      const node = entry.tag || entry.node;
      const result = results instanceof Map ? results.get(entry.key) : results?.[entry.key];
      if (!result || result.status !== "done" || !(result.tokPerSec > 0) || !Number.isFinite(result.tokPerSec)
        || !result.profileKey || !result.measuredAt || !result.verified || result.sampleCount < 3 || result.successRate !== 1
        || result.resolvedModelVerified !== true || !result.requestedModel || result.requestedModel !== result.resolvedModel
        || result.anthropicOk === false || result.lastAttempt?.failureScope === "node" && result.lastAttempt.status !== "done") return [];
      return [{ entry, node, result }];
    });
    if (!rows.length) {
      if (!alternatives.length) return { entries: [], reason: "no other-subscription node in running group outside cooldown" };
      const subs = [...new Set(alternatives.flatMap(entry => [...memberships(entry)]))];
      const pick = values => values[Math.min(values.length - 1, Math.max(0, Math.floor(random() * values.length)))];
      const subscription = pick(subs), entry = pick(alternatives.filter(e => memberships(e).has(subscription)));
      return { entries: [{ entry, node: entry.tag || entry.node, result: null }],
        reason: "no verified historical score; random other-subscription fallback explicitly enabled; probes=0" };
    }
    // Use the most recently measured profile, never compare disjoint tok/s scales.
    const profile = [...rows].sort((a,b) => b.result.measuredAt-a.result.measuredAt)[0].result.profileKey;
    const ranked = rows.filter(row => row.result.profileKey === profile).sort((a,b) => b.result.tokPerSec-a.result.tokPerSec
      || b.result.measuredAt-a.result.measuredAt || a.node.localeCompare(b.node));
    const chosenSubs = new Set();
    const champions = ranked.filter(row => {
      const subs = [...memberships(row.entry)];
      if (subs.every(id => chosenSubs.has(id))) return false;
      subs.forEach(id => chosenSubs.add(id)); return true;
    });
    return { entries: champions, profile, reason: `${rows.length} eligible history rows; ${champions.length} other-subscription champions in latest profile` };
  }
  function createGuard(deps) {
    const now = deps.now || Date.now;
    const connections = new Map(), evidence = new Map(), excluded = new Map(), skipped = {};
    let pending = null, cooldownUntil = 0, cachedKey = "", cachedConfig;
    const log = text => deps.log(`[site-failover] ${text}`);
    const skip = reason => { skipped[reason] = (skipped[reason] || 0) + 1; log(`skip: ${reason}`); return null; };
    function readConfig() {
      const s = deps.settings();
      const key = JSON.stringify([s.siteFailoverEnabled, s.siteFailoverTargets, s.siteFailoverThreshold,
        s.siteFailoverWindowSeconds, s.siteFailoverCooldownSeconds, s.targetGroup]);
      if (key !== cachedKey) { const next = config(s); cachedKey = key; cachedConfig = next; evidence.clear(); }
      return cachedConfig;
    }
    async function recover(event, cfg, fingerprint, snapshot) {
      cooldownUntil = now() + cfg.cooldownMs;
      excluded.set(event.node, cooldownUntil);
      const valid = () => {
        const current = deps.snapshot();
        try { return readConfig().enabled && fingerprint === cachedKey && current.ready
          && current.node === snapshot.node && current.revision === snapshot.revision; }
        catch { return false; }
      };
      log(`trigger host=${event.host} node=${event.node}; selecting historical best from another subscription; probes=0`);
      try {
        for (const [node, until] of excluded) if (until <= now()) excluded.delete(node);
        const ranked = await deps.candidates(new Set(excluded.keys()));
        if (!valid()) return skip("cancelled: settings, current node or manual selection changed");
        const winner = ranked.entries[0];
        if (!winner) return skip(ranked.reason || "no historical candidate; keeping current node");
        log(`selection: ${ranked.reason}; winner=${winner.node} subscription=${winner.entry.subscriptionName || winner.entry.subscriptionId} tok/s=${winner.result?.tokPerSec ?? "unmeasured"} measuredAt=${winner.result?.measuredAt ?? "none"}`);
        const selected = await deps.select(winner.node, { node: event.node, host: event.host,
          revision: snapshot.revision, valid });
        if (!selected) return skip("selection declined; current route retained");
        cooldownUntil = now() + cfg.cooldownMs; excluded.set(event.node, cooldownUntil);
        log(`switched ${event.node} -> ${winner.node}; host=${event.host} cooldown=${cfg.cooldownMs/1000}s probes=0; historical/random selection does not guarantee present availability`);
        return winner;
      } catch (error) { log(`recovery failed; no restart: ${String(error.message || error)}`); return null; }
      finally { evidence.clear(); }
    }
    function ingest(level, payload) {
      let cfg;
      try { cfg = readConfig(); } catch (error) { return skip(`invalid settings: ${error.message}`); }
      if (!cfg.enabled) return null;
      const text = String(payload || "").replace(/\x1b\[[0-9;]*m/g, "");
      const id = (text.match(/\[(\d+)(?:\s[^\]]*)?\]/) || [])[1];
      const outbound = text.match(/outbound\/([a-z0-9]+)\[([^\]]+)\]/i);
      if (id && outbound) {
        const host = (text.match(/connection to ([^\s:]+):\d+/i) || [])[1];
        const previous = connections.get(id);
        connections.set(id, { ...previous, at: now(), kind: outbound[1].toLowerCase(), node: outbound[2], host: host || previous?.host });
        if (connections.size > 5000) connections.delete(connections.keys().next().value);
      }
      if (!/^(error|warn|warning)$/i.test(level)) return null;
      if (!/connection (?:download|upload) closed|forcibly closed|connection reset|ECONNRESET|socket hang up|open connection to|i\/o timeout|connect.*(?:refused|timeout)|TLS handshake/i.test(text)) return null;
      const known = id && connections.get(id);
      if (!known || !known.host || now()-known.at > 86400000) return skip("unattributed connection error");
      if (known.failed) return skip("duplicate connection error");
      known.failed = true;
      if (["direct","block","dns"].includes(known.kind)) return skip("non-proxy outbound");
      if (!matchTarget(cfg.targets, known.host)) return skip("website not monitored");
      if (/raw-read tcp (?:127\.|\[::1\])|->\s*(?:127\.|\[::1\])|context cancel|operation (?:was )?cancel/i.test(text)) return skip("local client cancellation");
      const snapshot = deps.snapshot();
      if (!snapshot.ready || snapshot.node !== known.node) return skip("not current ready node");
      if (pending) return pending;
      if (now() < cooldownUntil) return skip(`cooldown ${Math.ceil((cooldownUntil-now())/1000)}s`);
      const key = `${known.node}\n${known.host}`;
      const times = (evidence.get(key) || []).filter(at => now()-at <= cfg.windowMs);
      times.push(now()); evidence.set(key, times);
      if (evidence.size > 1000) evidence.delete(evidence.keys().next().value);
      log(`evidence host=${known.host} node=${known.node} conn=${id} failures=${times.length}/${cfg.threshold} window=${cfg.windowMs/1000}s`);
      if (times.length < cfg.threshold) return null;
      const fingerprint = cachedKey;
      pending = recover({ ...known }, cfg, fingerprint, snapshot).finally(() => { pending = null; });
      return pending;
    }
    return { ingest, stats: () => ({ connections: connections.size, pending: !!pending, cooldownUntil, skipped: { ...skipped } }) };
  }
  return { parseTargets, matchTarget, config, rankHistoricalAlternates, createGuard };
});
