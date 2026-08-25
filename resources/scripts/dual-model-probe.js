"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const child_process = require("node:child_process");
const helpers = require("../js/config-helpers.js");

const CODEX_MODEL = "gpt-5.3-codex-spark";
const TOKENMIX_MODEL = "gpt-4o-mini";
const TOKENMIX_URL = "https://api.tokenmix.ai/v1/chat/completions";
const CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses";
const TOKENMIX_MAX_TOKENS = 128;
const TOKENMIX_MIN_STREAM_MS = 300;
const CODEX_MIN_STREAM_MS = 50;
const CODEX_BUFFERED_STREAM_MS = 500;
const EFFECTIVE_RATE_TIMING_SOURCE = "request-end-to-end-tok";
const DEFAULT_TIMEOUT_SECONDS = 20;
const DEFAULT_ROUND_DEADLINE_MS = 8000;
// Auto mode uses the highest stable windows verified on this machine. Every route
// keeps pulling from the same queue, so a survivor takes over unfinished nodes
// without resetting the round or re-testing node-specific failures.
const DEFAULT_CODEX_CONCURRENCY = 50;
const DEFAULT_TOKENMIX_CONCURRENCY = 20;
const DEFAULT_TOKENMIX_PROCESS_CONCURRENCY = 20;
const MAX_CONCURRENCY_PER_MODEL = 512;
const MAX_CODEX_ACCOUNTS = 16;
const MAX_CAPTURE_BYTES = 256 * 1024;
const CODEX_AUTH_REFRESH_SKEW_MS = 2 * 60 * 1000;
const CODEX_AUTH_REFRESH_TIMEOUT_MS = 6000;
const CODEX_AUTH_CACHE = new Map();

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampInteger(value, fallback, min, max) {
  return Math.min(max, Math.max(min, Math.trunc(numberValue(value, fallback))));
}

// A short SSE completion can be buffered and delivered in one burst. Dividing by
// only the first-to-last delta window turns that transport burst into a fake
// 1000+ tok/s result. Effective tok/s intentionally covers request start through
// the last token so every route measures the same user-visible interval.
function effectiveTokPerSec(tokenCount, elapsedMs) {
  const tokens = Number(tokenCount);
  const milliseconds = Number(elapsedMs);
  if (!Number.isFinite(tokens) || tokens <= 0 || !Number.isFinite(milliseconds) || milliseconds <= 0) return 0;
  return Math.round((tokens / (milliseconds / 1000)) * 10) / 10;
}

function optionalConcurrency(value, fallback = 0) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text || text === "auto" || text === "0") return Math.max(0, Math.trunc(numberValue(fallback, 0)));
  return clampInteger(value, fallback || 1, 1, MAX_CONCURRENCY_PER_MODEL);
}

function concurrencyForRound(itemCount, limits = {}) {
  const count = Math.max(0, Math.trunc(numberValue(itemCount, 0)));
  const settings = limits && typeof limits === "object" ? limits : { codex: limits, tokenMix: limits };
  const codexAccounts = Math.min(
    MAX_CODEX_ACCOUNTS,
    Math.max(0, Math.trunc(numberValue(settings.codexAccountCount, 1)))
  );
  if (!count) {
    return {
      codexAccounts,
      routeCount: codexAccounts + 1,
      codex: 0,
      tokenMix: 0,
      tokenMixProcesses: 0,
      maxActiveTotal: 0
    };
  }
  const requestedCodex = optionalConcurrency(settings.codex, DEFAULT_CODEX_CONCURRENCY);
  const requestedTokenMix = optionalConcurrency(settings.tokenMix, DEFAULT_TOKENMIX_CONCURRENCY);
  const requestedTokenMixProcesses = optionalConcurrency(
    settings.tokenMixProcesses,
    DEFAULT_TOKENMIX_PROCESS_CONCURRENCY
  );
  const codex = codexAccounts ? Math.min(count, requestedCodex || count) : 0;
  const tokenMixProcesses = Math.min(count, requestedTokenMixProcesses || DEFAULT_TOKENMIX_PROCESS_CONCURRENCY);
  const tokenMix = Math.min(count, requestedTokenMix || tokenMixProcesses);
  return {
    codexAccounts,
    routeCount: codexAccounts + 1,
    codex,
    tokenMix,
    tokenMixProcesses,
    maxActiveTotal: Math.min(count, codex * codexAccounts + tokenMixProcesses)
  };
}

function defaultCodexHomesRoot() {
  const userProfile = process.env.USERPROFILE || os.homedir();
  return process.env.SMART_PROXY_CODEX_HOMES
    || path.join(userProfile, "Documents", "claude", "vscodium", "homes");
}

