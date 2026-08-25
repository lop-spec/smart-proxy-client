(function (root) {
  function cloneConfig(config) {
    return JSON.parse(JSON.stringify(config || {}));
  }

  function asByteView(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (Array.isArray(value)) return Uint8Array.from(value);
    throw new TypeError("Expected binary text content");
  }

  function decodeText(bytes, encoding, options = {}) {
    return new TextDecoder(encoding, options).decode(bytes).replace(/^\uFEFF/, "");
  }

  function decodePortableTextBytes(value) {
    const bytes = asByteView(value);
    if (!bytes.length) return "";
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return decodeText(bytes.subarray(3), "utf-8");
    }
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return decodeText(bytes.subarray(2), "utf-16le");
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return decodeText(bytes.subarray(2), "utf-16be");
    }

    const sampleLength = Math.min(bytes.length, 256);
    let evenNulls = 0;
    let oddNulls = 0;
    for (let index = 0; index < sampleLength; index += 1) {
      if (bytes[index] !== 0) continue;
      if (index % 2) oddNulls += 1;
      else evenNulls += 1;
    }
    if (oddNulls > sampleLength / 8 && evenNulls < oddNulls / 4) {
      return decodeText(bytes, "utf-16le");
    }
    if (evenNulls > sampleLength / 8 && oddNulls < evenNulls / 4) {
      return decodeText(bytes, "utf-16be");
    }

    try {
      return decodeText(bytes, "utf-8", { fatal: true });
    }
    catch {}
    try {
      return decodeText(bytes, "gb18030", { fatal: true });
    }
    catch {
      return decodeText(bytes, "windows-1252");
    }
  }

  function normalizePortablePath(value) {
    const text = String(value || "").trim().replace(/\\/g, "/");
    if (/^[A-Za-z]:\/$/.test(text) || text === "/") return text;
    return text.replace(/\/+$/, "");
  }

  function isAbsolutePortablePath(value) {
    const path = normalizePortablePath(value);
    return /^[A-Za-z]:\//.test(path) || path.startsWith("//") || path.startsWith("/");
  }

  function joinPortablePath(rootPath, childPath) {
    const rootValue = normalizePortablePath(rootPath);
    const childValue = normalizePortablePath(childPath).replace(/^\/+/, "");
    if (!rootValue) return childValue;
    if (!childValue) return rootValue;
    return `${rootValue}/${childValue}`;
  }

  function resolveConfiguredPath(options = {}) {
    const configuredPath = normalizePortablePath(options.configuredPath);
    const appRoot = normalizePortablePath(options.appRoot);
    if (!configuredPath || !appRoot) return configuredPath;
    if (!isAbsolutePortablePath(configuredPath)) {
      return joinPortablePath(appRoot, configuredPath);
    }

    const dataDirName = String(options.dataDirName || "").trim();
    if (dataDirName) {
      const marker = `/${dataDirName.toLowerCase()}/`;
      const markerIndex = configuredPath.toLowerCase().lastIndexOf(marker);
      if (markerIndex >= 0) {
        return joinPortablePath(appRoot, configuredPath.slice(markerIndex + 1));
      }
    }
    return configuredPath;
  }

  function toPortableStoredPath(options = {}) {
    const resolvedPath = normalizePortablePath(options.resolvedPath);
    const appRoot = normalizePortablePath(options.appRoot);
    if (!resolvedPath || !appRoot || !isAbsolutePortablePath(resolvedPath)) return resolvedPath;
    const prefix = `${appRoot.toLowerCase()}/`;
    if (resolvedPath.toLowerCase().startsWith(prefix)) {
      return resolvedPath.slice(appRoot.length + 1);
    }
    return resolvedPath;
  }

  function stableJsonValue(value) {
    if (Array.isArray(value)) return value.map(stableJsonValue);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableJsonValue(value[key]);
      return result;
    }, {});
  }

  function proxyFingerprint(proxy) {
    const source = cloneConfig(proxy);
    delete source.name;
    return JSON.stringify(stableJsonValue(source));
  }

  function proxyIdentity(proxy) {
    const text = proxyFingerprint(proxy);
    let low = 0x811C9DC5;
    let high = 0x9E3779B9;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      low = Math.imul(low ^ (code & 0xFF), 0x01000193);
      low = Math.imul(low ^ (code >>> 8), 0x01000193);
      high = Math.imul(high ^ code, 0x85EBCA6B);
      high = (high ^ (high >>> 13)) >>> 0;
    }
    return "node-" + (high >>> 0).toString(16).padStart(8, "0")
      + (low >>> 0).toString(16).padStart(8, "0");
  }

  const NODE_LEAGUE_VERSION = 4;
  const NODE_LEAGUE_SAMPLE_LIMIT = 20;
  const NODE_LEAGUE_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

  function nodeLeagueNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function nodeLeagueInteger(value, fallback = 0) {
    return Math.max(0, Math.trunc(nodeLeagueNumber(value, fallback)));
  }

  function nodeLeagueUniqueStrings(values, limit = 32) {
    return [...new Set((Array.isArray(values) ? values : []).map(String).map((value) => value.trim()).filter(Boolean))]
      .slice(-limit);
  }

  function nodeLeagueMedian(values) {
    const sorted = (Array.isArray(values) ? values : [])
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((left, right) => left - right);
    if (!sorted.length) return 0;
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    return Math.max(0.001, Math.round(median * 1000) / 1000);
  }

  function recomputeNodeLeagueRecord(record) {
    const samples = (Array.isArray(record.samples) ? record.samples : [])
      .map((sample) => ({
        at: nodeLeagueInteger(sample && sample.at),
        ok: !!(sample && sample.ok),
        uploadMbps: sample && sample.ok
          ? Math.max(0.001, Math.round(nodeLeagueNumber(sample.uploadMbps) * 1000) / 1000)
          : 0,
        uploadBytes: sample && sample.ok ? nodeLeagueInteger(sample.uploadBytes) : 0,
        uploadMs: sample && sample.ok ? Math.max(1, nodeLeagueInteger(sample.uploadMs, 1)) : 0,
        echoVerified: !!(sample && sample.echoVerified),
        verified: !!(sample && sample.verified)
      }))
      .filter((sample) => sample.at > 0)
      .slice(-NODE_LEAGUE_SAMPLE_LIMIT);
    const successfulUploads = samples.filter((sample) => sample.ok).map((sample) => sample.uploadMbps);
    const medianUploadMbps = nodeLeagueMedian(successfulUploads);
    const deviations = medianUploadMbps
      ? successfulUploads.map((uploadMbps) => Math.abs(uploadMbps - medianUploadMbps))
      : [];
    record.samples = samples;
    record.successRate = samples.length
      ? samples.filter((sample) => sample.ok).length / samples.length
      : 0;
    record.medianUploadMbps = medianUploadMbps;
    record.madUploadMbps = nodeLeagueMedian(deviations);
    return record;
  }

  function normalizeNodeLeagueRecord(id, raw = {}, options = {}) {
    const record = {
      id: String(id || raw.id || ""),
      names: nodeLeagueUniqueStrings(raw.names, 8),
      sourceIds: nodeLeagueUniqueStrings(raw.sourceIds),
      sourceNames: nodeLeagueUniqueStrings(raw.sourceNames),
      points: nodeLeagueInteger(raw.points),
      firsts: nodeLeagueInteger(raw.firsts),
      seconds: nodeLeagueInteger(raw.seconds),
      rounds: nodeLeagueInteger(raw.rounds || raw.cycles),
      successCount: nodeLeagueInteger(raw.successCount),
      failCount: nodeLeagueInteger(raw.failCount),
      samples: options.dropLegacyMetric ? [] : (Array.isArray(raw.samples) ? raw.samples : []),
      lastUploadMbps: options.dropLegacyMetric
        ? 0
        : Math.max(0, Math.round(nodeLeagueNumber(raw.lastUploadMbps) * 1000) / 1000),
      lastUploadBytes: options.dropLegacyMetric ? 0 : nodeLeagueInteger(raw.lastUploadBytes),
      lastUploadMs: options.dropLegacyMetric ? 0 : nodeLeagueInteger(raw.lastUploadMs),
      lastConnectMs: options.dropLegacyMetric ? 0 : nodeLeagueInteger(raw.lastConnectMs),
      lastStatus: String(raw.lastStatus || ""),
      lastError: String(raw.lastError || "").slice(0, 500),
      lastSuccessAt: nodeLeagueInteger(raw.lastSuccessAt),
      lastFailureAt: nodeLeagueInteger(raw.lastFailureAt),
      updatedAt: nodeLeagueInteger(raw.updatedAt),
      removedAt: nodeLeagueInteger(raw.removedAt)
    };
    recomputeNodeLeagueRecord(record);
    if (!record.lastSuccessAt) {
      record.lastSuccessAt = record.samples.filter((sample) => sample.ok)
        .reduce((latest, sample) => Math.max(latest, sample.at), 0);
    }
    if (!record.lastFailureAt) {
      record.lastFailureAt = record.samples.filter((sample) => !sample.ok)
        .reduce((latest, sample) => Math.max(latest, sample.at), 0);
    }
    if (!record.lastStatus && record.samples.length) {
      record.lastStatus = record.samples[record.samples.length - 1].ok ? "done" : "error";
    }
    return record;
  }

  function normalizeNodeLeagueStore(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const dropLegacyMetric = nodeLeagueInteger(source.version) > 0
      && nodeLeagueInteger(source.version) < NODE_LEAGUE_VERSION;
    const nodes = {};
    Object.entries(source.nodes && typeof source.nodes === "object" ? source.nodes : {}).forEach(([id, record]) => {
      const normalized = normalizeNodeLeagueRecord(id, record, { dropLegacyMetric });
      if (normalized.id) nodes[normalized.id] = normalized;
    });
    return {
      version: NODE_LEAGUE_VERSION,
      updatedAt: nodeLeagueInteger(source.updatedAt),
      nodes
    };
  }

  function nodeLeagueEntrySources(entry) {
    return {
      ids: nodeLeagueUniqueStrings(
        Array.isArray(entry && entry.subscriptionIds)
          ? entry.subscriptionIds
          : [entry && entry.subscriptionId]
      ),
      names: nodeLeagueUniqueStrings(
        Array.isArray(entry && entry.subscriptionNames)
          ? entry.subscriptionNames
          : [entry && entry.subscriptionName]
      )
    };
  }

  function extractLegacyNodeLeagueScores(raw) {
    const scores = {};
    const visit = (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      Object.entries(value).forEach(([key, item]) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return;
        const looksLikeScore = ["points", "firsts", "seconds", "cycles", "latencyMs", "lastRate"]
          .some((field) => Object.prototype.hasOwnProperty.call(item, field));
        if (looksLikeScore) {
          const name = String(key || "").trim().toLowerCase();
          if (name) {
            const existing = scores[name] || {};
            scores[name] = {
              points: Math.max(nodeLeagueInteger(existing.points), nodeLeagueInteger(item.points)),
              firsts: Math.max(nodeLeagueInteger(existing.firsts), nodeLeagueInteger(item.firsts)),
              seconds: Math.max(nodeLeagueInteger(existing.seconds), nodeLeagueInteger(item.seconds)),
              rounds: Math.max(nodeLeagueInteger(existing.rounds), nodeLeagueInteger(item.cycles)),
              latencyMs: nodeLeagueInteger(item.latencyMs || item.lastRate || existing.latencyMs),
              updatedAt: nodeLeagueInteger(item.updatedAt || existing.updatedAt)
            };
          }
        }
        visit(item);
      });
    };
    visit(raw);
    return scores;
  }

  function applyLegacyNodeLeagueScore(record, legacy, now) {
    if (!legacy) return record;
    record.points = Math.max(record.points, nodeLeagueInteger(legacy.points));
    record.firsts = Math.max(record.firsts, nodeLeagueInteger(legacy.firsts));
    record.seconds = Math.max(record.seconds, nodeLeagueInteger(legacy.seconds));
    record.rounds = Math.max(record.rounds, nodeLeagueInteger(legacy.rounds));
    return record;
  }

  function touchNodeLeagueCatalog(store, entries, options = {}) {
    const target = store && typeof store === "object" ? store : normalizeNodeLeagueStore(null);
    if (!target.nodes || typeof target.nodes !== "object") target.nodes = {};
    target.version = NODE_LEAGUE_VERSION;
    const now = nodeLeagueInteger(options.now, Date.now());
    const retentionMs = Math.max(0, nodeLeagueInteger(options.retentionMs, 30 * 24 * 60 * 60 * 1000));
    const legacyScores = options.legacyScores && typeof options.legacyScores === "object" ? options.legacyScores : {};
    const active = new Set();
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const id = String(entry && entry.nodeId || "");
      if (!id) return;
      active.add(id);
      const existed = !!target.nodes[id];
      const record = existed ? normalizeNodeLeagueRecord(id, target.nodes[id]) : normalizeNodeLeagueRecord(id);
      record.names = nodeLeagueUniqueStrings([...record.names, entry.node, entry.tag], 8);
      const sources = nodeLeagueEntrySources(entry);
      record.sourceIds = sources.ids;
      record.sourceNames = sources.names;
      record.removedAt = 0;
      if (!existed) applyLegacyNodeLeagueScore(record, legacyScores[String(entry.node || "").toLowerCase()], now);
      target.nodes[id] = record;
    });
    Object.keys(target.nodes).forEach((id) => {
      if (active.has(id)) return;
      const record = normalizeNodeLeagueRecord(id, target.nodes[id]);
      if (!record.removedAt) record.removedAt = now;
      if (retentionMs && now - record.removedAt > retentionMs) delete target.nodes[id];
      else target.nodes[id] = record;
    });
    target.updatedAt = now;
    return target;
  }

  function recordNodeLeagueResult(store, entry, result, nowValue = Date.now()) {
    const status = String(result && result.status || "");
    if (!["ok", "done", "error"].includes(status)) return null;
    const target = store && typeof store === "object" ? store : normalizeNodeLeagueStore(null);
    if (!target.nodes || typeof target.nodes !== "object") target.nodes = {};
    target.version = NODE_LEAGUE_VERSION;
    const id = String(entry && entry.nodeId || "");
    if (!id) return null;
    const now = nodeLeagueInteger(nowValue, Date.now());
    const record = normalizeNodeLeagueRecord(id, target.nodes[id]);
    const sources = nodeLeagueEntrySources(entry);
    record.names = nodeLeagueUniqueStrings([...record.names, entry.node, entry.tag], 8);
    record.sourceIds = sources.ids;
    record.sourceNames = sources.names;
    record.removedAt = 0;
    const uploadMbps = Math.max(0, Math.round(nodeLeagueNumber(result && result.uploadMbps) * 1000) / 1000);
    const uploadBytes = nodeLeagueInteger(result && result.uploadBytes);
    const uploadMs = nodeLeagueInteger(result && result.uploadMs);
    const echoVerified = !!(result && result.echoVerified);
    const ok = (status === "ok" || status === "done")
      && uploadMbps > 0
      && uploadBytes > 0
      && uploadMs > 0
      && echoVerified;
    record.samples.push({
      at: now,
      ok,
      uploadMbps: ok ? uploadMbps : 0,
      uploadBytes: ok ? uploadBytes : 0,
      uploadMs: ok ? uploadMs : 0,
      echoVerified: ok,
      verified: ok && !!result.verified
    });
    record.samples = record.samples.slice(-NODE_LEAGUE_SAMPLE_LIMIT);
    record.lastStatus = ok ? "done" : "error";
    record.lastUploadMbps = ok ? uploadMbps : 0;
    record.lastUploadBytes = ok ? uploadBytes : 0;
    record.lastUploadMs = ok ? uploadMs : 0;
    record.lastConnectMs = ok ? nodeLeagueInteger(result && result.wssConnectMs) : 0;
    record.lastError = ok ? "" : String(result && result.error || "WSS upload probe failed").slice(0, 500);
    record.updatedAt = now;
    if (ok) {
      record.successCount += 1;
      record.lastSuccessAt = now;
    }
    else {
      record.failCount += 1;
      record.lastFailureAt = now;
    }
    recomputeNodeLeagueRecord(record);
    target.nodes[id] = record;
    target.updatedAt = now;
    return record;
  }

  function awardNodeLeagueRound(store, participantIds, winnerId, runnerUpId, nowValue = Date.now()) {
    const target = store && typeof store === "object" ? store : normalizeNodeLeagueStore(null);
    if (!target.nodes || typeof target.nodes !== "object") target.nodes = {};
    target.version = NODE_LEAGUE_VERSION;
    const now = nodeLeagueInteger(nowValue, Date.now());
    nodeLeagueUniqueStrings(participantIds, 1000).forEach((id) => {
      const record = normalizeNodeLeagueRecord(id, target.nodes[id]);
      record.rounds += 1;
      record.updatedAt = now;
      target.nodes[id] = record;
    });
    if (winnerId && target.nodes[winnerId]) {
      target.nodes[winnerId].points += 2;
      target.nodes[winnerId].firsts += 1;
      target.nodes[winnerId].updatedAt = now;
    }
    if (runnerUpId && runnerUpId !== winnerId && target.nodes[runnerUpId]) {
      target.nodes[runnerUpId].points += 1;
      target.nodes[runnerUpId].seconds += 1;
      target.nodes[runnerUpId].updatedAt = now;
    }
    target.updatedAt = now;
    return target;
  }

  function rankNodeLeagueEntries(entries, store, nowValue = Date.now()) {
    const now = nodeLeagueInteger(nowValue, Date.now());
    const nodes = store && store.nodes && typeof store.nodes === "object" ? store.nodes : {};
    return [...(Array.isArray(entries) ? entries : [])]
      .filter((entry) => {
        const record = nodes[entry && entry.nodeId];
        return !!record && (record.points > 0 || (Array.isArray(record.samples) && record.samples.length > 0));
      })
      .sort((left, right) => {
        const a = normalizeNodeLeagueRecord(left.nodeId, nodes[left.nodeId]);
        const b = normalizeNodeLeagueRecord(right.nodeId, nodes[right.nodeId]);
        const aMedian = a.medianUploadMbps || 0;
        const bMedian = b.medianUploadMbps || 0;
        if (aMedian !== bMedian) return bMedian - aMedian;
        return String(left.nodeId).localeCompare(String(right.nodeId));
      });
  }

  function uniqueOutboundTag(baseValue, usedTags) {
    const base = String(baseValue || "").trim() || "未命名节点";
    let candidate = base;
    let suffix = 2;
    while (usedTags.has(candidate.toLowerCase())) candidate = base + " #" + suffix++;
    usedTags.add(candidate.toLowerCase());
    return candidate;
  }

  function mergeSubscriptionConfigs(sources, options = {}) {
    const sourceList = Array.isArray(sources) ? sources.filter(Boolean) : [];
    const groupName = String(options.groupName || "SmartProxy").trim() || "SmartProxy";
    const baseSource = options.baseConfig
      || (sourceList.find((item) => item && item.config && typeof item.config === "object") || {}).config
      || {};
    const config = cloneConfig(baseSource);
    const uniqueProxies = [];
    const proxyByFingerprint = new Map();

    sourceList.forEach((source, sourceIndex) => {
      const subscriptionId = String(source.id || "subscription-" + (sourceIndex + 1));
      const subscriptionName = String(source.name || "").trim() || "订阅 " + (sourceIndex + 1);
      const nodeNames = Array.isArray(source.nodeNames) ? new Set(source.nodeNames.map(String)) : null;
      const proxies = source.config && Array.isArray(source.config.proxies) ? source.config.proxies : [];
      proxies.forEach((proxy) => {
        const node = String(proxy && proxy.name || "").trim();
        if (!node || (nodeNames && !nodeNames.has(node))) return;
        const fingerprint = proxyFingerprint(proxy);
        const existing = proxyByFingerprint.get(fingerprint);
        if (existing) {
          if (!existing.subscriptionIds.includes(subscriptionId)) existing.subscriptionIds.push(subscriptionId);
          if (!existing.subscriptionNames.includes(subscriptionName)) existing.subscriptionNames.push(subscriptionName);
          return;
        }
        const item = {
          proxy: cloneConfig(proxy),
          nodeId: proxyIdentity(proxy),
          node,
          subscriptionId,
          subscriptionName,
          subscriptionIds: [subscriptionId],
          subscriptionNames: [subscriptionName]
        };
        proxyByFingerprint.set(fingerprint, item);
        uniqueProxies.push(item);
      });
    });

    const nameCounts = new Map();
    uniqueProxies.forEach((item) => {
      const key = item.node.toLowerCase();
      nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
    });
    const usedTags = new Set([
      "direct",
      "block",
      groupName.toLowerCase(),
      "codexprobe",
      "codexprobe-2",
      "codexprobe-3"
    ]);
    const catalog = uniqueProxies.map((item) => {
      const needsPrefix = (nameCounts.get(item.node.toLowerCase()) || 0) > 1
        || usedTags.has(item.node.toLowerCase());
      const tag = uniqueOutboundTag(
        needsPrefix ? item.subscriptionName + " / " + item.node : item.node,
        usedTags
      );
      item.proxy.name = tag;
      return {
        nodeId: item.nodeId,
        subscriptionId: item.subscriptionId,
        subscriptionName: item.subscriptionNames.join(" + "),
        subscriptionIds: [...item.subscriptionIds],
        subscriptionNames: [...item.subscriptionNames],
        node: item.node,
        tag,
        // 入口服务器地址：机场常把上百个节点挂在少数几个入口域名下，
        // 域名一旦下线这些节点全是死的，必须能按入口批量判定。
        server: String(item.proxy && item.proxy.server || "").trim()
      };
    });

    config.proxies = uniqueProxies.map((item) => item.proxy);
    config["proxy-groups"] = [];
    config.rules = [];
    delete config["proxy-providers"];
    delete config["rule-providers"];
    return { config, catalog };
  }

  function splitList(value) {
    if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
    return String(value || "")
      .split(/[\n,\s\uFF0C]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const OPENAI_DOMAIN_DEFAULTS = ["chatgpt.com", "openai.com", "oaistatic.com", "oaiusercontent.com", "oaistatsig.com"];

  function openAiDomains(settings) {
    const values = splitList(settings && (settings.openAiDomains || settings.forcedDomains));
    const seen = new Set();
    return [...OPENAI_DOMAIN_DEFAULTS, ...values]
      .map(cleanHost)
      .filter(Boolean)
      .filter((domain) => {
        if (seen.has(domain)) return false;
        seen.add(domain);
        return true;
      });
  }

  function isOpenAiDomain(value, settings) {
    const host = cleanHost(value);
    if (!host) return false;
    return openAiDomains(settings).some((domain) => host === domain || host.endsWith(`.${domain}`));
  }

  function isOpenAiCustomRule(rule, settings) {
    const normalized = normalizeRule(rule);
    if (!normalized) return false;
    const type = normalized.type;
    const value = String(normalized.value || "").toLowerCase();
    const domains = openAiDomains(settings);
    if (type === "DOMAIN-SUFFIX-SET") {
      const values = splitList(value);
      return domains.every((domain) => values.includes(domain));
    }
    if (type === "DOMAIN-SUFFIX" || type === "DOMAIN") return isOpenAiDomain(value, settings);
    if (type === "DOMAIN-KEYWORD") {
      return domains.some((domain) => domain.includes(value) || value.includes(domain.split(".")[0]));
    }
    if (type === "DOMAIN-REGEX") {
      return domains.some((domain) => value.includes(domain.replace(/\./g, "\\.")) || value.includes(domain));
    }
    return false;
  }

  function openAiCustomRule(settings) {
    const domains = openAiDomains(settings);
    return {
      type: "DOMAIN-SUFFIX-SET",
      value: domains.join(","),
      outbound: "SMART",
      position: "prepend"
    };
  }

  function ensureOpenAiCustomRule(rules, settings) {
    const defaultRule = openAiCustomRule(settings);
    const filtered = (Array.isArray(rules) ? rules : [])
      .map(normalizeRule)
      .filter(Boolean)
      .filter((rule) => !isOpenAiCustomRule(rule, settings));
    return [defaultRule, ...filtered];
  }

  const PROTECTED_PROXY_RULES = [
    { type: "PROCESS-KEYWORD", value: "telegram", outbound: "SMART", position: "prepend" },
    { type: "PROCESS-PATH-REGEX", value: "(?i).*Telegram.*", outbound: "SMART", position: "prepend" },
    { type: "DOMAIN-SUFFIX", value: "telegram.org", outbound: "SMART", position: "prepend" },
    { type: "DOMAIN-SUFFIX", value: "telegram.me", outbound: "SMART", position: "prepend" },
    { type: "DOMAIN-SUFFIX", value: "telegram.dog", outbound: "SMART", position: "prepend" },
    { type: "IP-CIDR", value: "91.108.4.0/22", outbound: "SMART", position: "prepend" },
    { type: "IP-CIDR", value: "91.108.8.0/22", outbound: "SMART", position: "prepend" },
    { type: "IP-CIDR", value: "91.108.12.0/22", outbound: "SMART", position: "prepend" },
    { type: "IP-CIDR", value: "91.108.16.0/22", outbound: "SMART", position: "prepend" },
    { type: "IP-CIDR", value: "91.108.20.0/22", outbound: "SMART", position: "prepend" },
    { type: "IP-CIDR", value: "91.108.56.0/22", outbound: "SMART", position: "prepend" },
    { type: "IP-CIDR", value: "149.154.160.0/20", outbound: "SMART", position: "prepend" }
  ];

  function protectedProxyRules() {
    return PROTECTED_PROXY_RULES.map((rule) => ({ ...rule }));
  }

  function sourceMode(settings) {
    return String(settings && settings.subscriptionUrl || "").trim() ? "url" : "file";
  }

  function chooseSubscriptionUrl(options) {
    const homeValue = String(options && options.homeValue || "").trim();
    const settingsValue = String(options && options.settingsValue || "").trim();
    return String(options && options.currentView || "") === "home"
      ? (homeValue || settingsValue)
      : (settingsValue || homeValue);
  }

  function normalizeSubscriptions(settings) {
    const source = settings && typeof settings === "object" ? settings : {};
    const legacyUrl = String(source.subscriptionUrl || "").trim();
    const legacyCachedUrl = String(source.cachedSubscriptionUrl || "").trim();
    const requestedActiveId = String(source.activeSubscriptionId || "").trim();
    const raw = Array.isArray(source.subscriptions)
      ? source.subscriptions.filter((item) => item && typeof item === "object")
      : [];
    const used = new Set();
    const subscriptions = raw.map((item, index) => {
      const baseId = String(item.id || `subscription-${index + 1}`)
        .trim()
        .replace(/[^0-9A-Za-z._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || `subscription-${index + 1}`;
      let id = baseId;
      let suffix = 2;
      while (used.has(id)) id = `${baseId}-${suffix++}`;
      used.add(id);
      return {
        id,
        name: String(item.name || "").trim() || `订阅 ${index + 1}`,
        url: String(item.url || "").trim(),
        cachedUrl: String(item.cachedUrl || item.cachedSubscriptionUrl || "").trim()
      };
    });

    if (!subscriptions.length) {
      subscriptions.push({
        id: "default",
        name: "默认订阅",
        url: legacyUrl,
        cachedUrl: legacyCachedUrl
      });
    }

    let active = subscriptions.find((item) => item.id === requestedActiveId) || subscriptions[0];
    if (!active.url && legacyUrl) active.url = legacyUrl;
    if (!active.cachedUrl && legacyCachedUrl && active.url === legacyUrl) active.cachedUrl = legacyCachedUrl;
    return {
      subscriptions,
      activeSubscriptionId: active.id,
      subscriptionUrl: active.url,
      cachedSubscriptionUrl: active.cachedUrl
    };
  }

  function subscriptionCacheFileNames(subscription) {
    const id = String(subscription && subscription.id || "default")
      .trim()
      .replace(/[^0-9A-Za-z._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "default";
    if (id === "default") {
      return {
        config: "subscription.yaml",
        headers: "subscription.headers.txt"
      };
    }
    return {
      config: `subscription.${id}.yaml`,
      headers: `subscription.${id}.headers.txt`
    };
  }

  function buildSubscriptionCurlArgs(options) {
    const seconds = String(numberValue(options && options.seconds, 30));
    const proxyUrl = String(options && options.proxyUrl || "").trim();
    const args = [
      "curl.exe",
      "-L",
      "-sS",
      "--fail",
      "--compressed",
      "--connect-timeout", seconds,
      "--max-time", seconds,
      // 机场普遍按 UA 下发配置；部分站点（如 lovenao）只认 clash.meta 系
      "-A", "clash.meta/1.19.0",
      "-H", "Accept: */*",
      "-H", "Profile-Update-Interval: 24",
    ];
    if (proxyUrl) args.push("--proxy", proxyUrl);
    else args.push("--noproxy", "*");
    if (options && options.headersPath) {
      args.push("-D", String(options.headersPath));
    }
    args.push(
      "-o", String(options && options.path || ""),
      String(options && options.url || "")
    );
    return args;
  }

  function subscriptionConfigHasNodes(config) {
    return Array.isArray(config && config.proxies)
      && config.proxies.some((proxy) => proxy && typeof proxy === "object" && String(proxy.name || "").trim());
  }

  function buildWindowsNetworkOptimizeScript(options) {
    const port = Math.max(1, Math.min(65535, Math.trunc(numberValue(options && options.mainPort, 7899))));
    return [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      "$backupDir = Join-Path $env:ProgramData 'SmartProxy'",
      "New-Item -ItemType Directory -Force -Path $backupDir | Out-Null",
      "$backup = Join-Path $backupDir ('tcpip-parameters-before-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.reg')",
      "reg export 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters' $backup /y | Out-Null",
      "$path = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters'",
      "New-ItemProperty -Path $path -Name KeepAliveTime -Value 30000 -PropertyType DWord -Force | Out-Null",
      "New-ItemProperty -Path $path -Name KeepAliveInterval -Value 5000 -PropertyType DWord -Force | Out-Null",
      "New-ItemProperty -Path $path -Name TcpMaxDataRetransmissions -Value 5 -PropertyType DWord -Force | Out-Null",
      `netsh winhttp set proxy proxy-server="http=127.0.0.1:${port};https=127.0.0.1:${port}" bypass-list="localhost;127.*;192.168.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;<local>"`,
      "Write-Host ('Smart Proxy system network optimization applied. Backup: ' + $backup)"
    ].join("\r\n");
  }

  function buildWindowsNetworkStatusScript(options) {
    const port = Math.max(1, Math.min(65535, Math.trunc(numberValue(options && options.mainPort, 7899))));
    return [
      "$ErrorActionPreference = 'Continue'",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      "$path = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters'",
      `Set-Variable -Name expectedHttp -Value 'http=127.0.0.1:${port}'`,
      `Set-Variable -Name expectedHttps -Value 'https=127.0.0.1:${port}'`,
      "function Read-Dword([string]$name) { try { return [int]((Get-ItemProperty -Path $path -Name $name -ErrorAction Stop).$name) } catch { return $null } }",
      "$keepAliveTime = Read-Dword 'KeepAliveTime'",
      "$keepAliveInterval = Read-Dword 'KeepAliveInterval'",
      "$tcpMaxDataRetransmissions = Read-Dword 'TcpMaxDataRetransmissions'",
      "$tcpOk = ($keepAliveTime -eq 30000 -and $keepAliveInterval -eq 5000 -and $tcpMaxDataRetransmissions -eq 5)",
      "$winHttpText = ((netsh winhttp show proxy) 2>&1 | Out-String)",
      "$normalizedWinHttp = (($winHttpText -replace '\\s+', ' ').Trim())",
      "$winHttpOk = ($normalizedWinHttp.Contains($expectedHttp) -and $normalizedWinHttp.Contains($expectedHttps))",
      "[pscustomobject]@{",
      `  expectedPort = ${port};`,
      "  ok = [bool]($tcpOk -and $winHttpOk);",
      "  tcpOk = [bool]$tcpOk;",
      "  winHttpOk = [bool]$winHttpOk;",
      "  keepAliveTime = $keepAliveTime;",
      "  keepAliveInterval = $keepAliveInterval;",
      "  tcpMaxDataRetransmissions = $tcpMaxDataRetransmissions;",
      "  winHttpProxy = $normalizedWinHttp;",
      "  checkedAt = (Get-Date).ToString('s')",
      "} | ConvertTo-Json -Compress"
    ].join("\r\n");
  }

  function buildWindowsNetworkRevertScript() {
    return [
      "$ErrorActionPreference = 'Continue'",
      "$path = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters'",
      "Remove-ItemProperty -Path $path -Name KeepAliveTime -ErrorAction SilentlyContinue",
      "Remove-ItemProperty -Path $path -Name KeepAliveInterval -ErrorAction SilentlyContinue",
      "Remove-ItemProperty -Path $path -Name TcpMaxDataRetransmissions -ErrorAction SilentlyContinue",
      "netsh winhttp reset proxy",
      "Write-Host 'Smart Proxy system network optimization reverted.'"
    ].join("\r\n");
  }

  function formatTrafficBytes(bytes) {
    const value = Math.max(0, numberValue(bytes, 0));
    const units = ["B", "KB", "MB", "GB", "TB"];
    let n = value;
    let unit = units[0];
    for (let i = 1; i < units.length && n >= 1024; i++) {
      n = n / 1024;
      unit = units[i];
    }
    if (unit === "B") return `${Math.round(n)} B`;
    return `${n.toFixed(1)} ${unit}`;
  }

  function parseSubscriptionTraffic(text) {
    const source = String(text || "");
    const pairs = {};
    source.replace(/(?:upload|download|total|expire)\s*=\s*\d+/gi, (part) => {
      const pieces = part.split("=");
      pairs[pieces[0].trim().toLowerCase()] = numberValue(pieces[1], 0);
      return part;
    });
    const total = numberValue(pairs.total, 0);
    if (!total) return null;
    const upload = numberValue(pairs.upload, 0);
    const download = numberValue(pairs.download, 0);
    const used = Math.max(0, upload + download);
    const remaining = Math.max(0, total - used);
    return {
      uploadBytes: upload,
      downloadBytes: download,
      usedBytes: used,
      totalBytes: total,
      remainingBytes: remaining,
      expire: numberValue(pairs.expire, 0),
      remainingText: formatTrafficBytes(remaining),
      totalText: formatTrafficBytes(total),
      usedText: formatTrafficBytes(used),
      usedPercent: Math.min(100, Math.round((used / total) * 100))
    };
  }

  const CODEX_PROBE_STORE_VERSION = 1;

  function successfulCodexProbeResult(value) {
    const requestedModel = String(value && value.requestedModel || "");
    const resolvedModel = String(value && value.resolvedModel || "");
    return !!value
      && value.status === "done"
      && value.anthropicOk !== false
      && Number.isFinite(Number(value.tokPerSec))
      && Number(value.tokPerSec) > 0
      && value.resolvedModelVerified === true
      && !!requestedModel
      && resolvedModel === requestedModel;
  }

  function normalizeCodexProbeResult(value) {
    if (!successfulCodexProbeResult(value)) return null;
    const number = (key) => Math.max(0, Number(value[key]) || 0);
    return {
      status: "done",
      node: String(value.node || "").slice(0, 500),
      anthropicOk: value.anthropicOk !== false,
      anthropicHttp: number("anthropicHttp"),
      anthropicMs: number("anthropicMs"),
      gatePass: number("gatePass"),
      gateRounds: number("gateRounds"),
      gateMsMax: number("gateMsMax"),
      delayMs: number("delayMs"),
      tokPerSec: Math.round(number("tokPerSec") * 10) / 10,
      tokEst: Math.round(number("tokEst")),
      tokTtftMs: Math.round(number("tokTtftMs")),
      tokStreamMs: Math.round(number("tokStreamMs")),
      tokElapsedMs: Math.round(number("tokElapsedMs")),
      tokDeltaCount: Math.round(number("tokDeltaCount")),
      tokStreamBuffered: value.tokStreamBuffered === true,
      requestedModel: String(value.requestedModel || "").slice(0, 100),
      resolvedModel: String(value.resolvedModel || "").slice(0, 100),
      resolvedModelVerified: value.resolvedModelVerified === true,
      modelVerificationSource: String(value.modelVerificationSource || "").slice(0, 100),
      probeModelId: String(value.probeModelId || "").slice(0, 100),
      timingSource: String(value.timingSource || "").slice(0, 100),
      routeVerification: String(value.routeVerification || "").slice(0, 100),
      measuredAt: Math.max(0, Math.trunc(Number(value.measuredAt) || 0)),
      serverConfirmed: value.serverConfirmed !== false
    };
  }

  function normalizeCodexProbeStore(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const results = {};
    Object.entries(source.results && typeof source.results === "object" ? source.results : {})
      .slice(0, 1000)
      .forEach(([key, value]) => {
        const normalizedKey = String(key || "").slice(0, 1000);
        const normalized = normalizeCodexProbeResult(value);
        if (normalizedKey && normalized) results[normalizedKey] = normalized;
      });
    return {
      version: CODEX_PROBE_STORE_VERSION,
      updatedAt: Math.max(0, Math.trunc(Number(source.updatedAt) || 0)),
      results
    };
  }

  function mergeCodexProbeResult(previous, next) {
    const prior = previous && typeof previous === "object" ? previous : null;
    const candidate = next && typeof next === "object" ? next : null;
    if (!candidate) return prior;
    if (["pending", "cancelled"].includes(candidate.status) && successfulCodexProbeResult(prior)) {
      return { ...prior };
    }
    if (successfulCodexProbeResult(candidate)) {
      return { ...candidate, status: "done" };
    }
    const failed = { ...candidate };
    delete failed.tokPerSec;
    return failed;
  }

  function codexProbeResultFor(results, key) {
    if (results instanceof Map) return results.get(key) || null;
    return results && typeof results === "object" ? results[key] || null : null;
  }

  function codexProbeRank(result) {
    if (!result) return { band: 2, tok: 0, ttft: Infinity, delay: Infinity };
    if (result.status === "done" && result.anthropicOk === false) {
      return { band: 4, tok: 0, ttft: Infinity, delay: Infinity };
    }
    if (result.status === "done" && result.anthropicOk !== false) {
      const tok = Math.max(0, Number(result.tokPerSec) || 0);
      const ttft = Math.max(0, Number(result.tokTtftMs) || 0) || Infinity;
      const delay = Math.max(0, Number(result.delayMs || result.anthropicMs) || 0) || Infinity;
      return { band: tok > 0 ? 0 : 1, tok, ttft, delay };
    }
    return { band: 3, tok: 0, ttft: Infinity, delay: Infinity };
  }

  function rankCodexProbeEntries(entries, results) {
    return [...(Array.isArray(entries) ? entries : [])]
      .map((entry, index) => ({ entry, index, rank: codexProbeRank(codexProbeResultFor(results, entry && entry.key)) }))
      .sort((left, right) => left.rank.band - right.rank.band
        || right.rank.tok - left.rank.tok
        || left.rank.ttft - right.rank.ttft
        || left.rank.delay - right.rank.delay
        || left.index - right.index)
      .map((item) => item.entry);
  }

  function rankCurrentCodexProbeEntries(entries, results, gateOutcomes, tokSuccessKeys) {
    const gateFor = (key) => gateOutcomes instanceof Map
      ? gateOutcomes.get(key)
      : gateOutcomes && typeof gateOutcomes === "object" ? gateOutcomes[key] : null;
    const hasCurrentTok = (key) => tokSuccessKeys instanceof Set
      ? tokSuccessKeys.has(key)
      : Array.isArray(tokSuccessKeys) ? tokSuccessKeys.includes(key) : false;
    return rankCodexProbeEntries(entries, results).filter((entry) => {
      const key = entry && entry.key;
      return !!key
        && gateFor(key)?.ok === true
        && hasCurrentTok(key)
        && successfulCodexProbeResult(codexProbeResultFor(results, key));
    });
  }

  function findRestorableNode(entries, settings) {
    const list = Array.isArray(entries) ? entries : [];
    const saved = settings && typeof settings === "object" ? settings : {};
    const key = String(saved.lastSelectedNodeKey || "");
    const tag = String(saved.lastSelectedNodeTag || "");
    return list.find((entry) => key && String(entry && entry.key || "") === key)
      || list.find((entry) => tag && String(entry && (entry.tag || entry.node) || "") === tag)
      || null;
  }

  

  

  function nodeDisplayMeta(name) {
    const raw = String(name || "").trim();
    const upper = raw.toUpperCase();
    const regionMap = [
      [/香港|HK|HONG\s*KONG/, "HK", "香港"],
      [/台湾|臺灣|TW|TAIWAN/, "TW", "台湾"],
      [/日本|JP|JAPAN/, "JP", "日本"],
      [/新加坡|SG|SINGAPORE/, "SG", "新加坡"],
      [/美国|US|USA|UNITED\s*STATES|LOS\s*ANGELES|LA/, "US", "美国"],
      [/韩国|KR|KOREA/, "KR", "韩国"],
      [/英国|UK|GB|UNITED\s*KINGDOM/, "UK", "英国"],
      [/德国|DE|GERMANY/, "DE", "德国"],
      [/法国|FR|FRANCE/, "FR", "法国"]
    ];
    const matched = regionMap.find(([pattern]) => pattern.test(upper));
    const icon = matched ? matched[1] : shortCode(raw);
    const region = matched ? matched[2] : "节点";
    const shortName = raw
      .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
      .replace(/\s*[-|]\s*(TROJAN|VMESS|VLESS|SS|ANYTLS|HYSTERIA2|HY2).*$/i, "")
      .trim()
      .slice(0, 18) || raw.slice(0, 18) || "-";
    return { icon, region, shortName };
  }

  function shortCode(value) {
    const words = String(value || "").match(/[A-Za-z0-9]+/g) || [];
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return "SP";
  }

  function normalizeCoreVersion(value) {
    const match = String(value || "").match(/v?(\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?)/);
    return match ? match[1].toLowerCase() : "";
  }

  function coreUpdateStatus(info) {
    if (!info || !info.exists || String(info.local || "").toLowerCase() === "missing") {
      return { status: "missing", localVersion: "", latestVersion: normalizeCoreVersion(info && info.latest) };
    }
    const localVersion = normalizeCoreVersion(info.local);
    const latestVersion = normalizeCoreVersion(info.latest);
    if (!latestVersion) return { status: "unknown", localVersion, latestVersion };
    if (localVersion === latestVersion) return { status: "latest", localVersion, latestVersion };
    return { status: "update", localVersion, latestVersion };
  }

  function coreNeedsInstall(info) {
    if (!info || !info.exists || String(info.local || "").toLowerCase() === "missing") return true;
    return !normalizeCoreVersion(info.local);
  }

  function coreRepairAction(info) {
    return coreNeedsInstall(info) ? "extract_bundled" : "none";
  }

  function safeFileToken(value, fallback) {
    const version = normalizeCoreVersion(value);
    const token = version || String(value || "").trim()
      .replace(/[^0-9A-Za-z._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return (token || fallback || "new").slice(0, 64);
  }

  function coreFallbackInstallPath(destinationPath, suffix) {
    const normalized = String(destinationPath || "").trim().replace(/\\/g, "/").replace(/\/+/g, "/");
    const slashIndex = normalized.lastIndexOf("/");
    const dir = slashIndex >= 0 ? normalized.slice(0, slashIndex + 1) : "";
    const file = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
    const base = (file || "core").replace(/\.exe$/i, "") || "core";
    return `${dir}${base}-${safeFileToken(suffix, "new")}.exe`;
  }

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  function shouldUseCachedSubscription(options) {
    const url = String(options && options.url || "").trim();
    const cachedUrl = String(options && options.cachedUrl || "").trim();
    return !!url && !!cachedUrl && url === cachedUrl && !!(options && options.exists) && !(options && options.refresh);
  }

  function mergeSettingsWithDefaultMigration(saved, defaults, previousDefaults) {
    const source = saved && typeof saved === "object" ? saved : {};
    const result = { ...(defaults || {}), ...source };
    const old = previousDefaults || {};
    Object.keys(old).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(source, key) || String(source[key]) === String(old[key])) {
        result[key] = defaults[key];
      }
    });
    return result;
  }

  function normalizePathForCompare(value) {
    return String(value || "").replace(/\\/g, "/").replace(/\/+/g, "/").toLowerCase();
  }

  function portablePath(value) {
    return String(value || "").trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
  }

  function resolvePortableDataRoot(options) {
    const appPath = portablePath(options && options.appPath);
    const dirName = portablePath(options && options.dataDirName || "smart-proxy-data").replace(/^\/+/, "");
    return `${appPath || "."}/${dirName}`;
  }

  function resolvePortableCorePath(options) {
    const configured = portablePath(options && options.configuredPath);
    const bundled = portablePath(options && options.bundledPath);
    if (!bundled) return configured;
    if (!configured || options.configuredExists !== true) return bundled;

    const configuredText = normalizePathForCompare(configured).replace(/\/$/, "");
    const dataRoot = normalizePathForCompare(options && options.dataRoot).replace(/\/$/, "");
    if (dataRoot && (configuredText === dataRoot || configuredText.startsWith(`${dataRoot}/`))) {
      return configured;
    }

    const dataDirName = portablePath(options && options.dataDirName || "smart-proxy-data")
      .replace(/^\/+|\/+$/g, "")
      .toLowerCase();
    const executableName = portablePath(options && options.executableName)
      .replace(/^.*\//, "")
      .toLowerCase();
    if (dataDirName && executableName && configuredText.endsWith(`/${dataDirName}/${executableName}`)) {
      return bundled;
    }
    return configured;
  }

  function normalizePortList(ports) {
    const source = Array.isArray(ports) ? ports : [];
    return Array.from(new Set(source
      .map((port) => Number(port))
      .filter((port) => Number.isInteger(port) && port > 0 && port <= 65535)));
  }

  function buildCorePortCleanupScript(ports) {
    const portList = normalizePortList(ports);
    if (!portList.length) return "";
    return `
$ports = @(${portList.join(",")})
function Get-PortOwners {
  Get-NetTCPConnection -LocalPort $ports -ErrorAction SilentlyContinue |
    Where-Object { $_.OwningProcess -and $_.OwningProcess -ne $PID } |
    Select-Object -ExpandProperty OwningProcess -Unique
}
$pids = Get-PortOwners
foreach ($id in $pids) {
  if ($id) {
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  }
}
$deadline = (Get-Date).AddSeconds(5)
while ((Get-Date) -lt $deadline) {
  $busy = Get-PortOwners
  if (-not $busy) { break }
  Start-Sleep -Milliseconds 100
}
$busy = Get-PortOwners
if ($busy) {
  throw "ports still busy: $($ports -join ',') owners=$($busy -join ',')"
}
`;
  }

  function buildCoreProcessCleanupScript(options) {
    const corePath = String(options && options.corePath || "").trim();
    const runtimePath = String(options && options.runtimePath || "").trim();
    if (!corePath || !runtimePath) return "";
    const coreText = corePath.replace(/\\/g, "/").toLowerCase();
    const runtimeText = runtimePath.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
    return `
$coreText = '${coreText.replace(/'/g, "''")}'
$runtimeText = '${runtimeText.replace(/'/g, "''")}'
function Normalize-ProcessText($value) {
  return ([string]$value).ToLowerInvariant().Replace('\\','/')
}
function Get-StaleCoreProcesses {
  Get-CimInstance Win32_Process |
    Where-Object {
      if (-not $_.CommandLine -or $_.ProcessId -eq $PID) { return $false }
      $cmd = Normalize-ProcessText $_.CommandLine
      $exe = Normalize-ProcessText $_.ExecutablePath
      (($exe -eq $coreText) -or $cmd.Contains($coreText)) -and $cmd.Contains($runtimeText)
    }
}
$targets = @(Get-StaleCoreProcesses | Select-Object ProcessId,Name,CommandLine)
foreach ($proc in $targets) {
  Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
}
$deadline = (Get-Date).AddSeconds(5)
while ((Get-Date) -lt $deadline) {
  $remaining = @(Get-StaleCoreProcesses)
  if (-not $remaining) { break }
  Start-Sleep -Milliseconds 100
}
$remaining = @(Get-StaleCoreProcesses)
if ($remaining) {
  throw "stale core processes still alive: $($remaining.ProcessId -join ',')"
}
Write-Output ("cleared=" + (($targets | ForEach-Object { $_.ProcessId }) -join ','))
`;
  }

  function isManagedRuntimePath(filePath, runtimePath) {
    const file = normalizePathForCompare(filePath);
    const runtime = normalizePathForCompare(runtimePath).replace(/\/$/, "");
    if (!file || !runtime) return false;
    return file === `${runtime}/subscription.yaml` ||
      file === `${runtime}/main.json` ||
      file === `${runtime}/main.yaml` ||
      file.startsWith(`${runtime}/`);
  }

  function migrateSettingsForAppVersion(settings, options) {
    const currentVersion = numberValue(options && options.currentVersion, 1);
    const runtimePath = options && options.runtimePath;
    const defaults = options && options.defaults || {};
    const source = settings && typeof settings === "object" ? settings : {};
    const result = { ...source };
    const previousVersion = numberValue(source.appConfigVersion, 0);
    const changedVersion = previousVersion !== currentVersion;
    let changed = changedVersion;
    let clearRuntime = changedVersion;

    if (changedVersion && !String(result.subscriptionUrl || "").trim() && isManagedRuntimePath(result.configPath, runtimePath)) {
      result.configPath = "";
      changed = true;
    }

    if (currentVersion >= 8 && previousVersion < 8 && numberValue(result.timeoutMs, 0) === 2000) {
      result.timeoutMs = 1000;
      changed = true;
    }

    if (currentVersion >= 10 && previousVersion < 10) {
      const domains = openAiDomains(result).join(",");
      result.openAiDomains = domains;
      result.forcedDomains = domains;
      if (Array.isArray(result.customRules)) {
        const filtered = result.customRules.filter((rule) => !isOpenAiCustomRule(rule, result));
        if (filtered.length !== result.customRules.length) {
          result.customRules = filtered;
          changed = true;
        }
      }
      changed = true;
    }

    if (currentVersion >= 11 && previousVersion < 11) {
      const domains = openAiDomains(result).join(",");
      result.customRules = ensureOpenAiCustomRule(result.customRules, result);
      result.openAiDomains = "";
      result.forcedDomains = "";
      changed = true;
    }

    if (currentVersion >= 12 && previousVersion < 12) {
      const domains = openAiDomains(result).join(",");
      result.customRules = ensureOpenAiCustomRule(result.customRules, result);
      changed = true;
      clearRuntime = true;
    }

    if (currentVersion >= 13 && previousVersion < 13) {
      const allowedKeys = new Set(Object.keys(defaults || {}));
      Object.keys(result).forEach((key) => {
        if (!allowedKeys.has(key)) delete result[key];
      });
      changed = true;
      clearRuntime = true;
    }

    if (currentVersion >= 14 && previousVersion < 14) {
      Object.assign(result, normalizeSubscriptions(result));
      changed = true;
    }

    if (currentVersion >= 15 && previousVersion < 15) {
      const allowedKeys = new Set(Object.keys(defaults || {}));
      Object.keys(result).forEach((key) => {
        if (!allowedKeys.has(key)) delete result[key];
      });
      changed = true;
      clearRuntime = true;
    }

    result.appConfigVersion = currentVersion;
    return { settings: result, changed, clearRuntime };
  }

  function cleanHost(value) {
    return String(value || "")
      .trim()
      .replace(/^\[|\]$/g, "")
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      .split(":")[0]
      .toLowerCase();
  }

  

  function normalizeRule(rule) {
    if (!rule || !rule.type || !rule.value) return null;
    let type = String(rule.type).trim().toUpperCase();
    let value = String(rule.value).trim();
    const outbound = String(rule.outbound || "SMART").trim().toUpperCase();
    const position = String(rule.position || "prepend").trim().toLowerCase() === "append" ? "append" : "prepend";
    if (type === "PROCESS-KEYWORD") {
      type = "PROCESS-NAME-REGEX";
      value = `(?i).*${escapeRegExp(value)}.*`;
    }
    return { type, value, outbound, position };
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function outboundName(outbound, groupName) {
    if (outbound === "DIRECT" || outbound === "REJECT") return outbound;
    return groupName;
  }

  function buildRule(rule, groupName) {
    const normalized = normalizeRule(rule);
    if (!normalized) return null;
    return `${normalized.type},${normalized.value},${outboundName(normalized.outbound, groupName)}`;
  }

  function ruleParts(rule) {
    return String(rule || "").split(",").map((part) => part.trim());
  }

  function sameMatcher(rule, type, value) {
    const parts = ruleParts(rule);
    return parts[0] && parts[1] &&
      parts[0].toUpperCase() === String(type).toUpperCase() &&
      parts[1].toLowerCase() === String(value).toLowerCase();
  }

  function insertBeforeMatch(rules, appendRules) {
    if (!appendRules.length) return rules;
    const index = rules.findIndex((rule) => ruleParts(rule)[0].toUpperCase() === "MATCH");
    if (index < 0) return rules.concat(appendRules);
    return rules.slice(0, index).concat(appendRules, rules.slice(index));
  }

  function applySmartProxyOverrides(config, options) {
    const result = cloneConfig(config);
    const groupName = options.groupName || "SmartProxy";
    const nodeNames = Array.isArray(options.nodeNames) ? options.nodeNames.filter(Boolean) : [];
    const forcedDomains = splitList(options.forcedDomains);
    const customRules = Array.isArray(options.customRules) ? options.customRules.map(normalizeRule).filter(Boolean) : [];

    const managedMatchers = [];
    forcedDomains.forEach((domain) => managedMatchers.push(["DOMAIN-SUFFIX", domain]));
    customRules.forEach((rule) => {
      if (rule.type === "DOMAIN-SUFFIX-SET") splitList(rule.value).forEach((domain) => managedMatchers.push(["DOMAIN-SUFFIX", domain]));
      else managedMatchers.push([rule.type, rule.value]);
    });

    result["proxy-groups"] = (result["proxy-groups"] || []).filter((group) => group && group.name !== groupName);
    result["proxy-groups"].unshift({
      name: groupName,
      type: "select",
      proxies: nodeNames.length ? nodeNames : ["DIRECT"]
    });

    if (options && options.globalProxy) {
      result.rules = [`MATCH,${groupName}`];
      return result;
    }

    const originalRules = Array.isArray(result.rules) ? result.rules : [];
    const filteredRules = originalRules.filter((rule) => {
      return !managedMatchers.some(([type, value]) => sameMatcher(rule, type, value));
    });

    const prependRules = [];
    forcedDomains.forEach((domain) => prependRules.push(`DOMAIN-SUFFIX,${domain},${groupName}`));
    const customPrepend = [];
    const customAppend = [];
    customRules.forEach((rule) => {
      const lines = rule.type === "DOMAIN-SUFFIX-SET"
        ? splitList(rule.value).map((domain) => `DOMAIN-SUFFIX,${domain},${outboundName(rule.outbound, groupName)}`)
        : [buildRule(rule, groupName)].filter(Boolean);
      if (rule.position === "append") customAppend.push(...lines);
      else customPrepend.push(...lines);
    });

    if (options && options.customOnlyRoutes) {
      result.rules = prependRules.concat(customPrepend, customAppend, ["MATCH,DIRECT"]);
      return result;
    }

    result.rules = prependRules.concat(customPrepend, customAppend, filteredRules);
    return result;
  }

  function resolveFinalNode(groups, name) {
    let current = name || "";
    const seen = new Set();
    while (current && groups[current] && groups[current].now && !seen.has(current)) {
      seen.add(current);
      current = groups[current].now;
    }
    return current || name || "-";
  }

  function numberValue(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function codexProbeMetrics(samples, timeoutMs) {
    const timeout = Math.max(1, Math.round(numberValue(timeoutMs, 30000)));
    const source = Array.isArray(samples) ? samples : [];
    const durationsMs = source.map((sample) => {
      const duration = Math.round(numberValue(sample && sample.durationMs, timeout));
      return sample && sample.status === "ok" && duration > 0
        ? Math.min(timeout, duration)
        : timeout;
    });
    const successCount = source.filter((sample) => sample && sample.status === "ok").length;
    const sorted = [...durationsMs].sort((a, b) => a - b);
    const p95Index = sorted.length ? Math.max(0, Math.ceil(sorted.length * 0.95) - 1) : 0;
    return {
      p95Ms: sorted.length ? sorted[p95Index] : timeout,
      successCount,
      failureCount: source.length - successCount,
      total: source.length,
      durationsMs
    };
  }

  function shouldRetryCodexProbe(result) {
    if (!result || result.status !== "error") return false;
    if (Number(result.connectionCount || 0) === 0) return true;
    return /timeout|timed out|超时|connect|connection|reset|closed|handshake|wss/i
      .test(String(result.error || ""));
  }

  function uniqueCodexProbeItems(items, keyOf) {
    const source = Array.isArray(items) ? items : [];
    const identity = typeof keyOf === "function"
      ? keyOf
      : (item, index) => (item && (item.key ?? item.port)) ?? index;
    const seen = new Set();
    return source.filter((item, index) => {
      const key = String(identity(item, index) ?? "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function runCodexProbeModelPool(items, options) {
    const settings = options && typeof options === "object" ? options : {};
    const identity = typeof settings.keyOf === "function"
      ? settings.keyOf
      : (item, index) => (item && (item.key ?? item.port)) ?? index;
    const source = uniqueCodexProbeItems(items, identity)
      .map((item, index) => ({ item, index, key: String(identity(item, index) ?? "") }));
    const configuredModels = Array.isArray(settings.models) ? settings.models : [];
    if (!configuredModels.length) throw new Error("at least one probe model is required");

    const modelStates = new Map();
    const models = configuredModels.map((model, modelIndex) => {
      const id = String(model && model.id || `model-${modelIndex + 1}`);
      if (!model || typeof model.worker !== "function") throw new Error(`worker is required for probe model ${id}`);
      if (modelStates.has(id)) throw new Error(`duplicate probe model id: ${id}`);
      const state = {
        id,
        worker: model.worker,
        concurrency: Math.max(1, Math.min(512, Math.trunc(numberValue(model.concurrency, 1)))),
        disabled: false,
        completedCount: 0,
        nodeFailureCount: 0,
        modelFailureCount: 0,
        error: null
      };
      modelStates.set(id, state);
      return state;
    });

    const maxConcurrency = Math.max(...models.map((model) => model.concurrency));
    const slots = [];
    // Interleave model slots so both healthy models start pulling different nodes immediately.
    for (let laneIndex = 0; laneIndex < maxConcurrency; laneIndex++) {
      for (const model of models) {
        if (laneIndex < model.concurrency) slots.push({ model, laneIndex, promise: null });
      }
    }

    const pending = [...source];
    const outcomes = new Map();
    const active = new Set();
    const toError = (error, value, fallback) => {
      if (error instanceof Error) return error;
      const detail = error || (value && value.error) || fallback;
      return new Error(String(detail || fallback));
    };
    const requeue = (record) => {
      if (outcomes.has(record.key) || pending.some((item) => item.key === record.key)) return;
      pending.push(record);
      pending.sort((left, right) => left.index - right.index);
    };
    const start = (slot, record) => {
      const task = Promise.resolve()
        .then(() => slot.model.worker(record.item, slot.laneIndex, record.index))
        .then(
          (value) => ({ slot, record, value, error: null }),
          (error) => ({ slot, record, value: null, error })
        );
      slot.promise = task;
      active.add(task);
    };
    const schedule = () => {
      for (const slot of slots) {
        if (slot.promise || slot.model.disabled || !pending.length) continue;
        const record = pending.shift();
        start(slot, record);
      }
    };

    while (outcomes.size < source.length) {
      schedule();
      if (!active.size) {
        const disabled = models.filter((model) => model.disabled).map((model) => model.id).join(", ");
        for (const record of pending.splice(0)) {
          outcomes.set(record.key, {
            ok: false,
            failureScope: "model",
            error: new Error(`all probe models are unavailable${disabled ? `: ${disabled}` : ""}`),
            item: record.item,
            index: record.index,
            modelId: ""
          });
        }
        break;
      }

      const completed = await Promise.race(active);
      active.delete(completed.slot.promise);
      completed.slot.promise = null;
      const model = completed.slot.model;
      const explicitScope = String(
        (completed.error && completed.error.failureScope)
        || (completed.value && completed.value.failureScope)
        || ""
      ).toLowerCase();
      const failureScope = explicitScope === "model"
        ? "model"
        : explicitScope === "node" || completed.error || (completed.value && completed.value.ok === false)
          ? "node"
          : "";

      if (failureScope === "model") {
        const wasDisabled = model.disabled;
        model.disabled = true;
        model.modelFailureCount += 1;
        model.error = toError(completed.error, completed.value, `${model.id} is unavailable`);
        requeue(completed.record);
        if (!wasDisabled && typeof settings.onModelDisabled === "function") {
          try { await settings.onModelDisabled({ modelId: model.id, error: model.error }); }
          catch { /* reporting must never interrupt failover */ }
        }
        continue;
      }

      if (outcomes.has(completed.record.key)) continue;
      if (failureScope === "node") {
        model.nodeFailureCount += 1;
        outcomes.set(completed.record.key, {
          ok: false,
          failureScope: "node",
          error: toError(completed.error, completed.value, "node probe failed"),
          value: completed.value,
          item: completed.record.item,
          index: completed.record.index,
          modelId: model.id
        });
      }
      else {
        model.completedCount += 1;
        outcomes.set(completed.record.key, {
          ok: true,
          value: completed.value,
          item: completed.record.item,
          index: completed.record.index,
          modelId: model.id
        });
      }
    }

    return { outcomes, modelStates };
  }

  async function runCodexProbeWithRetry(runAttempt, options) {
    if (typeof runAttempt !== "function") throw new Error("runAttempt must be a function");
    const maxAttempts = Math.max(1, Math.min(3, Math.trunc(numberValue(options && options.maxAttempts, 1))));
    const shouldRetry = options && typeof options.shouldRetry === "function"
      ? options.shouldRetry
      : shouldRetryCodexProbe;
    const onRetry = options && typeof options.onRetry === "function" ? options.onRetry : null;
    let result = null;
    let attempts = 0;
    while (attempts < maxAttempts) {
      attempts += 1;
      result = await runAttempt(attempts);
      if (attempts >= maxAttempts || !shouldRetry(result)) break;
      if (onRetry) await onRetry({ attempt: attempts, nextAttempt: attempts + 1, result });
    }
    return {
      ...(result || {}),
      attemptCount: Math.max(attempts, Number(result && result.attemptCount || 0))
    };
  }

  function firstValue() {
    for (let i = 0; i < arguments.length; i++) {
      const value = arguments[i];
      if (value !== undefined && value !== null && String(value) !== "") return value;
    }
    return undefined;
  }

  function boolValue(value) {
    return value === true || String(value).toLowerCase() === "true";
  }

  function buildTlsOptions(proxy, enabledByDefault) {
    const enabled = enabledByDefault || boolValue(proxy.tls);
    if (!enabled) return undefined;
    const tls = { enabled: true };
    const serverName = firstValue(proxy.sni, proxy.servername, proxy["server-name"], proxy.host);
    if (serverName) tls.server_name = String(serverName);
    if (proxy["skip-cert-verify"] !== undefined) tls.insecure = boolValue(proxy["skip-cert-verify"]);
    if (Array.isArray(proxy.alpn) && proxy.alpn.length) tls.alpn = proxy.alpn.map(String);
    const fingerprint = firstValue(proxy["client-fingerprint"], proxy.fingerprint);
    if (fingerprint) tls.utls = { enabled: true, fingerprint: String(fingerprint) };
    const reality = proxy["reality-opts"] || proxy.reality || {};
    const publicKey = firstValue(reality["public-key"], reality.publicKey, proxy["reality-public-key"]);
    const shortId = firstValue(reality["short-id"], reality.shortId, proxy["reality-short-id"]);
    if (publicKey) {
      tls.reality = {
        enabled: true,
        public_key: String(publicKey)
      };
      if (shortId !== undefined) tls.reality.short_id = String(shortId);
    }
    return tls;
  }

  function buildTransportOptions(proxy) {
    const network = String(proxy.network || "").toLowerCase();
    if (network === "ws" || network === "websocket") {
      const opts = proxy["ws-opts"] || {};
      const transport = { type: "ws" };
      if (opts.path || proxy.path) transport.path = String(opts.path || proxy.path);
      if (opts.headers && typeof opts.headers === "object") transport.headers = opts.headers;
      return transport;
    }
    if (network === "grpc") {
      const opts = proxy["grpc-opts"] || {};
      const serviceName = opts["grpc-service-name"] || opts.serviceName || proxy["grpc-service-name"];
      const transport = { type: "grpc" };
      if (serviceName) transport.service_name = String(serviceName);
      return transport;
    }
    return undefined;
  }

  function convertClashProxyToSingBoxOutbound(proxy) {
    if (!proxy || !proxy.name || !proxy.type || !proxy.server || !proxy.port) return null;
    const type = String(proxy.type).toLowerCase();
    const base = {
      tag: String(proxy.name),
      server: String(proxy.server),
      server_port: numberValue(proxy.port, 0)
    };
    let outbound = null;

    if (type === "trojan") {
      outbound = {
        type: "trojan",
        ...base,
        password: String(proxy.password || ""),
        tls: buildTlsOptions(proxy, true)
      };
    }
    else if (type === "ss" || type === "shadowsocks") {
      outbound = {
        type: "shadowsocks",
        ...base,
        method: String(proxy.cipher || proxy.method || ""),
        password: String(proxy.password || "")
      };
    }
    else if (type === "vmess") {
      outbound = {
        type: "vmess",
        ...base,
        uuid: String(proxy.uuid || ""),
        security: String(proxy.cipher || "auto"),
        alter_id: numberValue(proxy.alterId || proxy.alter_id, 0)
      };
      const tls = buildTlsOptions(proxy, false);
      if (tls) outbound.tls = tls;
    }
    else if (type === "vless") {
      outbound = {
        type: "vless",
        ...base,
        uuid: String(proxy.uuid || "")
      };
      if (proxy.flow) outbound.flow = String(proxy.flow);
      const tls = buildTlsOptions(proxy, false);
      if (tls) outbound.tls = tls;
    }
    else if (type === "anytls") {
      outbound = {
        type: "anytls",
        ...base,
        password: String(proxy.password || ""),
        tls: buildTlsOptions(proxy, true)
      };
    }
    else if (type === "hysteria2" || type === "hy2") {
      outbound = {
        type: "hysteria2",
        ...base,
        password: String(proxy.password || proxy["auth-str"] || "")
      };
      const tls = buildTlsOptions(proxy, true);
      if (tls) outbound.tls = tls;
    }
    else if (type === "tuic") {
      outbound = {
        type: "tuic",
        ...base,
        uuid: String(proxy.uuid || ""),
        password: String(proxy.password || "")
      };
      if (proxy["congestion-controller"]) outbound.congestion_control = String(proxy["congestion-controller"]);
      const tls = buildTlsOptions(proxy, true);
      if (tls) outbound.tls = tls;
    }

    if (!outbound) return null;
    const transport = buildTransportOptions(proxy);
    if (transport) outbound.transport = transport;
    return outbound;
  }

  function groupOutboundNames(group, availableTags) {
    if (!group || !group.name || !Array.isArray(group.proxies)) return null;
    return group.proxies
      .map((name) => singBoxOutboundName(name, ""))
      .filter((name) => availableTags.has(name));
  }

  function isDirectGroupName(name) {
    return /direct|直连/i.test(String(name || ""));
  }

  function isBlockGroupName(name) {
    return /reject|block|拦截|广告|屏蔽|阻止/i.test(String(name || ""));
  }

  function classifyProxyGroups(groups, availableTags) {
    const outboundsByTag = new Map();
    const directTags = new Set();
    const blockTags = new Set();

    (groups || []).forEach((group) => {
      if (!group || !group.name) return;
      const tag = String(group.name);
      const outbounds = groupOutboundNames(group, availableTags) || [];
      outboundsByTag.set(tag, outbounds);
      if (isBlockGroupName(tag) || (outbounds.length > 0 && outbounds.every((name) => name === "block"))) blockTags.add(tag);
      else if (isDirectGroupName(tag) || (outbounds.length > 0 && outbounds.every((name) => name === "direct"))) directTags.add(tag);
    });

    let changed = true;
    while (changed) {
      changed = false;
      for (const [tag, outbounds] of outboundsByTag.entries()) {
        const allBlock = outbounds.length > 0 && outbounds.every((name) => name === "block" || blockTags.has(name));
        const allDirect = outbounds.length > 0 && outbounds.every((name) => name === "direct" || directTags.has(name));
        if (allBlock && !blockTags.has(tag)) {
          blockTags.add(tag);
          changed = true;
        }
        else if (allDirect && !directTags.has(tag) && !blockTags.has(tag)) {
          directTags.add(tag);
          changed = true;
        }
      }
    }

    return { directTags, blockTags };
  }

  function convertClashProxyGroupToSingBoxOutbound(group, availableTags, policy) {
    if (!group || !group.name || !Array.isArray(group.proxies)) return null;
    const tag = String(group.name);
    const rawOutbounds = groupOutboundNames(group, availableTags) || [];
    const directTags = policy && policy.directTags || new Set();
    const blockTags = policy && policy.blockTags || new Set();
    let outbounds = rawOutbounds;
    if (blockTags.has(tag)) {
      outbounds = ["block"];
    }
    else if (directTags.has(tag)) {
      outbounds = ["direct"];
    }
    else {
      outbounds = rawOutbounds.filter((name) => {
        return name !== "direct" &&
          name !== "block" &&
          !directTags.has(name) &&
          !blockTags.has(name);
      });
      if (!outbounds.length) {
        outbounds = rawOutbounds.filter((name) => name !== "direct" && name !== "block");
      }
    }
    const uniqueOutbounds = outbounds.length ? Array.from(new Set(outbounds)) : ["direct"];
    return {
      type: "selector",
      tag,
      outbounds: uniqueOutbounds,
      default: uniqueOutbounds[0]
    };
  }

  function singBoxOutboundName(name, groupName) {
    const value = String(name || "").trim();
    if (/^DIRECT$/i.test(value)) return "direct";
    if (/^REJECT$/i.test(value)) return "block";
    if (!value || value === groupName) return groupName;
    return value;
  }

  function convertRuleToSingBox(rule, groupName) {
    const parts = ruleParts(rule);
    const type = String(parts[0] || "").toUpperCase();
    const value = parts[1];
    if (type === "MATCH") return { final: singBoxOutboundName(parts[1], groupName) };
    const outbound = singBoxOutboundName(parts[2], groupName);
    if (!type || !value) return null;

    const item = { outbound };
    if (type === "DOMAIN-SUFFIX") item.domain_suffix = [value];
    else if (type === "DOMAIN") item.domain = [value];
    else if (type === "DOMAIN-KEYWORD") item.domain_keyword = [value];
    else if (type === "DOMAIN-REGEX") item.domain_regex = [value];
    else if (type === "IP-CIDR" || type === "IP-CIDR6") item.ip_cidr = [value];
    else if (type === "PROCESS-NAME") item.process_name = [value];
    else if (type === "PROCESS-PATH") item.process_path = [value];
    else if (type === "PROCESS-NAME-REGEX" || type === "PROCESS-PATH-REGEX") item.process_path_regex = [value];
    else return null;
    return { rule: item };
  }

  function buildSingBoxRules(config, options) {
    const groupName = options.groupName || "SmartProxy";
    const forcedDomains = splitList(options.forcedDomains);
    const customRules = Array.isArray(options.customRules) ? options.customRules.map(normalizeRule).filter(Boolean) : [];
    const rules = [];
    const managedMatchers = [];

    forcedDomains.forEach((domain) => {
      managedMatchers.push(["DOMAIN-SUFFIX", domain]);
      rules.push({ domain_suffix: [domain], outbound: groupName });
    });

    const customPrepend = [];
    const customAppend = [];
    customRules.forEach((rule) => {
      if (rule.type === "DOMAIN-SUFFIX-SET") {
        const domains = splitList(rule.value);
        domains.forEach((domain) => managedMatchers.push(["DOMAIN-SUFFIX", domain]));
        const item = { domain_suffix: domains, outbound: singBoxOutboundName(outboundName(rule.outbound, groupName), groupName) };
        if (rule.position === "append") customAppend.push(item);
        else customPrepend.push(item);
        return;
      }
      managedMatchers.push([rule.type, rule.value]);
      const converted = convertRuleToSingBox(buildRule(rule, groupName), groupName);
      if (!converted || !converted.rule) return;
      if (rule.position === "append") customAppend.push(converted.rule);
      else customPrepend.push(converted.rule);
    });
    rules.push(...customPrepend, ...customAppend);

    if (options && options.customOnlyRoutes) {
      return { rules, final: "direct" };
    }

    let final = "direct";
    const originalRules = Array.isArray(config.rules)
      ? config.rules.filter((line) => {
          return !managedMatchers.some(([type, value]) => sameMatcher(line, type, value));
        })
      : [];
    originalRules.forEach((line) => {
      const converted = convertRuleToSingBox(line, groupName);
      if (!converted) return;
      if (converted.final) final = converted.final;
      if (converted.rule) rules.push(converted.rule);
    });

    return { rules, final };
  }

  function buildSingBoxConfig(config, options) {
    const source = cloneConfig(config);
    const groupName = options.groupName || "SmartProxy";
    const requestedNames = Array.isArray(options.nodeNames) ? options.nodeNames.filter(Boolean) : [];
    const proxyOutbounds = (source.proxies || [])
      .map(convertClashProxyToSingBoxOutbound)
      .filter(Boolean);
    const supported = new Set(proxyOutbounds.map((outbound) => outbound.tag));
    const sourceGroups = Array.isArray(source["proxy-groups"]) ? source["proxy-groups"] : [];
    const groupNames = new Set(sourceGroups.map((group) => group && group.name).filter(Boolean).map(String));
    const availableTags = new Set(["direct", "block", ...supported, ...groupNames]);
    const groupPolicy = classifyProxyGroups(sourceGroups, availableTags);
    const groupOutbounds = sourceGroups
      .filter((group) => group && group.name && String(group.name) !== groupName && !supported.has(String(group.name)))
      .map((group) => convertClashProxyGroupToSingBoxOutbound(group, availableTags, groupPolicy))
      .filter(Boolean);
    const groupTags = new Set(groupOutbounds.map((outbound) => outbound.tag));
    const selectorNodes = requestedNames.filter((name) => supported.has(name));
    const selectorOutbounds = selectorNodes.length ? selectorNodes : ["direct"];
    const requestedDefault = String(options.defaultNode || "");
    const selectorDefault = selectorOutbounds.includes(requestedDefault)
      ? requestedDefault
      : selectorOutbounds[0];
    const probeOptions = options && options.probeLanes && typeof options.probeLanes === "object"
      ? options.probeLanes
      : null;
    const probeInboundTagPrefix = String(probeOptions && probeOptions.inboundTagPrefix || "codex-probe-in");
    const probePortBase = Math.max(1, Math.trunc(nodeLeagueNumber(probeOptions && probeOptions.portBase, 40917)));
    const probeMaxLanes = Math.max(0, Math.min(512, Math.trunc(nodeLeagueNumber(probeOptions && probeOptions.maxLanes, 512))));
    // 每个受支持节点一条静态探测通道:inbound 端口固定映射到该节点出站。
    // 测速零 selector 切换,可任意并发。
    const probeNodeTags = probeOptions ? proxyOutbounds.map((outbound) => outbound.tag).slice(0, probeMaxLanes) : [];
    const probeInbounds = probeNodeTags.map((tag, index) => ({
      type: "mixed",
      tag: probeInboundTagPrefix + "-" + (index + 1),
      listen: "127.0.0.1",
      listen_port: probePortBase + index
    }));
    const probeSelectors = [];
    const probeRules = probeInbounds.map((inbound, index) => ({
      inbound: [inbound.tag],
      outbound: probeNodeTags[index]
    }));
    const route = options && options.globalProxy
      ? { rules: [], final: groupName }
      : buildSingBoxRules(source, options);
    // 节点服务器域名(排除纯 IP):这些必须用直连 DNS 解析,否则连不上节点
    const nodeServerDomains = [...new Set(
      proxyOutbounds
        .map((outbound) => String(outbound && outbound.server || "").trim())
        .filter((server) => server && !/^[\d.]+$/.test(server) && !server.includes(":"))
    )].sort();
    const outboundTags = new Set([groupName, "direct", "block", ...supported, ...groupTags]);
    const normalizeRouteOutbound = (outbound) => {
      if (outbound === "direct" || groupPolicy.directTags.has(outbound)) return "direct";
      if (outbound === "block" || groupPolicy.blockTags.has(outbound)) return "block";
      return groupName;
    };
    const sanitizedRules = route.rules.map((rule) => {
      if (!rule) return rule;
      if (!outboundTags.has(rule.outbound)) return { ...rule, outbound: groupName };
      return { ...rule, outbound: normalizeRouteOutbound(rule.outbound) };
    });
    const sanitizedFinal = outboundTags.has(route.final) ? normalizeRouteOutbound(route.final) : groupName;

    return {
      log: {
        level: options.logLevel || "info"
      },
      inbounds: [
        {
          type: "mixed",
          tag: "mixed-in",
          listen: "127.0.0.1",
          listen_port: numberValue(options.port, 7899)
        },
        ...probeInbounds
      ],
      outbounds: [
        {
          type: "selector",
          tag: groupName,
          outbounds: selectorOutbounds,
          default: selectorDefault
        },
        ...probeSelectors,
        ...groupOutbounds,
        ...proxyOutbounds,
        {
          type: "direct",
          tag: "direct"
        },
        {
          type: "block",
          tag: "block"
        }
      ],
      // DNS 是节点稳定性的关键:不用系统/路由器 DNS(实测会间歇性解析失败,
      // 导致同域名下整批节点一起掉线)。
      // - 节点服务器域名走 dns-local(阿里 223.5.5.5,直连,国内解析快且稳)
      // - 其余(含 claude.ai / api.anthropic.com)走 dns-remote:
      //   Cloudflare 官方 DoH 1.1.1.1,且经代理出口查询,
      //   这样拿到的 Cloudflare 边缘 IP 与节点出口在同一区域,Claude 链路最短。
      //   DoH 同时避免了 UDP 53 被投毒。
      dns: {
        // 全部走直连公共 DNS(阿里 223.5.5.5,anycast 多机房冗余)。
        // 【硬性设计约束,勿改】绝不让 DNS 依赖代理出口:
        // 实测教训——把解析放在代理后面(DoH via 节点)时,一旦节点抖动,
        // 解析失败会进 sing-box 负缓存,之后换任何节点/模式都恢复不了,
        // 只能重启内核。DNS 必须是不依赖代理的独立可用组件。
        // dns-local 不写 detour:sing-box 对 direct 出站的 detour 会拒绝启动。
        // dns-boot 只用于解析 DoH 域名自身;dns-local 是主力:
        // 阿里 DoH(加密直连),既抗 GFW 的 UDP 53 投毒,
        // 也不会被本机其他 TUN 代理劫持成 fake-IP(实测明文 53 会被劫持成 198.18.x)。
        servers: [
          { type: "udp", tag: "dns-boot", server: "223.5.5.5" },
          { type: "https", tag: "dns-local", server: "dns.alidns.com", domain_resolver: "dns-boot" }
        ],
        rules: nodeServerDomains.length
          ? [{ domain_suffix: nodeServerDomains, server: "dns-local" }]
          : [],
        final: "dns-local",
        strategy: "prefer_ipv4",
        independent_cache: true
      },
      route: {
        auto_detect_interface: true,
        default_domain_resolver: { server: "dns-boot" },
        rules: [...probeRules, ...sanitizedRules],
        final: sanitizedFinal || "direct"
      },
      experimental: {
        clash_api: {
          external_controller: `127.0.0.1:${numberValue(options.controllerPort, 19099)}`,
          secret: String(options.secret || "")
        }
      }
    };
  }

  const api = {
    applySmartProxyOverrides,
    buildCorePortCleanupScript,
    buildCoreProcessCleanupScript,
    buildSubscriptionCurlArgs,
    buildWindowsNetworkOptimizeScript,
    buildWindowsNetworkStatusScript,
    buildWindowsNetworkRevertScript,
    buildRule,
    buildSingBoxConfig,
    awardNodeLeagueRound,
    chooseSubscriptionUrl,
    codexProbeMetrics,
    coreNeedsInstall,
    coreFallbackInstallPath,
    coreRepairAction,
    coreUpdateStatus,
    convertClashProxyToSingBoxOutbound,
    decodePortableTextBytes,
    ensureOpenAiCustomRule,
    extractLegacyNodeLeagueScores,
    findRestorableNode,
    mergeCodexProbeResult,
    mergeSettingsWithDefaultMigration,
    mergeSubscriptionConfigs,
    migrateSettingsForAppVersion,
    openAiDomains,
    normalizeCoreVersion,
    normalizeSubscriptions,
    nodeDisplayMeta,
    normalizeCodexProbeStore,
    normalizeNodeLeagueStore,
    openAiCustomRule,
    parseSubscriptionTraffic,
    proxyIdentity,
    protectedProxyRules,
    rankCodexProbeEntries,
    rankCurrentCodexProbeEntries,
    resolveConfiguredPath,
    resolvePortableCorePath,
    resolvePortableDataRoot,
    resolveFinalNode,
    rankNodeLeagueEntries,
    recordNodeLeagueResult,
    runCodexProbeWithRetry,
    runCodexProbeModelPool,
    shouldRetryCodexProbe,
    shouldUseCachedSubscription,
    sourceMode,
    subscriptionCacheFileNames,
    subscriptionConfigHasNodes,
    touchNodeLeagueCatalog,
    splitList,
    toPortableStoredPath,
    uniqueCodexProbeItems
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SmartProxyConfig = api;
})(typeof window !== "undefined" ? window : globalThis);
