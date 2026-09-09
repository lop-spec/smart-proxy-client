"use strict";

// One fixed account/model per round. Credentials stay in memory and curl stdin.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");
const child_process = require("node:child_process");
const readline = require("node:readline");
const { performance } = require("node:perf_hooks");
const helpers = require("../js/config-helpers.js");

const CODEX_MODEL = "gpt-5.3-codex-spark";
const TOKENMIX_MODEL = "gpt-4o-mini";
const CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses";
const TOKENMIX_URL = "https://api.tokenmix.ai/v1/chat/completions";
const DEFAULT_TIMEOUT_SECONDS = 30;
const MAX_GLOBAL_CONCURRENCY = 4;
const MAX_CAPTURE_BYTES = 256 * 1024;
const CODEX_AUTH_CACHE = new Map();
const PROMPT = "Immediately write one short English paragraph about internet connection speed. Aim for roughly 80 words; exact length does not matter. Start with the word Speed.";
const INSTRUCTIONS = "Return plain text only. Do not use tools, count words, verify a length, reason, or explain.";
const TIMING_SOURCE = "request-end-to-end-usage-v2";

function numberValue(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function clampInteger(value, fallback, min, max) { return Math.max(min, Math.min(max, Math.trunc(numberValue(value, fallback)))); }
function effectiveTokPerSec(tokens, ms) { return tokens > 0 && ms > 0 ? Math.round(tokens * 10000 / ms) / 10 : 0; }
function concurrencyForRound(count, limits = {}) {
  const maximum = clampInteger(limits.global ?? limits.concurrency, MAX_GLOBAL_CONCURRENCY, 1, MAX_GLOBAL_CONCURRENCY);
  return { global: Math.min(Math.max(0, count), maximum), maxActiveTotal: Math.min(Math.max(0, count), maximum), routeCount: count ? 1 : 0 };
}
function discoverCodexHomes(explicitRoot = "") {
  const root = path.resolve(explicitRoot || process.env.SMART_PROXY_CODEX_HOMES || path.join(process.env.USERPROFILE || os.homedir(), "Documents", "claude", "vscodium", "homes"));
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); }
  catch { return []; }
  return entries.filter(entry => {
    if (!entry.isDirectory()) return false;
    try { return fs.statSync(path.join(root, entry.name, "auth.json")).isFile(); }
    catch { return false; }
  }).map(entry => ({ id: entry.name, home: path.join(root, entry.name) }))
    .sort((a, b) => a.id === "primary" ? -1 : b.id === "primary" ? 1 : a.id.localeCompare(b.id)).slice(0, 16);
}
function accessTokenExpiresSoon(token) {
  try { return Number(JSON.parse(Buffer.from(token.split(".")[1], "base64url")).exp) * 1000 <= Date.now() + 120000; }
  catch { return false; }
}
function refreshCodexAccount(home, explicitPath) {
  const candidates = [explicitPath, process.env.SMART_PROXY_CODEX_PATH,
    process.env.APPDATA && path.join(process.env.APPDATA, "npm", "node_modules", "@openai", "codex", "bin", "codex.js")].filter(Boolean);
  const target = candidates.find(file => { try { return fs.statSync(file).isFile(); } catch { return false; } });
  if (!target) return Promise.reject(new Error("Codex token expired and Codex CLI is unavailable"));
  return new Promise((resolve, reject) => {
    const js = /\.m?js$/i.test(target);
    const child = child_process.spawn(js ? process.execPath : target, [...(js ? [target] : []), "app-server", "--listen", "stdio://"],
      { windowsHide: true, env: { ...process.env, CODEX_HOME: home }, stdio: ["pipe", "pipe", "pipe"] });
    let finished = false;
    const lines = readline.createInterface({ input: child.stdout });
    const finish = error => {
      if (finished) return;
      finished = true; clearTimeout(timer); lines.close(); child.kill();
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => finish(new Error("Codex account refresh timed out")), 6000);
    const send = value => child.stdin.write(JSON.stringify(value) + "\n");
    child.stdin.on("error", () => {});
    child.stderr.resume();
    child.on("error", finish);
    child.on("exit", code => { if (!finished) finish(new Error("Codex account refresh exited: " + code)); });
    lines.on("line", line => {
      let value; try { value = JSON.parse(line); } catch { return; }
      if (value.error) { finish(new Error("Codex account refresh rejected")); return; }
      if (value.id === 1) { send({ method: "initialized", params: {} }); send({ id: 2, method: "account/read", params: { refreshToken: true } }); }
      if (value.id === 2) finish();
    });
    send({ id: 1, method: "initialize", params: { clientInfo: { name: "smart_proxy_auth_refresh", title: "Smart Proxy", version: "2" } } });
  });
}
function codexAccountAuth(home, options = {}) {
  const key = path.resolve(String(home || ""));
  if (!CODEX_AUTH_CACHE.has(key)) CODEX_AUTH_CACHE.set(key, (async () => {
    const file = path.join(key, "auth.json");
    let auth = JSON.parse(await fs.promises.readFile(file, "utf8"));
    if (accessTokenExpiresSoon(String(auth.tokens?.access_token || "")) && auth.tokens?.refresh_token) {
      await refreshCodexAccount(key, options.codexPath);
      auth = JSON.parse(await fs.promises.readFile(file, "utf8"));
    }
    const accessToken = String(auth.tokens?.access_token || ""), accountId = String(auth.tokens?.account_id || "");
    if (!accessToken || !accountId || accessTokenExpiresSoon(accessToken)) throw new Error("Codex account authentication is unavailable or expired");
    return { accessToken, accountId };
  })());
  return CODEX_AUTH_CACHE.get(key);
}
function probeFailure(scope, error, extra = {}) {
  return { ...extra, ok: false, failureScope: ["node", "model", "local", "round", "cancelled", "measurement"].includes(scope) ? scope : "round", error: String(error?.message || error || "Probe failed").slice(0, 400) };
}
function codexChannelFailure(http, detail) {
  return [401, 402, 429].includes(http) || http >= 500
    || /model.*(?:not found|unavailable|unsupported)|unsupported (?:parameter|value)|auth(?:entication)?|unauthorized|subscription|quota|rate.?limit|usage.?limit/i.test(String(detail || ""));
}
function modelMatches(actual, requested) { return actual === requested || (actual.startsWith(requested + "-") && /^\d{4}-\d{2}-\d{2}$/.test(actual.slice(requested.length + 1))); }
function createStreamParser(profile, clock = () => performance.now()) {
  let firstAt = null, lastAt = null, count = 0, chars = 0, model = "", usage = null, completed = false, finishReason = "", error = "";
  return {
    consume(line) {
      if (!line.trim().startsWith("data:")) return;
      const data = line.trim().slice(5).trim();
      if (data === "[DONE]") { if (profile === "tokenmix") completed = true; return; }
      let value; try { value = JSON.parse(data); } catch { return; }
      if (value.error || value.response?.error) error = String((value.error || value.response.error).message || "SSE error");
      const response = profile === "codex" ? value.response : value;
      if (response?.model) {
        if (model && model !== response.model) error = "Model changed inside one stream";
        model = String(response.model);
      }
      if (response?.usage) usage = response.usage;
      if (profile === "codex" && value.type === "response.completed") {
        completed = value.response?.status === "completed";
        if (!completed) error = "Codex response not completed";
      }
      if (/response\.(failed|incomplete)/.test(value.type || "")) error ||= "Incomplete Codex response";
      const choice = value.choices?.[0];
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      const delta = profile === "codex" ? (/output_text\.delta$/.test(value.type || "") ? value.delta : "") : choice?.delta?.content;
      if (typeof delta === "string" && delta.length) {
        const now = clock(); if (firstAt === null) firstAt = now; lastAt = now;
        count++; chars += Array.from(delta).length;
      }
    },
    result() {
      const output = Number(usage?.output_tokens ?? usage?.completion_tokens ?? 0);
      const reasoning = Number(usage?.output_tokens_details?.reasoning_tokens ?? usage?.completion_tokens_details?.reasoning_tokens ?? 0);
      return { firstAt, lastAt, deltaCount: count, characters: chars, resolvedModel: model, completed: completed && (profile === "codex" || ["stop", "length"].includes(finishReason)), error,
        tokens: Math.max(0, output - reasoning), tokenCountSource: usage ? "api-usage" : "missing-usage", finishReason };
    }
  };
}
function parseTokenMixStream(text) {
  const parser = createStreamParser("tokenmix");
  String(text).split(/\r?\n/).forEach(line => parser.consume(line));
  const result = parser.result(); return { ...result, apiError: result.error };
}
function codexRequestBody(model) {
  return JSON.stringify({ model, instructions: INSTRUCTIONS, input: [{ role: "user", content: [{ type: "input_text", text: PROMPT }] }],
    tools: [], tool_choice: "auto", parallel_tool_calls: false, reasoning: { effort: "low" }, store: false, stream: true });
}
async function laneReady(port, signal) {
  if (signal?.aborted) return false;
  return new Promise(resolve => {
    const socket = net.connect({ host: "127.0.0.1", port });
    let settled = false;
    const finish = ok => { if (settled) return; settled = true; signal?.removeEventListener("abort", abort); socket.destroy(); resolve(ok); };
    const abort = () => finish(false);
    signal?.addEventListener("abort", abort, { once: true });
    socket.setTimeout(1000, () => finish(false)); socket.once("connect", () => finish(true)); socket.once("error", () => finish(false));
  });
}
async function runStreamProbe(port, options) {
  const signal = options.signal;
  if (signal?.aborted) return probeFailure("cancelled", "测速已停止");
  if (!await (options.laneReady || laneReady)(port, signal)) return probeFailure(signal?.aborted ? "cancelled" : "local", "本机探测端口未就绪；不代表节点不可达");
  const profile = options.profile || "codex";
  const requestedModel = options.model || (profile === "codex" ? CODEX_MODEL : TOKENMIX_MODEL);
  let auth;
  try { auth = options.auth || (profile === "codex" ? await codexAccountAuth(options.codexHome, options) : { accessToken: await tokenMixKey(options.tokenMixKeyFile) }); }
  catch (error) { return probeFailure("model", error); }
  if (signal?.aborted) return probeFailure("cancelled", "测速已停止");
  const safe = value => [auth.accessToken, auth.accountId].filter(Boolean).reduce((text, secret) => text.replaceAll(secret, "[redacted]"), String(value)).slice(0, 400);
  const timeoutSeconds = clampInteger(options.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS, 5, 120);
  const body = profile === "codex" ? codexRequestBody(requestedModel) : JSON.stringify({ model: requestedModel, stream: true,
    stream_options: { include_usage: true }, max_tokens: 256, messages: [{ role: "system", content: INSTRUCTIONS }, { role: "user", content: PROMPT }] });
  return new Promise(resolve => {
    const startedAt = performance.now();
    const parser = createStreamParser(profile);
    let child, stdout = "", stderr = "", buffer = "", terminal = null, settled = false;
    const finish = value => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", abort);
      resolve({ ...value, totalMs: Math.max(1, Math.round(performance.now() - startedAt)) });
    };
    const stop = (scope, reason) => { terminal = probeFailure(scope, reason); if (child) child.kill(); };
    const abort = () => stop("cancelled", "测速已停止");
    const timer = setTimeout(() => stop("node", "请求独立超时 " + timeoutSeconds + "s"), timeoutSeconds * 1000 + 1000);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      child = (options.spawn || child_process.spawn)("curl.exe", ["-sS", "--no-buffer", "--http1.1", "--request", "POST", "--config", "-", "--data-raw", body,
        "--write-out", "\nT %{http_code} %{time_starttransfer} %{time_total}\n", profile === "codex" ? CODEX_RESPONSES_URL : TOKENMIX_URL],
        { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    }
    catch (error) { finish(probeFailure("local", safe(error.message))); return; }
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      stdout = (stdout + chunk).slice(-MAX_CAPTURE_BYTES); buffer += chunk;
      if (buffer.length > MAX_CAPTURE_BYTES) { stop("measurement", "SSE line exceeds capture limit"); return; }
      let index; while ((index = buffer.indexOf("\n")) >= 0) { parser.consume(buffer.slice(0, index)); buffer = buffer.slice(index + 1); }
    });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-4096); });
    child.on("error", error => finish(probeFailure("local", safe(error.message))));
    child.on("close", code => {
      if (terminal) { finish(terminal); return; }
      if (buffer) parser.consume(buffer);
      const stat = stdout.match(/^T\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s*$/m);
      const http = Number(stat?.[1] || 0), headerMs = Math.round(Number(stat?.[2] || 0) * 1000);
      const parsed = parser.result();
      let detail = parsed.error || stderr.trim().split(/\r?\n/)[0] || "HTTP " + http;
      if (http !== 200) {
        try { const json = JSON.parse(stdout.replace(/\nT\s+[\s\S]*$/, "")); detail = json.error?.message || detail; } catch { /* Non-JSON errors retain HTTP/curl evidence. */ }
      }
      if (code !== 0 || !http) { finish(probeFailure("node", safe(detail || "curl exit " + code), { http, exitCode: code, transient: true })); return; }
      if (http !== 200 || parsed.error) { finish(probeFailure(codexChannelFailure(http, detail) ? "model" : "node", safe(detail), { http })); return; }
      if (!parsed.completed || parsed.characters < 40 || parsed.firstAt === null) { finish(probeFailure("measurement", "SSE incomplete or no usable text", { http })); return; }
      if (!modelMatches(parsed.resolvedModel, requestedModel)) { finish(probeFailure("model", "Requested " + requestedModel + "; received " + parsed.resolvedModel, { http })); return; }
      if (!(parsed.tokens > 0)) { finish(probeFailure("measurement", "完整响应缺少实际 usage；不估算 token 数、不参与排名", { http, reachable: true })); return; }
      const elapsedMs = Math.max(1, Math.round(parsed.lastAt - startedAt));
      const deliveryStreamMs = Math.max(0, Math.round(parsed.lastAt - parsed.firstAt));
      finish({ ok: true, http, reachable: true, requestedModel, resolvedModel: parsed.resolvedModel, resolvedModelVerified: true,
        modelVerificationSource: profile === "codex" ? "chatgpt-responses-sse-model" : "tokenmix-sse-model",
        tokPerSec: effectiveTokPerSec(parsed.tokens, elapsedMs), tokEst: parsed.tokens, tokenCountSource: "api-usage",
        ttftMs: Math.max(1, Math.round(parsed.firstAt - startedAt)), headerMs, elapsedMs, streamMs: elapsedMs, deliveryStreamMs,
        deltaCount: parsed.deltaCount, streamBuffered: parsed.deltaCount < 4 || deliveryStreamMs < 500, timingSource: TIMING_SOURCE,
        probeModelId: options.modelId || profile });
    });
    child.stdin.on("error", error => { if (!settled) stop("local", safe(error.message)); });
    child.stdin.end(['proxy = "http://127.0.0.1:' + port + '"', 'noproxy = ""',
      'header = "Authorization: Bearer ' + auth.accessToken + '"',
      ...(profile === "codex" ? ['header = "chatgpt-account-id: ' + auth.accountId + '"', 'header = "originator: codex_cli_rs"',
        'header = "User-Agent: codex_cli_rs/0.147.0"', 'header = "OpenAI-Beta: responses=experimental"',
        'header = "session_id: ' + crypto.randomUUID() + '"', 'header = "x-client-request-id: ' + crypto.randomUUID() + '"'] : []),
      'header = "content-type: application/json"', 'header = "accept: text/event-stream"', 'header = "Expect:"', "max-time = " + timeoutSeconds, "connect-timeout = " + Math.min(10, timeoutSeconds)].join("\n") + "\n");
    if (signal?.aborted) abort();
  });
}
function runCodexProbe(port, options) { return runStreamProbe(port, { ...options, profile: "codex", model: options.codexModel || CODEX_MODEL }); }
async function tokenMixKey(file) {
  const text = await fs.promises.readFile(file, "utf8");
  const key = text.split(/\r?\n/).find(line => line.trim().startsWith("sk-tm-"));
  if (!key) throw new Error("TokenMix credential is unavailable");
  return key.trim();
}
function median(values) { const a = [...values].sort((a, b) => a - b); const i = Math.floor(a.length / 2); return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2; }
function aggregateSamples(samples, profileKey, roundId) {
  const good = samples.filter(sample => sample.ok === true);
  if (!good.length) return { ...(samples.at(-1) || probeFailure("round", "未测量")), sampleCount: samples.length, successfulSamples: 0, profileKey, roundId };
  const models = new Set(good.map(sample => sample.resolvedModel));
  if (models.size !== 1) return probeFailure("model", "同轮解析模型发生变化，成绩不可比较");
  const rate = median(good.map(s => s.tokPerSec));
  const representative = [...good].sort((a, b) => Math.abs(a.tokPerSec - rate) - Math.abs(b.tokPerSec - rate))[0];
  return { ...representative, tokPerSec: Math.round(rate * 10) / 10,
    ttftMedianMs: Math.round(median(good.map(s => s.ttftMs))), metricAggregate: "median-tok-per-sec",
    profileKey, roundId, sampleCount: samples.length, successfulSamples: good.length, successRate: good.length / samples.length,
    tokMin: Math.min(...good.map(s => s.tokPerSec)), tokMax: Math.max(...good.map(s => s.tokPerSec)),
    verified: samples.length >= 3 && samples.length === good.length,
    samples: samples.map(s => ({ ok: s.ok, tokPerSec: s.tokPerSec || 0, tokEst: s.tokEst || 0,
      elapsedMs: s.elapsedMs || 0, ttftMs: s.ttftMs || 0, deliveryStreamMs: s.deliveryStreamMs || 0,
      tokenCountSource: s.tokenCountSource || "", error: s.error || "", failureScope: s.failureScope || "" })) };
}
async function runRound(options) {
  const ports = [...new Set((options.ports || []).map(Number).filter(port => Number.isInteger(port) && port > 0 && port < 65536))];
  const startedAt = performance.now(), roundId = crypto.randomUUID();
  const controller = new AbortController();
  const cancel = () => controller.abort(); options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const signal = controller.signal;
  const plan = concurrencyForRound(ports.length, { global: options.concurrency });
  const emit = event => { if (typeof options.onEvent === "function") options.onEvent(event); };
  const warnings = [], outcomes = new Map(), samples = new Map();
  let active = 0, maxActiveTotal = 0, completed = 0, total = ports.length, channelError = null, resolvedModel = "";
  const profile = options.profile === "tokenmix" ? "tokenmix" : "codex";
  const account = profile === "codex" ? (options.codexHomes || discoverCodexHomes(options.codexHomesRoot))[0] : null;
  const model = profile === "codex" ? (options.codexModel || CODEX_MODEL) : (options.tokenMixModel || TOKENMIX_MODEL);
  const modelId = profile === "codex" ? "codex-" + (account?.id || "unavailable") : "tokenmix";
  const profileKey = crypto.createHash("sha256").update(JSON.stringify([TIMING_SOURCE, model, modelId, account?.home || "tokenmix", PROMPT])).digest("hex").slice(0, 20);
  const worker = options.worker || runStreamProbe;
  const note = text => { warnings.push(text); emit({ type: "log", message: text }); };
  let auth;
  try {
    if (!options.worker && !signal.aborted) {
      if (profile === "codex") {
        if (!account) throw new Error("未发现 Codex 账户；请选择其他测速模型，不会静默换模型");
        auth = await codexAccountAuth(account.home, options);
      } else auth = { accessToken: await tokenMixKey(options.tokenMixKeyFile) };
    }
  } catch (error) { channelError = probeFailure("model", error); note("Fixed benchmark channel unavailable: " + channelError.error); }
  const invoke = async port => {
    if (signal.aborted) return probeFailure("cancelled", "测速已停止");
    if (channelError) return channelError;
    active++; maxActiveTotal = Math.max(maxActiveTotal, active);
    try {
      const result = await worker(port, { profile, model, modelId, auth, codexHome: account?.home, tokenMixKeyFile: options.tokenMixKeyFile,
        timeoutSeconds: clampInteger(options.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS, 5, 120), signal });
      if (result.ok) {
        if (resolvedModel && resolvedModel !== result.resolvedModel) channelError = probeFailure("model", "同轮解析模型改变，停止比较");
        resolvedModel ||= result.resolvedModel;
      }
      if (result.failureScope === "model" || result.failureScope === "local") channelError = result;
      return channelError || result;
    } catch (error) { channelError = probeFailure("local", error); return channelError; }
    finally { active--; }
  };
  const measure = async (port, phase, reset = false) => {
    const result = await invoke(port);
    const list = reset ? [] : (samples.get(port) || []); list.push(result); samples.set(port, list);
    const value = aggregateSamples(list, profileKey, roundId); outcomes.set(port, value);
    completed++; emit({ type: "progress", port, value, completed, phase, total });
    return result;
  };
  const pool = async (items, limit, fn) => {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(items.length, limit) }, async () => {
      while (next < items.length && !signal.aborted && !channelError) { const item = items[next++]; await fn(item); }
    }));
  };
  try {
    emit({ type: "start", roundId, profileKey, modelId, model, plan, total: ports.length });
    await pool(ports, plan.global, port => measure(port, "screen"));
    const failed = ports.filter(port => outcomes.get(port)?.failureScope === "node");
    if (!signal.aborted && !channelError && failed.length >= Math.max(3, Math.ceil(ports.length * 0.8))) {
      note("Mass transport failure; serial control recheck, node failures are not authoritative yet");
      const controls = failed.slice(0, 3); total += controls.length; let recovered = 0;
      for (const port of controls) { if (signal.aborted || channelError) break; const value = await measure(port, "control"); if (value.ok) recovered++; }
      if (!recovered && !signal.aborted) {
        for (const port of failed) outcomes.set(port, probeFailure("round", "大面积失败且低并发对照未恢复；本轮环境/服务异常，不能判定全部节点失效", { profileKey, roundId }));
        note("Control recheck did not recover; retaining prior successes, no all-nodes-dead verdict");
      } else if (!signal.aborted && !channelError) {
        note("Serial control recovered; rechecking remaining failed routes with concurrency=1");
        const remaining = failed.filter(port => !controls.includes(port)); total += remaining.length;
        await pool(remaining, 1, port => measure(port, "control"));
      }
    }
    const candidates = [...outcomes].filter(([, value]) => value.ok).sort((a, b) => b[1].tokPerSec - a[1].tokPerSec).slice(0, 3).map(([port]) => port);
    total += candidates.length * 2;
    // One global budget also governs finalist requests; never compare different models/accounts.
    for (let round = 0; round < 2 && !signal.aborted && !channelError; round++) {
      await pool(candidates, Math.min(plan.global, 3), port => measure(port, "final"));
    }
    if (channelError) note("Round stopped for " + channelError.failureScope + " failure: " + channelError.error);
    for (const port of ports) {
      if (signal.aborted) outcomes.set(port, probeFailure("cancelled", "测速已停止；本轮不定冠军", { profileKey, roundId }));
      else if (!outcomes.has(port)) outcomes.set(port, channelError || probeFailure("round", "未测量", { profileKey, roundId }));
    }
    return { ok: true, roundId, profileKey, profile, modelId, requestedModel: model, cancelled: signal.aborted, channelFailure: channelError,
      elapsedMs: Math.max(1, Math.round(performance.now() - startedAt)), plan, activity: { maxActiveTotal }, warnings,
      outcomes: ports.map(port => ({ port, ok: outcomes.get(port).ok, failureScope: outcomes.get(port).failureScope || "", value: outcomes.get(port) })) };
  } finally { options.signal?.removeEventListener("abort", cancel); }
}
function parseCliArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) values[argv[i].slice(2)] = argv[++i];
  return { ports: String(values.ports || "").split(",").map(Number), profile: values.profile, tokenMixKeyFile: values["tokenmix-key-file"],
    codexHomesRoot: values["codex-homes-root"], timeoutSeconds: values["timeout-seconds"], concurrency: values.concurrency,
    codexModel: values["codex-model"], tokenMixModel: values["tokenmix-model"], resultFile: values["result-file"] };
}
async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (!options.ports.some(port => port > 0)) throw new Error("At least one probe port is required");
  const controller = new AbortController();
  const input = readline.createInterface({ input: process.stdin });
  input.on("line", line => { try { if (JSON.parse(line).action === "cancel") controller.abort(); } catch { process.stderr.write("Ignored invalid probe control message\n"); } });
  input.on("close", () => controller.abort());
  process.on("SIGTERM", () => controller.abort()); process.on("SIGINT", () => controller.abort());
  const emit = event => process.stdout.write(JSON.stringify(event) + "\n");
  const result = await runRound({ ...options, signal: controller.signal, onEvent: emit });
  if (options.resultFile) {
    const target = path.resolve(options.resultFile), temporary = target + ".tmp-" + process.pid;
    await fs.promises.writeFile(temporary, JSON.stringify(result), "utf8"); await fs.promises.rename(temporary, target);
  }
  emit({ type: "result", ...result }); input.removeAllListeners("close"); input.close(); process.stdin.pause();
}
if (require.main === module) main().catch(error => { process.stdout.write(JSON.stringify({ type: "result", ok: false, error: String(error.message || error).slice(0, 400) }) + "\n", () => process.exit(1)); });
module.exports = { codexAccountAuth, concurrencyForRound, codexChannelFailure, discoverCodexHomes, effectiveTokPerSec, parseTokenMixStream,
  createStreamParser, runStreamProbe, runCodexProbe, runRound, aggregateSamples, TIMING_SOURCE };