function discoverCodexHomes(explicitRoot = "") {
  const root = path.resolve(String(explicitRoot || defaultCodexHomesRoot()));
  let entries = [];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); }
  catch { return []; }
  const homes = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const home = path.join(root, entry.name);
    try {
      if (!fs.statSync(path.join(home, "auth.json")).isFile()) continue;
      homes.push({ id: entry.name, home });
    }
    catch {
      // Missing or unreadable auth.json means this directory is not an account route.
    }
  }
  homes.sort((left, right) => left.id === "primary"
    ? -1
    : right.id === "primary"
      ? 1
      : left.id.localeCompare(right.id));
  return homes.slice(0, MAX_CODEX_ACCOUNTS);
}

function accessTokenExpiresSoon(accessToken, now = Date.now()) {
  try {
    const payload = JSON.parse(Buffer.from(String(accessToken || "").split(".")[1], "base64url").toString("utf8"));
    const expiresAt = Number(payload && payload.exp) * 1000;
    return Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= now + CODEX_AUTH_REFRESH_SKEW_MS;
  }
  catch {
    // A non-JWT token cannot be preflighted; let the real endpoint validate it.
    return false;
  }
}

function codexCliLaunch(explicitPath = "") {
  const candidates = [
    String(explicitPath || "").trim(),
    process.env.SMART_PROXY_CODEX_PATH || "",
    process.env.APPDATA
      ? path.join(process.env.APPDATA, "npm", "node_modules", "@openai", "codex", "bin", "codex.js")
      : ""
  ].filter(Boolean);
  const target = candidates.find((candidate) => {
    try { return fs.statSync(candidate).isFile(); }
    catch { return false; }
  });
  if (!target) return null;
  return /\.m?js$/i.test(target)
    ? { file: process.execPath, args: [target] }
    : { file: target, args: [] };
}

// Codex normally refreshes ChatGPT tokens during use. Direct benchmark requests
// bypass that client layer, so refresh an expired account through app-server's
// lightweight account API. This sends no model prompt and writes tokens only to
// the account's existing auth.json through Codex itself.
function refreshCodexAccount(codexHome, explicitCodexPath = "") {
  const launch = codexCliLaunch(explicitCodexPath);
  if (!launch) return Promise.reject(new Error("Codex account token expired and Codex CLI is unavailable"));
  return new Promise((resolve, reject) => {
    let child = null;
    let settled = false;
    let lineBuffer = "";
    let stderr = "";
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (child) {
        try { child.kill(); } catch {}
      }
      if (error) reject(error);
      else resolve();
    };
    const deadline = setTimeout(() => {
      finish(new Error("Codex account refresh timed out"));
    }, CODEX_AUTH_REFRESH_TIMEOUT_MS);
    try {
      child = child_process.spawn(
        launch.file,
        [...launch.args, "app-server", "--listen", "stdio://"],
        {
          env: { ...process.env, CODEX_HOME: codexHome },
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"]
        }
      );
    }
    catch (error) {
      finish(error);
      return;
    }
    const send = (message) => child.stdin.write(JSON.stringify(message) + "\n");
    const consumeLine = (line) => {
      let message = null;
      try { message = JSON.parse(line); }
      catch { return; }
      if (message.id === 1) {
        if (message.error) {
          finish(new Error("Codex account refresh initialization failed"));
          return;
        }
        send({ method: "initialized", params: {} });
        send({ method: "account/read", id: 2, params: { refreshToken: true } });
      }
      else if (message.id === 2) {
        finish(message.error ? new Error("Codex account refresh was rejected") : null);
      }
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      lineBuffer += String(chunk || "");
      if (lineBuffer.length > MAX_CAPTURE_BYTES) lineBuffer = lineBuffer.slice(-MAX_CAPTURE_BYTES);
      let newline = lineBuffer.indexOf("\n");
      while (newline >= 0) {
        consumeLine(lineBuffer.slice(0, newline));
        lineBuffer = lineBuffer.slice(newline + 1);
        newline = lineBuffer.indexOf("\n");
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + String(chunk || "")).slice(-2000);
    });
    child.stdin.on("error", () => {});
    child.on("error", finish);
    child.on("exit", (code) => {
      if (!settled) finish(new Error(
        "Codex account refresh exited with code " + code
        + (stderr.trim() ? ": " + stderr.trim().split(/\r?\n/)[0].slice(0, 160) : "")
      ));
    });
    send({
      method: "initialize",
      id: 1,
      params: {
        clientInfo: {
          name: "smart_proxy_auth_refresh",
          title: "Smart Proxy Auth Refresh",
          version: "1"
        }
      }
    });
  });
}

function codexAccountAuth(codexHome, options = {}) {
  const home = path.resolve(String(codexHome || ""));
  if (!CODEX_AUTH_CACHE.has(home)) {
    CODEX_AUTH_CACHE.set(home, (async () => {
      const authFile = path.join(home, "auth.json");
      let auth = JSON.parse(await fs.promises.readFile(authFile, "utf8"));
      let accessToken = String(auth && auth.tokens && auth.tokens.access_token || "");
      const refreshToken = String(auth && auth.tokens && auth.tokens.refresh_token || "");
      if (accessTokenExpiresSoon(accessToken) && refreshToken) {
        await refreshCodexAccount(home, options.codexPath);
        auth = JSON.parse(await fs.promises.readFile(authFile, "utf8"));
        accessToken = String(auth && auth.tokens && auth.tokens.access_token || "");
      }
      const accountId = String(auth && auth.tokens && auth.tokens.account_id || "");
      if (!accessToken || !accountId || accessTokenExpiresSoon(accessToken)) {
        throw new Error("Codex account authentication is unavailable or expired");
      }
      return { accessToken, accountId };
    })());
  }
  return CODEX_AUTH_CACHE.get(home);
}

function createSemaphore(limit) {
  const maximum = Math.max(1, Math.trunc(numberValue(limit, 1)));
  const waiting = [];
  let active = 0;
  return {
    async run(task) {
      if (active >= maximum) await new Promise((resolve) => waiting.push(resolve));
      active += 1;
      try { return await task(); }
      finally {
        active -= 1;
        const next = waiting.shift();
        if (next) next();
      }
    }
  };
}

function probeFailure(scope, error, extra = {}) {
  return {
    ...extra,
    ok: false,
    failureScope: scope === "model" ? "model" : "node",
    error: String(error && (error.message || error) || "tok/s probe failed").slice(0, 500)
  };
}

function tokenMixChannelFailure(http, detail) {
  return http === 401 || http === 402 || http >= 500
    || /model.*(?:not found|unavailable|unsupported)|does not exist|auth(?:entication)?|invalid api key|quota|rate.?limit|too many concurrent/i.test(String(detail || ""));
}

function parseTokenMixStream(bodyText) {
  let characters = 0;
  let resolvedModel = "";
  let apiError = "";
  const source = String(bodyText || "");
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("T ")) continue;
    const payload = line.startsWith("data:") ? line.slice(5).trim() : line;
    if (!payload || payload === "[DONE]") continue;
    try {
      const json = JSON.parse(payload);
      if (!resolvedModel && typeof json.model === "string") resolvedModel = json.model;
      const content = json && json.choices && json.choices[0] && json.choices[0].delta
        ? json.choices[0].delta.content
        : "";
      if (typeof content === "string") characters += Array.from(content).length;
      const message = json && json.error && (json.error.message || json.error.code || json.error.type);
      if (!apiError && message) apiError = String(message);
    }
    catch {
      // curl diagnostics and the trailing timing record are not SSE JSON.
    }
  }
  if (!resolvedModel) {
    const match = source.match(/"model"\s*:\s*"([^"]+)"/);
    if (match) resolvedModel = match[1];
  }
  return { characters, resolvedModel, apiError };
}

function appendBounded(current, chunk) {
  const next = current + String(chunk || "");
  return next.length <= MAX_CAPTURE_BYTES ? next : next.slice(next.length - MAX_CAPTURE_BYTES);
}

function readUsageNumber(usage, names) {
  for (const name of names) {
    const value = usage && usage[name];
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function codexChannelFailure(http, detail) {
  return http === 401 || http === 402 || http >= 500
    || /model.*(?:not found|unavailable|unsupported)|unsupported (?:parameter|value)|auth(?:entication)?|unauthorized|sign.?in|log.?in|subscription|quota|rate.?limit|usage.?limit/i.test(String(detail || ""));
}

function codexRequestBody(model) {
  return JSON.stringify({
    model,
    instructions: "Return plain text only. Do not use tools, count words, verify a length, reason, or explain.",
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text: "Immediately write one short English paragraph about internet connection speed. Aim for roughly 80 words; exact length does not matter. Start with the word Speed."
      }]
    }],
    tools: [],
    tool_choice: "auto",
    parallel_tool_calls: false,
    reasoning: { effort: "low" },
    store: false,
    stream: true
  });
}

function runCodexProbe(port, options) {
  const probeStartedAt = Date.now();
  const configuredTimeoutMs = clampInteger(options.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS, 5, 120) * 1000;
  const model = options.codexModel || CODEX_MODEL;
  const body = codexRequestBody(model);

  return codexAccountAuth(options.codexHome, options)
    .then((auth) => new Promise((resolve) => {
      const requestStartedAt = Date.now();
      const roundRemainingMs = Number(options.roundDeadlineAt || 0) > 0
        ? Number(options.roundDeadlineAt) - requestStartedAt
        : configuredTimeoutMs;
      const timeoutMs = Math.max(250, Math.min(configuredTimeoutMs, roundRemainingMs));
      const timeoutSeconds = timeoutMs / 1000;
      let child = null;
      let settled = false;
      let stdout = "";
      let stderr = "";
      let lineBuffer = "";
      let resolvedModel = "";
      let responseStatus = "";
      let apiError = "";
      let usage = null;
      let completed = false;
      let responseCreatedAt = 0;
      let firstDeltaAt = 0;
      let lastDeltaAt = 0;
      let deltaCount = 0;
      let characters = 0;

      const safeDetail = (value) => String(value || "Codex request failed")
        .replaceAll(auth.accessToken, "[redacted]")
        .replaceAll(auth.accountId, "[redacted]")
        .slice(0, 500);
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        if (child) {
          try { child.kill(); } catch {}
        }
        resolve({ ...value, totalMs: Math.max(1, Date.now() - probeStartedAt) });
      };
      const consumeLine = (rawLine) => {
        const line = String(rawLine || "").trim();
        if (!line.startsWith("data:")) return;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") return;
        let event = null;
        try { event = JSON.parse(payload); }
        catch { return; }
        const eventType = String(event && event.type || "");
        if (eventType === "response.created" && !responseCreatedAt) responseCreatedAt = Date.now();
        if (event && event.response && event.response.model) resolvedModel = String(event.response.model);
        if (event && event.response && event.response.status) responseStatus = String(event.response.status);
        if (event && event.response && event.response.usage) usage = event.response.usage;
        if (eventType === "response.completed") completed = true;
        if (eventType.includes("output_text.delta") && typeof event.delta === "string") {
          const now = Date.now();
          if (!firstDeltaAt) firstDeltaAt = now;
          lastDeltaAt = now;
          deltaCount += 1;
          characters += Array.from(event.delta).length;
        }
        const detail = event && event.error && (event.error.message || event.error.code || event.error.type)
          || event && event.response && event.response.error
            && (event.response.error.message || event.response.error.code || event.response.error.type);
        if (detail && !apiError) apiError = safeDetail(detail);
      };
      const deadline = setTimeout(() => {
        finish(probeFailure("node", "Codex benchmark timed out after " + timeoutSeconds + "s", { http: 0 }));
      }, timeoutMs + 500);

      try {
        child = child_process.spawn(
          "curl.exe",
          [
            "-sS",
            "--no-buffer",
            "--http1.1",
            "--request", "POST",
            "--config", "-",
            "--data-raw", body,
            "--write-out", "\nT %{http_code} %{time_starttransfer} %{time_total}\n",
            CODEX_RESPONSES_URL
          ],
          { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }
        );
      }
      catch (error) {
        finish(probeFailure("model", error, { http: 0 }));
        return;
      }

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout = appendBounded(stdout, chunk);
        lineBuffer += String(chunk || "");
        let newline = lineBuffer.indexOf("\n");
        while (newline >= 0) {
          consumeLine(lineBuffer.slice(0, newline).replace(/\r$/, ""));
          lineBuffer = lineBuffer.slice(newline + 1);
          newline = lineBuffer.indexOf("\n");
        }
      });
      child.stderr.on("data", (chunk) => { stderr = appendBounded(stderr, chunk); });
      child.on("error", (error) => finish(probeFailure("model", error, { http: 0 })));
      child.on("close", (exitCode) => {
        if (settled) return;
        if (lineBuffer) consumeLine(lineBuffer);
        const statMatch = stdout.match(/^T\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s*$/m);
        const http = Number(statMatch && statMatch[1] || 0);
        const startSeconds = Number(statMatch && statMatch[2] || 0);
        const totalSeconds = Number(statMatch && statMatch[3] || 0);
        if (!apiError && http !== 200) {
          const responseBody = stdout.replace(/\nT\s+[\s\S]*$/, "").trim();
          try {
            const json = JSON.parse(responseBody);
            apiError = safeDetail(json && json.error && (json.error.message || json.error.code || json.error.type));
          }
          catch {
            // Non-JSON route errors fall back to curl's sanitized diagnostic below.
          }
        }
        const detail = safeDetail(apiError || String(stderr || "").trim().split(/\r?\n/)[0]
          || (exitCode ? "curl exited with code " + exitCode : "Codex request failed"));
        if (!http || exitCode) {
          finish(probeFailure("node", detail, { http }));
          return;
        }
        if (http !== 200 || apiError) {
          finish(probeFailure(
            codexChannelFailure(http, apiError || detail) ? "model" : "node",
            "Codex HTTP " + http + ": " + (apiError || detail),
            { http }
          ));
          return;
        }
        if (!completed || (responseStatus && responseStatus !== "completed")) {
          finish(probeFailure("node", "Codex stream ended without a completed response", { http }));
          return;
        }
        if (resolvedModel !== model) {
          finish(probeFailure(
            "model",
            "Requested model " + model + " but Codex resolved " + (resolvedModel || "(missing)"),
            { http }
          ));
          return;
        }
        if (!firstDeltaAt || characters < 40 || deltaCount < 1) {
          finish(probeFailure("node", "Codex returned no usable streamed text deltas", { http }));
          return;
        }
        const outputTokens = readUsageNumber(usage, ["outputTokens", "output_tokens"]);
        const outputDetails = usage && (usage.output_tokens_details || usage.outputTokensDetails) || {};
        const reasoningTokens = readUsageNumber(outputDetails, ["reasoningTokens", "reasoning_tokens"])
          || readUsageNumber(usage, ["reasoningOutputTokens", "reasoning_output_tokens"]);
        let textTokens = Math.max(0, outputTokens - reasoningTokens);
        if (!(textTokens > 0)) textTokens = Math.max(1, Math.round(characters / 6));
        const deltaStreamMs = Math.max(0, lastDeltaAt - firstDeltaAt);
        const responseStreamMs = responseCreatedAt ? Math.max(0, lastDeltaAt - responseCreatedAt) : 0;
        const curlStreamMs = Math.max(0, Math.round((totalSeconds - startSeconds) * 1000));
        const deliveryStreamMs = deltaStreamMs >= CODEX_MIN_STREAM_MS
          ? deltaStreamMs
          : Math.max(responseStreamMs, curlStreamMs, CODEX_MIN_STREAM_MS);
        const elapsedMs = Math.max(1, Math.round(totalSeconds * 1000), lastDeltaAt - requestStartedAt);
        finish({
          ok: true,
          http,
          requestedModel: model,
          resolvedModel,
          resolvedModelVerified: true,
          modelVerificationSource: "chatgpt-responses-sse-model",
          tokPerSec: effectiveTokPerSec(textTokens, elapsedMs),
          tokEst: Math.round(textTokens),
          ttftMs: Math.max(1, firstDeltaAt - requestStartedAt),
          headerMs: Math.max(1, Math.round(startSeconds * 1000)),
          // Keep streamMs end-to-end for a currently running pre-upgrade UI. The
          // new UI reads deliveryStreamMs separately after its next normal load.
          streamMs: elapsedMs,
          deliveryStreamMs,
          elapsedMs,
          deltaCount,
          streamBuffered: deltaCount < 4 || deltaStreamMs < CODEX_BUFFERED_STREAM_MS,
          timingSource: EFFECTIVE_RATE_TIMING_SOURCE,
          probeModelId: options.modelId || "codex-subscription"
        });
      });

      // Credentials only travel over the child's stdin. They never enter argv,
      // generated files, Smart Proxy output, or the benchmark result JSON.
      child.stdin.on("error", () => {});
      child.stdin.end([
        'proxy = "http://127.0.0.1:' + port + '"',
        'header = "Authorization: Bearer ' + auth.accessToken + '"',
        'header = "chatgpt-account-id: ' + auth.accountId + '"',
        'header = "originator: codex_cli_rs"',
        'header = "User-Agent: codex_cli_rs/0.147.0"',
        'header = "OpenAI-Beta: responses=experimental"',
        'header = "session_id: ' + crypto.randomUUID() + '"',
        'header = "x-client-request-id: ' + crypto.randomUUID() + '"',
        'header = "content-type: application/json"',
        'header = "accept: text/event-stream"',
        'header = "Expect:"',
        "max-time = " + timeoutSeconds.toFixed(3),
        "connect-timeout = " + Math.min(4, timeoutSeconds).toFixed(3)
      ].join("\n") + "\n");
    }))
    .catch((error) => probeFailure("model", error, {
      http: 0,
      totalMs: Math.max(1, Date.now() - probeStartedAt)
    }));
}

let tokenMixKeyPromise = null;

async function tokenMixKey(keyFile) {
  if (!tokenMixKeyPromise) {
    tokenMixKeyPromise = fs.promises.readFile(keyFile, "utf8").then((text) => {
      const line = String(text || "").split(/\r?\n/).find((item) => item.trim().startsWith("sk-tm-"));
      if (!line) throw new Error("TokenMix credential is unavailable");
      return line.trim();
    });
  }
  return tokenMixKeyPromise;
}

function runTokenMixProbe(port, options) {
  const startedAt = Date.now();
  const configuredTimeoutMs = clampInteger(options.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS, 5, 120) * 1000;
  const roundRemainingMs = Number(options.roundDeadlineAt || 0) > 0
    ? Number(options.roundDeadlineAt) - Date.now()
    : configuredTimeoutMs;
  const timeoutMs = Math.max(250, Math.min(configuredTimeoutMs, roundRemainingMs));
  const timeoutSeconds = timeoutMs / 1000;
  const body = JSON.stringify({
    model: options.tokenMixModel || TOKENMIX_MODEL,
    stream: true,
    max_tokens: TOKENMIX_MAX_TOKENS,
    messages: [{ role: "user", content: "Count from 1 to 60 in words, one per line." }]
  });

  return tokenMixKey(options.tokenMixKeyFile)
    .then((key) => new Promise((resolve) => {
      let child = null;
      let settled = false;
      let stdout = "";
      let stderr = "";
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        if (child) {
          try { child.kill(); } catch {}
        }
        resolve({ ...value, totalMs: Math.max(1, Date.now() - startedAt) });
      };
      const deadline = setTimeout(() => {
        finish(probeFailure("node", "TokenMix benchmark timed out after " + timeoutSeconds + "s", { http: 0 }));
      }, timeoutMs + 500);

      try {
        child = child_process.spawn(
          "curl.exe",
          [
            "-sS",
            "--config", "-",
            "--data-raw", body,
            "--no-buffer",
            "--write-out", "\nT %{http_code} %{time_starttransfer} %{time_total}\n",
            TOKENMIX_URL
          ],
          { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }
        );
      }
      catch (error) {
        finish(probeFailure("model", error, { http: 0 }));
        return;
      }

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout = appendBounded(stdout, chunk); });
      child.stderr.on("data", (chunk) => { stderr = appendBounded(stderr, chunk); });
      child.on("error", (error) => finish(probeFailure("model", error, { http: 0 })));
      child.on("close", () => {
        if (settled) return;
        const statMatch = stdout.match(/^T\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s*$/m);
        const http = Number(statMatch && statMatch[1] || 0);
        const startSeconds = Number(statMatch && statMatch[2] || 0);
        const totalSeconds = Number(statMatch && statMatch[3] || 0);
        const parsed = parseTokenMixStream(stdout);
        const detail = parsed.apiError || String(stderr || "").trim().split(/\r?\n/)[0] || "TokenMix request failed";
        if (!http) {
          finish(probeFailure("node", detail, { http: 0 }));
          return;
        }
        if (http !== 200) {
          finish(probeFailure(
            tokenMixChannelFailure(http, detail) ? "model" : "node",
            "TokenMix HTTP " + http + ": " + detail,
            { http }
          ));
          return;
        }
        const expectedModel = options.tokenMixModel || TOKENMIX_MODEL;
        if (parsed.resolvedModel !== expectedModel) {
          finish(probeFailure("model", "TokenMix resolved unexpected model " + (parsed.resolvedModel || "(missing)"), { http }));
          return;
        }
        const deliveryStreamMs = Math.max(0, Math.round((totalSeconds - startSeconds) * 1000));
        const ttftMs = Math.max(1, Math.round(startSeconds * 1000));
        const elapsedMs = Math.max(1, Math.round(totalSeconds * 1000));
        if (parsed.characters < 40) {
          finish(probeFailure("node", "TokenMix response was too short", { http, ttftMs }));
          return;
        }
        const tokEst = Math.max(1, Math.round(parsed.characters / 4));
        finish({
          ok: true,
          http,
          ttftMs,
          tokEst,
          streamMs: elapsedMs,
          deliveryStreamMs,
          elapsedMs,
          tokPerSec: effectiveTokPerSec(tokEst, elapsedMs),
          requestedModel: expectedModel,
          resolvedModel: parsed.resolvedModel,
          resolvedModelVerified: true,
          modelVerificationSource: "tokenmix-sse-model",
          streamBuffered: deliveryStreamMs < TOKENMIX_MIN_STREAM_MS,
          timingSource: EFFECTIVE_RATE_TIMING_SOURCE,
          probeModelId: "tokenmix"
        });
      });

      // The credential is sent over stdin and never appears in argv or output.
      child.stdin.end([
        'proxy = "http://127.0.0.1:' + port + '"',
        'header = "Authorization: Bearer ' + key + '"',
        'header = "content-type: application/json"',
        "max-time = " + timeoutSeconds.toFixed(3),
        "connect-timeout = " + Math.min(4, timeoutSeconds).toFixed(3)
      ].join("\n") + "\n");
    }))
    .catch((error) => probeFailure("model", error, {
      http: 0,
      totalMs: Math.max(1, Date.now() - startedAt)
    }));
}

function createActivityTracker() {
  const activeByModel = new Map();
  const maxByModel = new Map();
  let activeTotal = 0;
  let maxActiveTotal = 0;
  return {
    async run(modelId, task) {
      activeTotal += 1;
      activeByModel.set(modelId, (activeByModel.get(modelId) || 0) + 1);
      maxActiveTotal = Math.max(maxActiveTotal, activeTotal);
      maxByModel.set(modelId, Math.max(maxByModel.get(modelId) || 0, activeByModel.get(modelId)));
      try {
        return await task();
      }
      finally {
        activeTotal -= 1;
        activeByModel.set(modelId, Math.max(0, (activeByModel.get(modelId) || 1) - 1));
      }
    },
    snapshot() {
      return {
        maxActiveTotal,
        maxActiveByModel: Object.fromEntries(maxByModel)
      };
    }
  };
}

async function runRound(options) {
  const ports = helpers.uniqueCodexProbeItems(
    (options.ports || []).map((port) => ({ port: Number(port) })).filter((item) => item.port > 0),
    (item) => item.port
  );
  if (!ports.length) {
    return {
      ok: true,
      elapsedMs: 0,
      plan: concurrencyForRound(0),
      activity: { maxActiveTotal: 0, maxActiveByModel: {} },
      disabledModels: [],
      outcomes: []
    };
  }

  const codexHomes = Array.isArray(options.codexHomes)
    ? options.codexHomes.filter((item) => item && item.id && item.home)
    : discoverCodexHomes(options.codexHomesRoot);
  const startedAt = Date.now();
  const roundDeadlineMs = clampInteger(
    options.roundDeadlineMs,
    DEFAULT_ROUND_DEADLINE_MS,
    5000,
    60000
  );
  const routeTimeoutSeconds = Math.ceil(roundDeadlineMs / 1000);
  const roundDeadlineAt = startedAt + roundDeadlineMs;
  const plan = concurrencyForRound(ports.length, {
    codexAccountCount: codexHomes.length,
    codex: options.codexConcurrency,
    tokenMix: options.tokenMixConcurrency,
    tokenMixProcesses: options.tokenMixProcessConcurrency
  });
  const tracker = createActivityTracker();
  const tokenMixSemaphore = createSemaphore(plan.tokenMixProcesses);
  let tokenMixChannelError = null;
  const disabledModels = [];

  const codexModels = codexHomes.map((account) => {
    const modelId = "codex-" + account.id;
    return {
      id: modelId,
      concurrency: plan.codex,
      worker: (item) => tracker.run(modelId, () => runCodexProbe(item.port, {
        codexHome: account.home,
        codexModel: options.codexModel || CODEX_MODEL,
        modelId,
        timeoutSeconds: Math.max(routeTimeoutSeconds, numberValue(options.codexTimeoutSeconds, routeTimeoutSeconds)),
        roundDeadlineAt
      }))
    };
  });

  const pool = await helpers.runCodexProbeModelPool(ports, {
    keyOf: (item) => item.port,
    models: [
      ...codexModels,
      {
        id: "tokenmix",
        concurrency: plan.tokenMix,
        worker: (item) => tokenMixSemaphore.run(async () => {
          if (tokenMixChannelError) return tokenMixChannelError;
          const outcome = await tracker.run("tokenmix", () => runTokenMixProbe(item.port, {
            tokenMixKeyFile: options.tokenMixKeyFile,
            tokenMixModel: options.tokenMixModel || TOKENMIX_MODEL,
            timeoutSeconds: Math.max(routeTimeoutSeconds, numberValue(options.tokenMixTimeoutSeconds, routeTimeoutSeconds)),
            roundDeadlineAt
          }));
          if (outcome && outcome.failureScope === "model") tokenMixChannelError = outcome;
          return outcome;
        })
      }
    ],
    onModelDisabled: ({ modelId, error }) => {
      disabledModels.push({
        modelId,
        error: String(error && (error.message || error) || "model unavailable").slice(0, 500)
      });
    }
  });

  const outcomes = [];
  for (const [key, outcome] of pool.outcomes) {
    let value = outcome && outcome.value;
    if (!value || typeof value !== "object") {
      value = probeFailure(
        outcome && outcome.failureScope || "model",
        outcome && outcome.error || "all tok/s models are unavailable",
        { http: 0 }
      );
    }
    outcomes.push({
      port: Number(key),
      modelId: String(outcome && outcome.modelId || ""),
      ok: value.ok === true,
      failureScope: value.ok === true ? "" : String(value.failureScope || outcome.failureScope || "node"),
      value
    });
  }
  const order = new Map(ports.map((item, index) => [item.port, index]));
  outcomes.sort((left, right) => order.get(left.port) - order.get(right.port));

  const modelStates = {};
  for (const [id, state] of pool.modelStates) {
    modelStates[id] = {
      disabled: state.disabled === true,
      completedCount: Number(state.completedCount || 0),
      nodeFailureCount: Number(state.nodeFailureCount || 0),
      modelFailureCount: Number(state.modelFailureCount || 0),
      error: state.error ? String(state.error.message || state.error).slice(0, 500) : ""
    };
  }

  return {
    ok: true,
    elapsedMs: Math.max(1, Date.now() - startedAt),
    roundDeadlineMs,
    plan,
    routes: [...codexModels.map((model) => model.id), "tokenmix"],
    activity: tracker.snapshot(),
    disabledModels,
    modelStates,
    outcomes
  };
}

function parseCliArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!String(key).startsWith("--")) continue;
    values[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  const ports = String(values.ports || "")
    .split(",")
    .map((value) => Number(value))
    .filter((port) => Number.isInteger(port) && port > 0 && port <= 65535);
  const sharedTimeoutSeconds = clampInteger(values["timeout-seconds"], DEFAULT_TIMEOUT_SECONDS, 5, 120);
  return {
    ports,
    tokenMixKeyFile: String(values["tokenmix-key-file"] || ""),
    codexHomesRoot: String(values["codex-homes-root"] || ""),
    resultFile: String(values["result-file"] || ""),
    codexTimeoutSeconds: clampInteger(values["codex-timeout-seconds"], sharedTimeoutSeconds, 5, 120),
    tokenMixTimeoutSeconds: clampInteger(values["tokenmix-timeout-seconds"], sharedTimeoutSeconds, 5, 120),
    codexConcurrency: optionalConcurrency(
      values["codex-concurrency"],
      optionalConcurrency(values["max-per-model"], DEFAULT_CODEX_CONCURRENCY)
    ),
    tokenMixConcurrency: optionalConcurrency(
      values["tokenmix-concurrency"],
      optionalConcurrency(values["max-per-model"], DEFAULT_TOKENMIX_CONCURRENCY)
    ),
    tokenMixProcessConcurrency: optionalConcurrency(
      values["tokenmix-process-concurrency"],
      DEFAULT_TOKENMIX_PROCESS_CONCURRENCY
    ),
    codexPath: String(values["codex-path"] || ""),
    codexModel: String(values["codex-model"] || CODEX_MODEL),
    tokenMixModel: String(values["tokenmix-model"] || TOKENMIX_MODEL)
  };
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (!options.ports.length) throw new Error("At least one probe port is required");
  if (!options.tokenMixKeyFile) throw new Error("TokenMix key file path is required");
  const result = await runRound(options);
  const serialized = JSON.stringify(result) + "\n";
  if (options.resultFile) {
    const target = path.resolve(options.resultFile);
    const temporary = target + ".tmp-" + process.pid;
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(temporary, serialized, "utf8");
    await fs.promises.rename(temporary, target);
  }
  process.stdout.write(serialized);
}

if (require.main === module) {
  main().catch((error) => {
    process.stdout.write(JSON.stringify({
      ok: false,
      error: String(error && (error.message || error) || "dual-model probe failed").slice(0, 500)
    }) + "\n");
    process.exitCode = 1;
  });
}

module.exports = {
  codexAccountAuth,
  concurrencyForRound,
  codexChannelFailure,
  discoverCodexHomes,
  effectiveTokPerSec,
  parseTokenMixStream,
  runCodexProbe,
  runRound
};
