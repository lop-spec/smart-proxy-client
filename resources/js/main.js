const MAIN_SECRET = "smart-main-secret";
const MAIN_CONTROLLER_TIMEOUT_MS = 8000;
const MAIN_CORE_START_ATTEMPTS = 3;
const MAIN_CORE_RETRY_DELAY_MS = 450;
const APP_CONFIG_VERSION = 17;
const APP_BUILD_ID = "2026-09-15-stream-quality-v1.4.0";
const LOG_MAX_FILE_BYTES = 8 * 1024 * 1024;
const LOG_MAX_BUFFER_BYTES = 256 * 1024;
const LOG_FLUSH_MS = 500;
const CONTROLLER_REQUEST_TIMEOUT_MS = 5000;
const PORTABLE_DATA_DIR = "smart-proxy-data";
const BUNDLED_PRIVATE_CONFIG_MANIFEST = "/resources/private-config/manifest.json";
const LOCAL_YAML_SOURCE_ID = "__offline-yaml__";
const CODEX_PROBE_POLL_MS = 40;
const CODEX_PROBE_GATE_CONCURRENCY = 64;
const DELAY_PROBE_TIMEOUT_MS = 5000;  // 整组测试的总耗时上限
// 延迟分档（到 api.anthropic.com 的真实往返，含 TCP+TLS+首字节）
const DELAY_FAST_MS = 600;
const DELAY_MEDIUM_MS = 1200;
const CODEX_PROBE_UPLOAD_CONCURRENCY = 24;
const CODEX_PROBE_FINAL_CONCURRENCY = 3;
const CODEX_PROBE_FINALIST_COUNT = 3;
const CODEX_PROBE_FINALIST_RETESTS = 2;
const CODEX_PROBE_PROXY_PORT = 40919;
const CODEX_SINGLE_PROBE_MAX_ATTEMPTS = 1;
const PROBE_UPLOAD_URL = "https://speed.cloudflare.com/__up";
const PROBE_UPLOAD_HOST = "speed.cloudflare.com";
const ANTHROPIC_PROBE_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_PROBE_HOST = "api.anthropic.com";
// tok/s uses every authenticated Codex home plus TokenMix as independent routes.
// All routes pull different nodes from one shared queue; a route outage leaves the
// survivors to drain it, while a node-specific failure is final and never re-tested.
const CODEX_TOK_PROBE_HOST = "chatgpt.com";
const CODEX_TOK_PROBE_MODEL = "gpt-5.5";
const CODEX_TOK_PROBE_TIMEOUT_S = 30;
const CODEX_TOK_PROBE_HOMES_ROOT = "C:/Users/lop/Documents/claude/vscodium/homes";
const CODEX_TOK_PROBE_SCRIPT = "codex-subscription-probe.ps1";
const TOK_PROBE_BATCH_SCRIPT = "stream-quality-runner.cjs";
const STREAM_QUALITY_ENDPOINT = "https://stream-quality.1781297309.workers.dev";
const TOKENMIX_TOK_PROBE_URL = "https://api.tokenmix.ai/v1/chat/completions";
const TOKENMIX_TOK_PROBE_HOST = "api.tokenmix.ai";
const TOKENMIX_TOK_PROBE_KEY_FILE = "C:/Users/lop/Documents/Codex/共享文件夹/gpt账号.txt";
const TOKENMIX_TOK_PROBE_MODEL = "gpt-4o-mini";
const TOKENMIX_TOK_PROBE_MAX_TOKENS = 128;
const TOKENMIX_TOK_PROBE_TIMEOUT_S = 30;
const TOKENMIX_TOK_PROBE_MIN_STREAM_MS = 300;
// Auto mode is resolved by the batch helper to the real stable windows measured on
// this machine (50 per GPT account, 20 TokenMix). All four routes still share one
// queue, so idle survivors immediately take over unfinished work.
const CODEX_TOK_PROBE_CONCURRENCY = "auto";
const TOKENMIX_TOK_PROBE_CONCURRENCY = "auto";
const TOKENMIX_TOK_PROBE_PROCESS_CONCURRENCY = "auto";
const PROBE_HOSTS = new Set([
  PROBE_UPLOAD_HOST,
  ANTHROPIC_PROBE_HOST,
  CODEX_TOK_PROBE_HOST,
  TOKENMIX_TOK_PROBE_HOST
]);
const PROBE_CONNECT_TIMEOUT_MS = 12000;
const PROBE_TRANSFER_TIMEOUT_MS = 45000;
const PROBE_TIMEOUT_MS = PROBE_CONNECT_TIMEOUT_MS + PROBE_TRANSFER_TIMEOUT_MS;
const PROBE_RESULT_GRACE_MS = 3000;
const PROBE_SCREEN_UPLOAD_BYTES = 256 * 1024;
const PROBE_FINAL_UPLOAD_BYTES = 1024 * 1024;
const PROBE_BASELINE_MAX_ATTEMPTS = 2;
const PROBE_GATE_TIMEOUT_S = 10;
// ---- 可达性判据（2026-08-14 实证重定）----
// 旧判据 http>=100 && !=403 只看单次 HTTP 码，与真实对话表现脱节：实测
// 台湾06 IEPL / 美国03 IEPL 在 gate 里 401 通过，真实 Claude 连接错误率
// 却是 65.4% / 37.9%（smart-proxy.log 按 chain 归属统计）。失败模式是
// 长连接中途被断（对端强制关闭 / i-o timeout），单次短 ping 测不出来。
// 现判据三条同时满足才算可达：
//   ① HTTP 必须是 400/401（无 key 打 Messages API 的唯一正确回答）
//   ② body 必须带 Anthropic 错误特征（挡掉运营商假页、中转 200 页）
//   ③ 连测 GATE_REPEAT 次全过（挡掉时通时断的抖动节点）
// 【2026-08-14 lop 指定】可达性检查暂时禁用（代码保留，改回 true 即恢复）：
// 严格 gate 剔完假可达后，池内真实错误率中位仍 10.5%，短请求判据到顶了；
// 先直接进 tok/s 阶段，全部节点视为可达。守护 gate 同步短路，避免误告警。
const GATE_CHECK_ENABLED = false;
const GATE_STRICT_CODES = new Set([400, 401]);
const GATE_ANTHROPIC_RE = /authentication_error|"type"\s*:\s*"error"|x-api-key/i;
const GATE_REPEAT_BATCH = 3;   // 批量扫描：全量节点各测 3 次
const GATE_REPEAT_GUARD = 2;   // 守护当前节点：45s 一轮，2 次即可
const GATE_ROUND_GAP_MS = 400;
const GATE_RECHECK_CONCURRENCY = 8;  // 复核轮低并发，避免把节点自己打抖成误判
const PROBE_TRANSFER_TIMEOUT_S = 12;
const PROBE_MIN_VALID_UPLOAD_MS = 15;
const PROBE_MAX_PLAUSIBLE_MBPS = 1000;
const NODE_GUARD_INTERVAL_MS = 45000;
const NODE_GUARD_FAIL_THRESHOLD = 2;
const CONTINUOUS_PROBE_ROUND_DELAY_MS = 3000;
const CONTINUOUS_FULL_ROUND_INTERVAL_MS = 60 * 60 * 1000;
const CONTINUOUS_PROBE_FAILURE_DELAY_MS = 5000;
// ---- 抖动判别（机场面故障 vs 单节点超时）----
// 判定窗口内同时命中两条才判「抖动」：
//   R1 出错节点数 ≥ JITTER_DISTINCT_NODES_MIN
//   R2 中途死亡类错误 ≥ JITTER_MIDSTREAM_MIN 且占比 > JITTER_MIDSTREAM_RATIO
const JITTER_WINDOW_MS = 120000;
const JITTER_DISTINCT_NODES_MIN = 2;
const JITTER_MIDSTREAM_MIN = 6;
const JITTER_MIDSTREAM_RATIO = 0.5;
const JITTER_HANDLE_COOLDOWN_MS = 90000;
// ---- 客户端重连风暴（对齐用户真实体感的独立信号）----
// 守护用无 key 探测判「节点可达」，但真实带 key 流式请求可能在同一出口上得不到
// 有效响应：节点看起来健康，Claude 却在疯狂重连。实测平时到 api.anthropic.com
// 的新建连接为 1~3 条/分钟，故障时同一出口 50 条/分钟。
// 【实测教训 2026-08-05】只数连接数会误判：真故障(17:47)是 50 次/零错误，
// 而正常密集使用 Claude Code(18:05/18:11)也有 31/32 次、同样零错误——两者在
// 连接数维度不可分。曾按 15 次触发，连切两次打断了正在进行的对话。
// 现要求「连接数暴增」+「该出口同窗口内有真实错误」双证据，宁可漏判不可误判。
const RECONNECT_STORM_WINDOW_MS = 60000;
const RECONNECT_STORM_MIN = 40;
const RECONNECT_STORM_MIN_ERRORS = 2;
const RECONNECT_STORM_HANDLE_COOLDOWN_MS = 180000;
const ENDPOINT_DNS_RECHECK_MS = 10 * 60 * 1000;
const ENDPOINT_DEAD_TTL_MS = 30 * 60 * 1000;
// 入口域名大面积失效 = 机场换了配置，本地缓存的订阅已过期。
// 自动拉新订阅并验证；新配置只写缓存并提醒，运行中的内核与节点不变。
const ENDPOINT_AUTO_RECOVER_RATIO = 0.25;
const ENDPOINT_AUTO_RECOVER_COOLDOWN_MS = 20 * 60 * 1000;
// 订阅过期只认真实证据：测速里该订阅 ≥ RATIO 节点连接级失败，或缓存超过机场声明的
// Profile-Update-Interval（默认 24h）。系统 DNS 诊断永远只是提示（见 refreshEndpointDnsHealth）。
const SUBSCRIPTION_REFRESH_TICK_MS = 60 * 1000;
const SUBSCRIPTION_REFRESH_FIRST_TICK_MS = 15 * 1000;
const SUBSCRIPTION_REFRESH_DEFAULT_HOURS = 24;
const ENTRY_TCP_PROBE_TIMEOUT_MS = 5000;
const ENTRY_TCP_PROBE_MAX = 3;
const OPENAI_DOMAIN_RULE = "chatgpt.com,openai.com,oaistatic.com,oaiusercontent.com,oaistatsig.com";
const OPENAI_CUSTOM_RULE = {
  type: "DOMAIN-SUFFIX-SET",
  value: OPENAI_DOMAIN_RULE,
  outbound: "SMART",
  position: "prepend"
};
const INSTANCE_SIGNAL_POLL_MS = 250;
const INSTANCE_ACK_POLL_MS = 100;
const INSTANCE_ACK_TIMEOUT_MS = 2500;
const INSTANCE_TAKEOVER_WAIT_MS = 1200;
const TRAY_SETUP_RETRIES = 3;
const TRAY_SETUP_RETRY_MS = 250;
const EXIT_SAVE_TIMEOUT_MS = 2000;
const EXIT_STOP_TIMEOUT_MS = 4000;
const APP_EXIT_GRACE_MS = 1200;
const SYSTEM_NETWORK_OPTIMIZE_RECHECK_DELAY_MS = 1800;

const DEFAULT_SETTINGS = {
  appConfigVersion: APP_CONFIG_VERSION,
  subscriptionUrl: "",
  cachedSubscriptionUrl: "",
  subscriptions: [],
  activeSubscriptionId: "",
  configPath: "",
  singBoxPath: "",
  targetGroup: "SmartProxy",
  forcedDomains: "",
  customRules: [{ ...OPENAI_CUSTOM_RULE }],
  includeRegex: "日本|香港|台湾|新加坡|狮城|美国|硅谷|东京|首尔|韩国|JP|HK|TW|SG|US|KR",
  excludeRegex: "剩余流量|距离下次重置|套餐到期|官网|更新|流量|香港 08|香港 09|0\\.8\\s*倍率",
  maxNodes: 100,
  autoStartSilent: true,
  continuousWssAutoSwitchEnabled: false,
  continuousProbeIntervalMinutes: 5,
  probeGateUrl: "",   // 可达性检测网址，留空=Anthropic Messages API
  systemProxyEnabled: true,
  globalProxyEnabled: false,
  logLevel: "info",
  mainPort: 7899,
  mainControllerPort: 19099,
  jitterGuardEnabled: true,
  jitterCooldownMinutes: 10,
  siteFailoverEnabled: false,
  siteFailoverTargets: "chatgpt.com",
  siteFailoverThreshold: 2,
  siteFailoverWindowSeconds: 60,
  siteFailoverCooldownSeconds: 180,
  autoRecoverOnEndpointFailure: true,
  lastSelectedNodeKey: "",
  lastSelectedNodeTag: "",
  codexProbeStore: { version: 1, updatedAt: 0, results: {} },
  streamQualityStore: { version: 1, updatedAt: 0, results: {} },
  streamQualityEndpoint: STREAM_QUALITY_ENDPOINT,
  streamQualityRounds: 1,
  benchmarkProfile: "codex", // legacy settings retained, no longer used by the UI
  benchmarkCodexModel: CODEX_TOK_PROBE_MODEL,
  networkProbeStore: {},
  subscriptionRefreshStatus: {},
  // 节点分组规则：按顺序匹配，pattern 为空 = 兜底组（放最后）。
  // field: "subscription" 匹配「订阅id 订阅名」，"node" 匹配节点名。
  nodeGroupRules: [
    { id: "A", label: "lovenao", field: "subscription", pattern: "lovenao" },
    { id: "D", label: "离线组", field: "subscription", pattern: "offline-yaml|离线" },
    { id: "C", label: "ANYTLS 0.8倍率", field: "node", pattern: "ANYTLS|0\\.8" },
    { id: "B", label: "IEPL 主力", field: "node", pattern: "" }
  ]};

const state = {
  settings: { ...DEFAULT_SETTINGS },
  paths: {},
  sourceConfig: null,
  mergedSourceConfig: null,
  sourceConfigSubscriptionId: "",
  nodes: [],
  subscriptionConfigs: new Map(),
  subscriptionNodeCatalog: [],
  logs: [],
  logWriteChain: Promise.resolve(),
  logBuffer: [], logBufferBytes: 0, logDropped: 0, logFlushTimer: null, logFlushBusy: false,
  logFileBytes: null, logRenderTimer: null,
  connectionRefreshPromise: null, connectionPollGeneration: 0, lastConnectionsHtml: "", lastCurrentNodeCheckAt: 0,
  probeJob: null, lastProbeRoundId: "", modelProbeNotice: "",
  connections: [],
  seenConnections: new Set(),
  coreProcessByConnId: new Map(),
  coreHostByConnId: new Map(),
  spawnedCoreLabels: new Map(),
  spawnedCoreFailures: new Map(),
  mainProcess: null,
  mainCoreReady: false,
  mainCoreDesired: false,
  mainStartPromise: null,
  mainRestartTimer: null,
  mainHealthFailures: 0,
  mainHealthRecoveryPending: false,
  systemProxyApplied: false,
  logSocket: null,
  logReconnectTimer: null,
  siteFailoverGuard: null,
  siteFailoverRevision: 0,
  siteFailoverLogReady: false,
  connTimer: null,
  currentView: "home",
  surfaceVisible: false,
  subscriptionTraffic: null,
  lastConnectionRefreshByTarget: new Map(),
  currentNode: "-",
  coreCheckRunning: false,
  coreUpdateRunning: false,
  networkProbeJob: null,
  networkPendingKeys: new Set(),
  networkProgress: "",
  closing: false,
  exitPromise: null,
  lifecycleQueue: Promise.resolve(),
  instanceIdentity: null,
  instanceSignalTimer: null,
  instanceSignalBusy: false,
  instanceSignalLast: "",
  uiReady: false,
  settingsLoaded: false,
  pendingWindowShowReason: "",
  trayReady: false,
  systemNetworkOptimizeStatus: null,
  systemNetworkOptimizeBusy: false,
  subscriptionBusy: false,
  subscriptionRefreshOutcome: null,
  subscriptionEditingNew: false,
  nodeCodexResults: new Map(),
  codexProbePendingKeys: new Set(),
  settingsPersistTimer: null,
  codexProbeRunning: false,
  codexProbeMode: "",
  codexProbeBusyKey: "",
  codexProbeLastKey: "",
  codexProbeCompleted: 0,
  codexProbeTotal: 0,
  codexProbeCancelRequested: false,
  codexProbeLanesDisabled: false,
  probeAssets: null,
  probePortByTag: new Map(),
  continuousProbeDesired: false,
  continuousProbePromise: null,
  continuousProbeBestMbps: 0,
  continuousProbeBestKey: "",
  continuousProbeRound: 0,
  proxyRenderTimer: null,
  proxyRenderFlushing: false,
  pendingNodeSelection: null,
  nodeGuardTimer: null,
  nodeGuardFails: 0,
  nodeGuardLast: null,
  nodeGuardEscaping: false,
  lastFullProbeAt: 0,
  continuousForceFullRound: false,
  nodeGroupCollapsed: new Set(),
  nodeGroupCollapseReady: false,
  jitterEvents: [],
  groupCooldownUntil: new Map(),
  jitterLastHandledAt: 0,
  coreOutboundByConnId: new Map(),
  anthropicDialAt: [],
  reconnectStormLastHandledAt: 0,
  deadEndpoints: new Map(),
  endpointDnsCheckedAt: 0,
  endpointDnsBusy: false,
  autoRecoverBusy: false,
  subscriptionRefreshLastAt: new Map(),
  subscriptionRefreshTimer: null,
  subscriptionRefreshPromise: null,
  subscriptionRefreshDisabledLogged: false,
  pendingConfigApply: null
};

function $(id) {
  return document.getElementById(id);
}

function nowText() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function clampNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampInteger(value, fallback, min = 1, max = 999) {
  const n = Math.trunc(clampNumber(value, fallback));
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
}

function quote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function encodePowerShellCommand(script) {
  const normalized = String(script || "").replace(/\r?\n/g, "\r\n");
  let binary = "";
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    binary += String.fromCharCode(code & 0xff, code >> 8);
  }
  return btoa(binary);
}

function wrapPowerShellUtf8(script) {
  return [
    "$smartProxyUtf8 = [System.Text.UTF8Encoding]::new($false)",
    "[Console]::InputEncoding = $smartProxyUtf8",
    "[Console]::OutputEncoding = $smartProxyUtf8",
    "$OutputEncoding = $smartProxyUtf8",
    "try {",
    String(script || ""),
    "}",
    "catch {",
    "  [Console]::Error.WriteLine($_.Exception.Message)",
    "  exit 1",
    "}"
  ].join("\r\n");
}

function buildPowerShellExecCommand(script) {
  return `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodePowerShellCommand(wrapPowerShellUtf8(script))}`;
}

function buildElevatedPowerShellCommand(script) {
  const encoded = encodePowerShellCommand(script);
  const launcher = [
    `$encoded=${psQuote(encoded)}`,
    "Start-Process -FilePath powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',$encoded) -Verb RunAs -Wait -WindowStyle Hidden"
  ].join("; ");
  return `powershell -NoProfile -ExecutionPolicy Bypass -Command ${quote(launcher)}`;
}

function controllerUrl(port) {
  return `http://127.0.0.1:${port}`;
}

function mainController() {
  return controllerUrl(state.settings.mainControllerPort);
}


function log(message) {
  const line = `[${new Date().toISOString()}] ${String(message).slice(0, 8192)}`;
  state.logs.push(line);
  if (state.logs.length > 2000) state.logs.splice(0, state.logs.length - 2000);
  scheduleLogRender();
  if (!state.paths.appLog || !Neutralino.filesystem?.appendFile) return;
  const text = line + "\r\n", bytes = new TextEncoder().encode(text).length;
  while (state.logBuffer.length && state.logBufferBytes + bytes > LOG_MAX_BUFFER_BYTES) {
    const removed = state.logBuffer.shift(); state.logBufferBytes -= removed.bytes; state.logDropped++;
  }
  state.logBuffer.push({ text, bytes }); state.logBufferBytes += bytes;
  if (!state.logFlushTimer) state.logFlushTimer = setTimeout(() => {
    state.logFlushTimer = null;
    flushLogBuffer().catch(err => console.error("Log batch failed; retained queue will retry", err));
  }, LOG_FLUSH_MS);
}

function scheduleLogRender() {
  if (state.currentView !== "logs" || !state.surfaceVisible || document.hidden || state.logRenderTimer) return;
  state.logRenderTimer = setTimeout(() => { state.logRenderTimer = null; if (state.currentView === "logs" && state.surfaceVisible && !document.hidden) renderLogs(); }, 150);
}

async function rotateLogFile(incomingBytes) {
  const file = state.paths.appLog;
  if (state.logFileBytes === null) {
    try { state.logFileBytes = Number((await Neutralino.filesystem.getStats(file)).size || 0); }
    catch (err) {
      if (await access(file)) throw err;
      state.logFileBytes = 0;
    }
    // Preserve the pre-upgrade unbounded log once. Managed .1/.2 rotations below
    // are new, explicitly bounded logs; never delete the user's old large file.
    if (state.logFileBytes > LOG_MAX_FILE_BYTES) {
      const history = await Neutralino.filesystem.getJoinedPath(state.paths.work, "_历史版本");
      await ensureDirectory(history);
      await Neutralino.filesystem.move(file, await Neutralino.filesystem.getJoinedPath(history, `smart-proxy-before-bounded-${Date.now()}.log`));
      state.logFileBytes = 0;
    }
  }
  if (state.logFileBytes + incomingBytes <= LOG_MAX_FILE_BYTES) return;
  if (await access(file + ".2")) await Neutralino.filesystem.remove(file + ".2");
  if (await access(file + ".1")) await Neutralino.filesystem.move(file + ".1", file + ".2");
  if (await access(file)) await Neutralino.filesystem.move(file, file + ".1");
  state.logFileBytes = 0;
}

async function flushLogBuffer() {
  if (state.logFlushBusy) return state.logWriteChain;
  if (state.logFlushTimer) clearTimeout(state.logFlushTimer);
  state.logFlushTimer = null;
  if (!state.logBuffer.length || !state.paths.appLog) return;
  state.logFlushBusy = true;
  const batch = state.logBuffer.splice(0), dropped = state.logDropped;
  state.logBufferBytes = 0; state.logDropped = 0;
  const prefix = dropped ? `[${new Date().toISOString()}] Log backpressure: ${dropped} queued lines dropped (256 KiB limit)\r\n` : "";
  if (dropped) console.warn(prefix.trim());
  const text = prefix + batch.map(item => item.text).join("");
  const bytes = new TextEncoder().encode(text).length;
  state.logWriteChain = (async () => {
    try { await rotateLogFile(bytes); await Neutralino.filesystem.appendFile(state.paths.appLog, text); state.logFileBytes += bytes; }
    catch (err) { state.logDropped += batch.length + dropped; console.error("Log write failed; dropped batch will be reported on recovery", err); throw err; }
    finally {
      state.logFlushBusy = false;
      if (state.logBuffer.length && !state.logFlushTimer) state.logFlushTimer = setTimeout(() => {
        state.logFlushTimer = null; flushLogBuffer().catch(err => console.error("Log retry failed", err));
      }, LOG_FLUSH_MS);
    }
  })();
  return state.logWriteChain;
}

function filteredLogLines() {
  const q = ($("logFilter") && $("logFilter").value.trim().toLowerCase()) || "";
  return q
    ? state.logs.filter((line) => line.toLowerCase().includes(q))
    : state.logs;
}

function currentRenderedLogText() {
  return filteredLogLines().slice().reverse().join("\n");
}

function renderLogs() {
  $("logBox").textContent = currentRenderedLogText();
}

async function writeTextToClipboard(text) {
  let nativeError = null;
  if (typeof Neutralino !== "undefined" && Neutralino.clipboard && Neutralino.clipboard.writeText) {
    try {
      await Neutralino.clipboard.writeText(text);
      return;
    }
    catch (err) {
      nativeError = err;
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    }
    catch (err) {
      nativeError = nativeError || err;
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw nativeError || new Error("clipboard copy failed");
}

async function copyCurrentLogs() {
  const text = currentRenderedLogText();
  const button = $("copyLogsBtn");
  const originalText = button ? button.textContent : "";
  const lineCount = text ? text.split(/\r?\n/).length : 0;
  try {
    await writeTextToClipboard(text);
    if (button) {
      button.textContent = `已复制 ${lineCount} 行`;
      setTimeout(() => {
        if (button.textContent.startsWith("已复制")) button.textContent = originalText || "复制当前日志";
      }, 1400);
    }
    log(`Copied current logs: ${lineCount} lines`);
  }
  catch (err) {
    if (button) {
      button.textContent = "复制失败";
      setTimeout(() => {
        if (button.textContent === "复制失败") button.textContent = originalText || "复制当前日志";
      }, 1800);
    }
    log(`Copy logs failed: ${err.message || err}`);
  }
}

function setSettingsSaveStatus(message, tone = "") {
  const el = $("settingsSaveStatus");
  if (!el) return;
  el.textContent = message;
  el.className = `save-status ${tone}`.trim();
}


function currentCoreLabel() {
  return "sing-box";
}

function updateHomeProxyControls() {
  if ($("systemProxyEnabled")) $("systemProxyEnabled").checked = !!state.settings.systemProxyEnabled;
  if ($("globalProxyEnabled")) $("globalProxyEnabled").checked = !!state.settings.globalProxyEnabled;
  if ($("systemProxyHint")) {
    $("systemProxyHint").textContent = state.settings.systemProxyEnabled
      ? (state.systemProxyApplied
        ? "已接管 Windows 系统代理"
        : state.mainCoreReady
          ? "内核已就绪，系统代理尚未接管"
          : "内核就绪后自动接管")
      : "不修改 Windows 系统代理";
  }
  if ($("globalProxyHint")) {
    $("globalProxyHint").textContent = state.settings.globalProxyEnabled
      ? "所有连接走当前节点"
      : "默认直连，仅强制域名和自定义规则分流";
  }
  if ($("homeProxyMode")) {
    $("homeProxyMode").textContent = state.settings.globalProxyEnabled ? "全局代理" : "自定义代理";
  }
}

function renderHomeTraffic() {
  const remain = $("homeTrafficRemain");
  const meta = $("homeTrafficMeta");
  const bar = $("homeTrafficBar");
  if (!remain || !meta || !bar) return;
  const traffic = state.subscriptionTraffic;
  if (!traffic) {
    remain.textContent = "-";
    meta.textContent = "下载订阅后显示";
    bar.style.width = "0%";
    return;
  }
  remain.textContent = traffic.remainingText || "-";
  const expireText = traffic.expire
    ? ` / 到期 ${new Date(traffic.expire * 1000).toLocaleDateString("zh-CN")}`
    : "";
  meta.textContent = `总量 ${traffic.totalText} / 已用 ${traffic.usedPercent}%${expireText}`;
  bar.style.width = `${Math.max(0, Math.min(100, traffic.usedPercent || 0))}%`;
}

function normalizeCustomRuleDefaults() {
  const rules = Array.isArray(state.settings.customRules) ? state.settings.customRules : [];
  state.settings.customRules = SmartProxyConfig.ensureOpenAiCustomRule
    ? SmartProxyConfig.ensureOpenAiCustomRule(rules, state.settings)
    : [{ ...OPENAI_CUSTOM_RULE }, ...rules];
  state.settings.forcedDomains = "";
}

function getSwitchableNodes(allNodes = getCandidateNodes()) {
  return allNodes;
}

function setStatus() {
  const on = !!state.mainProcess && !!state.mainCoreReady;
  const core = currentCoreLabel();
  const corePath = selectedCorePath();
  const allNodes = state.nodes.length ? state.nodes : getCandidateNodes();
  const routeMode = state.settings.globalProxyEnabled ? "全局代理" : "自定义规则";
  $("sideDot").className = `dot ${on ? "on" : ""}`;
  $("sideStatus").textContent = on ? "代理运行中" : "未启动";
  $("hero").className = `hero ${on ? "on" : "off"}`;
  $("heroTitle").textContent = on ? "代理运行中" : "代理未启动";
  $("heroMeta").textContent = on
    ? `${core} / ${routeMode} / 节点 ${allNodes.length}`
    : `当前核心 ${core}${corePath ? " / 路径已设置" : " / 路径未设置"}`;
  $("toggleCoreBtn").textContent = on ? "停止代理" : "启动代理";
  if ($("homeCore")) $("homeCore").textContent = core;
  if ($("coreBadge")) $("coreBadge").textContent = `${core}${corePath ? " / 路径已设置" : " / 路径未设置"}`;
  $("homeGroup").textContent = state.settings.targetGroup || "-";
  const visibleNodeCount = state.subscriptionNodeCatalog.length || state.nodes.length;
  const refresh = state.settings.subscriptionRefreshStatus?.[state.settings.activeSubscriptionId];
  if ($("subscriptionStatus")) $("subscriptionStatus").textContent = refresh?.error ? "更新失败，现有缓存保留"
    : refresh?.pending ? "已下载，待下次手动启动生效"
    : visibleNodeCount ? `已缓存 ${visibleNodeCount} 个节点` : "未获取节点";
  updateHomeProxyControls();
  renderHomeTraffic();
}

function normalizeSubscriptionSettings() {
  const normalized = SmartProxyConfig.normalizeSubscriptions(state.settings);
  Object.assign(state.settings, normalized);
  return state.settings.subscriptions;
}

function activeSubscription() {
  const subscriptions = normalizeSubscriptionSettings();
  return subscriptions.find((item) => item.id === state.settings.activeSubscriptionId) || subscriptions[0];
}

function subscriptionFormDraft() {
  const homeName = $("homeSubscriptionName") && $("homeSubscriptionName").value.trim();
  const settingsName = $("subscriptionName") && $("subscriptionName").value.trim();
  const name = ["home", "subscriptions"].includes(state.currentView)
    ? (homeName || settingsName)
    : (settingsName || homeName);
  const url = SmartProxyConfig.chooseSubscriptionUrl({
    currentView: state.currentView === "subscriptions" ? "home" : state.currentView,
    homeValue: $("homeSubscriptionUrl") && $("homeSubscriptionUrl").value,
    settingsValue: $("subscriptionUrl") && $("subscriptionUrl").value
  });
  return { name, url };
}

function readActiveSubscriptionFromForm() {
  if (state.subscriptionEditingNew) return activeSubscription();
  const profile = activeSubscription();
  const draft = subscriptionFormDraft();
  if (profile.url !== draft.url) profile.cachedUrl = "";
  profile.name = draft.name || profile.name || "默认订阅";
  profile.url = draft.url;
  state.settings.subscriptionUrl = profile.url;
  state.settings.cachedSubscriptionUrl = profile.cachedUrl || "";
  return profile;
}

function readSettingsFromForm() {
  if (!state.settingsLoaded || !state.uiReady) {
    log("Settings form save blocked: UI/settings not ready; existing file retained");
    throw new Error("Settings form not ready");
  }
  const s = state.settings;
  readActiveSubscriptionFromForm();
  s.configPath = $("configPath").value.trim();
  s.singBoxPath = $("singBoxPath").value.trim();
  s.targetGroup = $("targetGroup").value.trim() || DEFAULT_SETTINGS.targetGroup;
  s.forcedDomains = "";
  s.includeRegex = $("includeRegex").value.trim();
  s.excludeRegex = $("excludeRegex").value.trim();
  s.maxNodes = clampNumber(s.maxNodes, DEFAULT_SETTINGS.maxNodes);
  s.autoStartSilent = $("autoStartSilent") ? $("autoStartSilent").checked : DEFAULT_SETTINGS.autoStartSilent;
  s.continuousWssAutoSwitchEnabled = $("continuousWssAutoSwitchEnabled")
    ? $("continuousWssAutoSwitchEnabled").checked
    : !!DEFAULT_SETTINGS.continuousWssAutoSwitchEnabled;
  s.continuousProbeIntervalMinutes = $("continuousProbeIntervalMinutes")
    ? Math.max(0, Math.min(1440, Math.trunc(Number($("continuousProbeIntervalMinutes").value) || 0)))
    : clampNumber(s.continuousProbeIntervalMinutes, DEFAULT_SETTINGS.continuousProbeIntervalMinutes);
  s.probeGateUrl = $("probeGateUrl") ? String($("probeGateUrl").value || "").trim() : String(s.probeGateUrl || "");
  s.systemProxyEnabled = $("systemProxyEnabled") ? $("systemProxyEnabled").checked : !!DEFAULT_SETTINGS.systemProxyEnabled;
  s.globalProxyEnabled = $("globalProxyEnabled") ? $("globalProxyEnabled").checked : !!DEFAULT_SETTINGS.globalProxyEnabled;
  s.logLevel = $("logLevel") ? ($("logLevel").value || DEFAULT_SETTINGS.logLevel) : (s.logLevel || DEFAULT_SETTINGS.logLevel);
  s.mainPort = $("mainPort") ? clampNumber($("mainPort").value, DEFAULT_SETTINGS.mainPort) : clampNumber(s.mainPort, DEFAULT_SETTINGS.mainPort);
  s.mainControllerPort = $("mainControllerPort") ? clampNumber($("mainControllerPort").value, DEFAULT_SETTINGS.mainControllerPort) : clampNumber(s.mainControllerPort, DEFAULT_SETTINGS.mainControllerPort);
  s.jitterGuardEnabled = $("jitterGuardEnabled") ? $("jitterGuardEnabled").checked : !!DEFAULT_SETTINGS.jitterGuardEnabled;
  s.jitterCooldownMinutes = $("jitterCooldownMinutes")
    ? Math.max(1, Math.min(120, Math.trunc(Number($("jitterCooldownMinutes").value) || DEFAULT_SETTINGS.jitterCooldownMinutes)))
    : clampNumber(s.jitterCooldownMinutes, DEFAULT_SETTINGS.jitterCooldownMinutes);
  s.autoRecoverOnEndpointFailure = $("autoRecoverOnEndpointFailure")
    ? $("autoRecoverOnEndpointFailure").checked
    : s.autoRecoverOnEndpointFailure !== false;
  s.siteFailoverEnabled = $("siteFailoverEnabled") ? $("siteFailoverEnabled").checked === true : s.siteFailoverEnabled;
  if ($("siteFailoverTargets")) s.siteFailoverTargets = $("siteFailoverTargets").value.trim();
  for (const key of ["siteFailoverThreshold", "siteFailoverWindowSeconds", "siteFailoverCooldownSeconds"]) {
    if ($(key)) s[key] = Number($(key).value) || DEFAULT_SETTINGS[key];
  }
  if (s.siteFailoverEnabled) {
    SmartProxySiteFailover.config(s); // Reject invalid input before persisting.
    if (!["info", "debug", "trace"].includes(s.logLevel)) {
      s.logLevel = "info";
      if ($("logLevel")) $("logLevel").value = "info";
      log("Site failover requires correlated info logs; saved log level raised to info (running core not restarted)");
    }
  }
  readNodeGroupRulesFromForm();
}

function renderNodeGroupRules() {
  const box = $("nodeGroupRuleRows");
  if (!box) return;
  const rules = normalizeNodeGroupRules();
  box.innerHTML = rules.map((rule, index) => `
    <tr>
      <td><input class="group-rule-id" data-rule-index="${index}" value="${escapeHtml(rule.id)}" maxlength="4"></td>
      <td><input class="group-rule-label" data-rule-index="${index}" value="${escapeHtml(rule.label)}" maxlength="24"></td>
      <td><select class="group-rule-field" data-rule-index="${index}">
        <option value="node"${rule.field === "node" ? " selected" : ""}>节点名</option>
        <option value="subscription"${rule.field === "subscription" ? " selected" : ""}>订阅</option>
      </select></td>
      <td><input class="group-rule-pattern" data-rule-index="${index}" value="${escapeHtml(rule.pattern)}" placeholder="留空 = 兜底组"></td>
    </tr>`).join("");
}

function readNodeGroupRulesFromForm() {
  const box = $("nodeGroupRuleRows");
  if (!box || !box.querySelector("tr")) return;
  const rules = [...box.querySelectorAll("tr")].map((row) => ({
    id: row.querySelector(".group-rule-id").value.trim(),
    label: row.querySelector(".group-rule-label").value.trim(),
    field: row.querySelector(".group-rule-field").value,
    pattern: row.querySelector(".group-rule-pattern").value.trim()
  }));
  state.settings.nodeGroupRules = rules;
  normalizeNodeGroupRules();
}

function writeSettingsToForm() {
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if ($(key)) $(key).value = state.settings[key];
  }
  renderSubscriptionControls();
  if ($("streamQualityRounds")) $("streamQualityRounds").value = String(state.settings.streamQualityRounds || 1);
  if ($("streamQualityEndpoint")) $("streamQualityEndpoint").value = state.settings.streamQualityEndpoint || STREAM_QUALITY_ENDPOINT;
  renderSubscriptionRefreshStatus();
  if ($("removeOfflineYamlBtn")) $("removeOfflineYamlBtn").disabled = !state.settings.configPath;
  if ($("autoStartSilent")) $("autoStartSilent").checked = !!state.settings.autoStartSilent;
  if ($("continuousWssAutoSwitchEnabled")) {
    $("continuousWssAutoSwitchEnabled").checked = !!state.settings.continuousWssAutoSwitchEnabled;
  }
  if ($("continuousProbeIntervalMinutes")) {
    const interval = Math.trunc(Number(state.settings.continuousProbeIntervalMinutes));
    $("continuousProbeIntervalMinutes").value = Number.isFinite(interval) && interval >= 0 ? interval : DEFAULT_SETTINGS.continuousProbeIntervalMinutes;
  }
  if ($("systemProxyEnabled")) $("systemProxyEnabled").checked = !!state.settings.systemProxyEnabled;
  if ($("globalProxyEnabled")) $("globalProxyEnabled").checked = !!state.settings.globalProxyEnabled;
  if ($("jitterGuardEnabled")) $("jitterGuardEnabled").checked = !!state.settings.jitterGuardEnabled;
  if ($("siteFailoverEnabled")) $("siteFailoverEnabled").checked = state.settings.siteFailoverEnabled === true;
  if ($("autoRecoverOnEndpointFailure")) {
    $("autoRecoverOnEndpointFailure").checked = state.settings.autoRecoverOnEndpointFailure !== false;
  }
  if ($("jitterCooldownMinutes")) {
    const cooldown = Math.trunc(Number(state.settings.jitterCooldownMinutes));
    $("jitterCooldownMinutes").value = Number.isFinite(cooldown) && cooldown >= 1 ? cooldown : DEFAULT_SETTINGS.jitterCooldownMinutes;
  }
  renderNodeGroupRules();
  updateHomeProxyControls();
  renderHomeTraffic();
  renderCustomRules();
}

function syncSubscriptionInputs(sourceId) {
  const source = $(sourceId);
  const pairs = {
    homeSubscriptionUrl: "subscriptionUrl",
    subscriptionUrl: "homeSubscriptionUrl",
    homeSubscriptionName: "subscriptionName",
    subscriptionName: "homeSubscriptionName"
  };
  const target = $(pairs[sourceId]);
  if (source && target && target.value !== source.value) target.value = source.value;
}

function renderSubscriptionControls() {
  const subscriptions = normalizeSubscriptionSettings();
  const active = activeSubscription();
  const options = subscriptions.map((item) => (
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}${item.id === active.id ? "（当前）" : ""}</option>`
  )).join("");
  for (const id of ["homeSubscriptionSelect", "subscriptionSelect"]) {
    const select = $(id);
    if (!select) continue;
    select.innerHTML = state.subscriptionEditingNew
      ? `${options}<option value="__new__">新订阅（未保存）</option>`
      : options;
    select.value = state.subscriptionEditingNew ? "__new__" : active.id;
    select.disabled = state.subscriptionBusy;
  }
  const name = state.subscriptionEditingNew ? "" : active.name;
  const url = state.subscriptionEditingNew ? "" : active.url;
  for (const id of ["homeSubscriptionName", "subscriptionName"]) {
    if ($(id)) $(id).value = name;
  }
  for (const id of ["homeSubscriptionUrl", "subscriptionUrl"]) {
    if ($(id)) $(id).value = url;
  }
  if ($("deleteSubscriptionBtn")) {
    $("deleteSubscriptionBtn").disabled = state.subscriptionBusy || state.subscriptionEditingNew || subscriptions.length <= 1;
  }
  if ($("saveSubscriptionBtn")) {
    $("saveSubscriptionBtn").textContent = state.subscriptionEditingNew ? "保存新订阅" : "保存订阅";
  }
}

function setSubscriptionBusy(busy, message = "") {
  state.subscriptionBusy = !!busy;
  for (const id of [
    "homeSubscriptionSelect", "subscriptionSelect", "addSubscriptionBtn",
    "saveSubscriptionBtn", "deleteSubscriptionBtn", "refreshSubBtn"
  ]) {
    if ($(id)) $(id).disabled = !!busy;
  }
  if (message && $("subscriptionStatus")) $("subscriptionStatus").textContent = message;
  if (!busy) renderSubscriptionControls();
}

function validateSubscriptionUrl(url) {
  let parsed = null;
  try {
    parsed = new URL(String(url || "").trim());
  }
  catch {
    throw new Error("订阅 URL 格式无效");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("订阅 URL 仅支持 http 或 https");
  }
  return parsed.toString();
}

function createSubscriptionId() {
  return `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function beginAddSubscription() {
  if (state.subscriptionBusy) return;
  readActiveSubscriptionFromForm();
  state.subscriptionEditingNew = true;
  renderSubscriptionControls();
  if ($("homeSubscriptionName")) $("homeSubscriptionName").focus();
  if ($("subscriptionStatus")) $("subscriptionStatus").textContent = "填写名称和 URL 后保存";
}

async function saveSubscriptionProfile(options = {}) {
  const draft = subscriptionFormDraft();
  const url = validateSubscriptionUrl(draft.url);
  let profile = null;
  if (state.subscriptionEditingNew) {
    profile = {
      id: createSubscriptionId(),
      name: draft.name || `订阅 ${state.settings.subscriptions.length + 1}`,
      url,
      cachedUrl: ""
    };
    state.settings.subscriptions.push(profile);
    state.settings.activeSubscriptionId = profile.id;
    state.sourceConfig = null;
    state.mergedSourceConfig = null;
    state.sourceConfigSubscriptionId = "";
    state.subscriptionEditingNew = false;
  }
  else {
    profile = activeSubscription();
    const changedUrl = profile.url !== url;
    profile.name = draft.name || profile.name || "默认订阅";
    profile.url = url;
    if (changedUrl) {
      profile.cachedUrl = "";
      state.sourceConfig = null;
      state.mergedSourceConfig = null;
      state.sourceConfigSubscriptionId = "";
    }
  }
  state.settings.subscriptionUrl = profile.url;
  state.settings.cachedSubscriptionUrl = profile.cachedUrl || "";
  await persistSettingsFile();
  await refreshSubscriptionNodeCatalog();
  renderProxyNodes();
  renderSubscriptionControls();
  if (!options.quiet) {
    log(`Subscription profile saved: ${profile.name}`);
    if ($("subscriptionStatus")) $("subscriptionStatus").textContent = "订阅已保存";
  }
  return profile;
}

async function activateSubscription(subscriptionId) {
  if (state.subscriptionBusy || !subscriptionId || subscriptionId === "__new__") return;
  const target = normalizeSubscriptionSettings().find((item) => item.id === subscriptionId);
  if (!target) throw new Error("订阅不存在");
  if (state.subscriptionEditingNew && target.id === state.settings.activeSubscriptionId) {
    state.subscriptionEditingNew = false;
    renderSubscriptionControls();
    return;
  }
  readActiveSubscriptionFromForm();
  if (target.id === state.settings.activeSubscriptionId) {
    state.subscriptionEditingNew = false;
    renderSubscriptionControls();
    return;
  }

  const previous = {
    settings: JSON.parse(JSON.stringify(state.settings)),
    sourceConfig: state.sourceConfig,
    mergedSourceConfig: state.mergedSourceConfig,
    sourceConfigSubscriptionId: state.sourceConfigSubscriptionId,
    nodes: state.nodes,
    subscriptionConfigs: state.subscriptionConfigs,
    subscriptionNodeCatalog: state.subscriptionNodeCatalog,
    traffic: state.subscriptionTraffic,
    codexResults: state.nodeCodexResults,
    codexLastKey: state.codexProbeLastKey
  };
  // 切换订阅是纯状态切换：所有订阅节点已合并进同一份运行配置，
  // 这里只改「当前订阅」标记 + 重渲染，不触碰核心、不发网络请求。
  try {
    state.subscriptionEditingNew = false;
    state.settings.activeSubscriptionId = target.id;
    normalizeSubscriptionSettings();
    const config = state.subscriptionConfigs.get(target.id);
    if (config) {
      state.sourceConfig = config;
      state.sourceConfigSubscriptionId = target.id;
    }
    state.subscriptionTraffic = null;
    renderSubscriptionControls();
    renderHomeTraffic();
    renderProxyNodes();
    setStatus();
    persistSettingsFile().catch((err) => log(`Persist subscription switch failed: ${err.message || err}`));
    log(`Subscription switched (state only): ${activeSubscription().name}`);
  }
  catch (err) {
    state.settings = previous.settings;
    state.sourceConfig = previous.sourceConfig;
    state.sourceConfigSubscriptionId = previous.sourceConfigSubscriptionId;
    state.subscriptionTraffic = previous.traffic;
    state.subscriptionEditingNew = false;
    writeSettingsToForm();
    setStatus();
    renderProxyNodes();
    throw err;
  }
  finally {
    setSubscriptionBusy(false);
  }
}

async function deleteActiveSubscription() {
  const subscriptions = normalizeSubscriptionSettings();
  const current = activeSubscription();
  if (subscriptions.length <= 1) throw new Error("至少保留一个订阅");
  if (!window.confirm(`删除订阅“${current.name}”？已下载缓存会保留，便于恢复。`)) return;
  const next = subscriptions.find((item) => item.id !== current.id);
  const previous = {
    settings: JSON.parse(JSON.stringify(state.settings)),
    sourceConfig: state.sourceConfig,
    mergedSourceConfig: state.mergedSourceConfig,
    sourceConfigSubscriptionId: state.sourceConfigSubscriptionId,
    nodes: state.nodes,
    subscriptionConfigs: state.subscriptionConfigs,
    subscriptionNodeCatalog: state.subscriptionNodeCatalog,
    traffic: state.subscriptionTraffic,
    codexResults: state.nodeCodexResults,
    codexLastKey: state.codexProbeLastKey
  };
  const wasLive = !!state.mainProcess
    || await probeControllerLive(mainController(), MAIN_SECRET, 700).catch(() => false);
  setSubscriptionBusy(true, "正在删除订阅...");
  try {
    try {
      state.settings.subscriptions = state.settings.subscriptions.filter((item) => item.id !== current.id);
      state.settings.activeSubscriptionId = next.id;
      normalizeSubscriptionSettings();
      state.sourceConfig = null;
      state.mergedSourceConfig = null;
      state.sourceConfigSubscriptionId = "";
      state.nodes = [];
      state.subscriptionTraffic = null;
      writeSettingsToForm();
      await persistSettingsFile();
    }
    catch (err) {
      state.settings = previous.settings;
      state.sourceConfig = previous.sourceConfig;
      state.mergedSourceConfig = previous.mergedSourceConfig;
      state.sourceConfigSubscriptionId = previous.sourceConfigSubscriptionId;
      state.nodes = previous.nodes;
      state.subscriptionConfigs = previous.subscriptionConfigs;
      state.subscriptionNodeCatalog = previous.subscriptionNodeCatalog;
      state.subscriptionTraffic = previous.traffic;
      state.nodeCodexResults = previous.codexResults;
      state.codexProbeLastKey = previous.codexLastKey;
      writeSettingsToForm();
      await persistSettingsFile().catch(() => {});
      throw err;
    }

    let localSourceReady = false;
    try {
      localSourceReady = await loadSourceConfig({
        preferCache: true,
        allowPreservedCache: true,
        localOnly: true,
        skipFormRead: true
      });
      if (!localSourceReady) await refreshSubscriptionNodeCatalog({ activeConfig: null });
    }
    catch (err) {
      log(`Subscription removed; local replacement config unavailable: ${err.message || err}`);
      await refreshSubscriptionNodeCatalog({ activeConfig: null }).catch(() => {});
    }

    let runtimeSynced = false;
    if (wasLive && localSourceReady) {
      try {
        runtimeSynced = await applyRuntimeSettings();
      }
      catch (err) {
        log(`Subscription removed; running core sync deferred: ${err.message || err}`);
      }
    }
    setStatus();
    renderProxyNodes();
    renderSubscriptionControls();
    if ($("subscriptionStatus")) $("subscriptionStatus").textContent = `已删除“${current.name}”`;
    log(`Subscription removed locally without network dependency: ${current.name}`);
    return { removed: true, activeSubscriptionId: next.id, localSourceReady, runtimeSynced };
  }
  finally {
    setSubscriptionBusy(false);
  }
}

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "").toLowerCase();
}

async function ensureDefaultCorePaths() {
  const configuredPath = String(state.settings.singBoxPath || "").trim();
  const nextPath = SmartProxyConfig.resolvePortableCorePath({
    configuredPath,
    configuredExists: !!configuredPath && await access(configuredPath),
    bundledPath: state.paths.bundledSingBox,
    dataRoot: state.paths.data,
    dataDirName: PORTABLE_DATA_DIR,
    executableName: "sing-box.exe"
  });
  if (nextPath && normalizePath(nextPath) !== normalizePath(configuredPath)) {
    state.settings.singBoxPath = nextPath;
    return true;
  }
  return false;
}

async function persistSettingsFile() {
  if (!state.settingsLoaded) {
    log("Settings write blocked: settings not initialized; existing file retained");
    throw new Error("Settings not initialized");
  }
  if (!state.paths.settings) throw new Error("Settings path not initialized");
  const saved = JSON.parse(JSON.stringify(state.settings));
  ["singBoxPath", "configPath"].forEach((key) => {
    saved[key] = SmartProxyConfig.toPortableStoredPath({
      resolvedPath: saved[key],
      appRoot: state.paths.appRoot
    });
  });
  await Neutralino.filesystem.writeFile(state.paths.settings, JSON.stringify(saved, null, 2));
}

function hydrateCodexProbeResults() {
  const store = SmartProxyConfig.normalizeCodexProbeStore(state.settings.streamQualityStore);
  state.settings.streamQualityStore = store;
  // codexProbeStore remains untouched as the legacy model-history archive.
  state.nodeCodexResults = new Map(Object.entries(store.results));
}

function scheduleSettingsPersist(reason) {
  if (!state.settingsLoaded || !state.paths.settings || state.closing) {
    log(`Settings persistence not scheduled (${reason || "runtime state"}): uninitialized, missing path or closing`);
    return;
  }
  if (state.settingsPersistTimer) clearTimeout(state.settingsPersistTimer);
  state.settingsPersistTimer = setTimeout(() => {
    state.settingsPersistTimer = null;
    persistSettingsFile().catch((err) => log(`Persist ${reason || "runtime state"} failed: ${err.message || err}`));
  }, 250);
}

function syncCodexProbeStore(options = {}) {
  const results = Object.fromEntries(state.nodeCodexResults);
  state.settings.streamQualityStore = SmartProxyConfig.normalizeCodexProbeStore({
    version: 1,
    updatedAt: Date.now(),
    results
  });
  if (options.persist !== false) scheduleSettingsPersist("Stream Quality results");
  return state.settings.streamQualityStore;
}

function restorableNodeEntry() {
  return SmartProxyConfig.findRestorableNode(state.subscriptionNodeCatalog, state.settings);
}

function rememberSelectedNode(entryOrTag, options = {}) {
  const entry = entryOrTag && typeof entryOrTag === "object"
    ? entryOrTag
    : state.subscriptionNodeCatalog.find((item) => (item.tag || item.node) === String(entryOrTag || ""));
  if (!entry) return false;
  const key = String(entry.key || "");
  const tag = String(entry.tag || entry.node || "");
  if (!key || !tag) return false;
  const changed = state.settings.lastSelectedNodeKey !== key || state.settings.lastSelectedNodeTag !== tag;
  state.settings.lastSelectedNodeKey = key;
  state.settings.lastSelectedNodeTag = tag;
  if (changed && options.persist !== false) scheduleSettingsPersist("last selected node");
  return changed;
}

async function migrateLastNodeBootstrap() {
  if (!state.paths.lastNodeBootstrap) return false;
  const raw = await readTextIfExists(state.paths.lastNodeBootstrap);
  if (!raw) return false;
  let bootstrap = null;
  try { bootstrap = JSON.parse(raw); }
  catch {
    log("Last-node bootstrap is invalid; leaving it untouched");
    return false;
  }
  if (state.settings.lastSelectedNodeTag) {
    await removeFileIfExists(state.paths.lastNodeBootstrap);
    return false;
  }
  const tag = String(bootstrap && bootstrap.tag || "").trim();
  const key = String(bootstrap && bootstrap.key || "").trim();
  if (!tag) {
    log("Last-node bootstrap has no node tag; leaving it untouched");
    return false;
  }
  state.settings.lastSelectedNodeKey = key;
  state.settings.lastSelectedNodeTag = tag;
  try {
    await persistSettingsFile();
    await removeFileIfExists(state.paths.lastNodeBootstrap);
    log(`Last selected node migrated from running v35 state: ${tag}`);
    return true;
  }
  catch (err) {
    log(`Last selected node migration failed: ${err.message || err}`);
    return false;
  }
}


async function removeFileIfExists(path) {
  if (!path) return;
  try {
    if (await access(path)) await Neutralino.filesystem.remove(path);
  }
  catch (err) {
    log(`Remove stale file failed: ${err.message || err}`);
  }
}

async function clearGeneratedRuntimeConfig() {
  if (!state.paths.work) return;
  const names = ["main.json", "main.yaml"];
  await Promise.all(names.map(async (name) => {
    const path = await Neutralino.filesystem.getJoinedPath(state.paths.work, name);
    await removeFileIfExists(path);
  }));
  log("Stale runtime core config cleared");
}

async function saveSettingsNow() {
  readSettingsFromForm();
  setSettingsSaveStatus("保存中...", "pending");
  await persistSettingsFile();
  setSettingsSaveStatus(`已保存 ${nowText()}`, "ok");
}

async function applyRuntimeSettings() {
  const mainControllerLive = await probeControllerLive(mainController(), MAIN_SECRET, 750).catch(() => false);
  const live = !!state.mainProcess || mainControllerLive;
  if (!live) return true;
  log("Runtime settings saved; running core and selected node unchanged, apply on next manual proxy start");
  if (Neutralino.os && typeof Neutralino.os.showNotification === "function") {
    await Neutralino.os.showNotification("Smart Proxy：配置已保存",
      "当前代理不会重启，配置将在下次手动启动代理时生效").catch(() => {});
  }
  return false;
}

function saveSettings(options = {}) {
  readSettingsFromForm();
  setSettingsSaveStatus("保存中...", "pending");
  Promise.resolve()
    .then(() => persistSettingsFile())
    .then(() => applyAutoStartSetting())
    .then(() => options.applyRuntime ? applyRuntimeSettings() : null)
    .then(() => syncContinuousCompetition("settings-saved"))
    .then(() => syncSiteFailoverState("settings-saved"))
    .then(() => {
      setSettingsSaveStatus(`已保存 ${nowText()}`, "ok");
      log("Settings saved");
    })
    .catch((err) => {
      const reason = err && (err.message || err);
      setSettingsSaveStatus("保存失败", "bad");
      log(`Settings save failed: ${reason || "unknown error"}`);
    });
  setStatus();
}

function saveSettingsFileOnly() {
  readSettingsFromForm();
  return persistSettingsFile()
    .then(() => {
      setSettingsSaveStatus(`已保存 ${nowText()}`, "ok");
      log("Settings saved");
    })
    .catch((err) => {
      setSettingsSaveStatus("保存失败", "bad");
      log(`Settings save failed: ${err.message || err}`);
      throw err;
    })
    .finally(() => {
      setStatus();
    });
}

async function loadSettings() {
  state.settingsLoaded = false;
  let saved = {};
  let loadedFromFile = false;
  try {
    if (!state.paths.settings || !state.paths.data) throw new Error("Missing settings paths");
    // A successful parent listing distinguishes a new install from access/read
    // failure; access() deliberately collapses errors and must not be used here.
    const entries = await Neutralino.filesystem.readDirectory(state.paths.data);
    const name = state.paths.settings.replace(/\\/g, "/").split("/").pop();
    if (entries.some(entry => entry.entry === name)) {
      saved = JSON.parse(await readPortableTextFile(state.paths.settings));
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) throw new Error("Invalid settings object");
      loadedFromFile = true;
    } else log("Settings file absent in readable data directory; initializing a new installation");
  }
  catch (err) {
    // JSON parser messages may contain subscription credentials. Log only the
    // error code/type, never the source text; do not replace it with defaults.
    log(`Settings load failed (${err.code || err.name || "read error"}); file retained and writes blocked`);
    throw new Error("Settings load failed; existing file retained (no default overwrite)");
  }
  state.settings = SmartProxyConfig.mergeSettingsWithDefaultMigration(saved, DEFAULT_SETTINGS);
  const migration = SmartProxyConfig.migrateSettingsForAppVersion(state.settings, {
    currentVersion: APP_CONFIG_VERSION,
    runtimePath: state.paths.work,
    defaults: DEFAULT_SETTINGS
  });
  state.settings = migration.settings;
  delete state.settings.coreType;
  delete state.settings.corePath;
  ["singBoxPath", "configPath"].forEach((key) => {
    state.settings[key] = SmartProxyConfig.resolveConfiguredPath({
      configuredPath: state.settings[key],
      appRoot: state.paths.appRoot,
      dataDirName: PORTABLE_DATA_DIR
    });
  });
  normalizeSubscriptionSettings();
  if (!Array.isArray(state.settings.customRules)) state.settings.customRules = [];
  normalizeCustomRuleDefaults();
  normalizeNodeGroupRules();
  hydrateCodexProbeResults();
  const portableCorePathsChanged = await ensureDefaultCorePaths();
  writeSettingsToForm();
  state.settingsLoaded = true;
  await migrateLastNodeBootstrap();
  if (migration.clearRuntime) await clearGeneratedRuntimeConfig();
  if (!loadedFromFile || migration.changed || portableCorePathsChanged) {
    await persistSettingsFile().catch((err) => log(`Migrate settings file failed: ${err.message || err}`));
    if (migration.changed) log(`Settings migrated to config version ${APP_CONFIG_VERSION}`);
    if (portableCorePathsChanged) log("Portable core paths rebased to this folder");
  }
}

function autoStartScript(enabled, exePath, launcherPath) {
  const body = enabled
    ? [
      `$exe=${psQuote(exePath || "")}`,
      `$launcher=${psQuote(launcherPath || "")}`,
      "$wscript=Join-Path $env:SystemRoot 'System32\\wscript.exe'",
      "if ($launcher -and (Test-Path -LiteralPath $launcher) -and (Test-Path -LiteralPath $wscript)) { $launcher=(Resolve-Path -LiteralPath $launcher).ProviderPath; $value=('\"' + $wscript + '\" \"' + $launcher + '\" --silent') } else { if (-not $exe) { throw 'Smart Proxy exe path not configured' }; $exe=(Resolve-Path -LiteralPath $exe).ProviderPath; if (-not (Test-Path -LiteralPath $exe)) { throw ('Smart Proxy exe not found: ' + $exe) }; $value=('\"' + $exe + '\" --silent --window-hidden=true') }",
      "Set-ItemProperty -Path $run -Name $name -Value $value"
    ].join("; ")
    : "Remove-ItemProperty -Path $run -Name $name -ErrorAction SilentlyContinue";
  return [
    "$ErrorActionPreference='Stop'",
    "$run='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'",
    "$name='SmartProxyClientMultiSub'",
    body
  ].join("; ");
}

async function applyAutoStartSetting() {
  if (isIsolationTestMode()) {
    log("Auto start update skipped in isolated test mode");
    return;
  }
  const ps = autoStartScript(!!state.settings.autoStartSilent, state.paths.appExe, state.paths.launcher);
  await Neutralino.os.execCommand(buildPowerShellExecCommand(ps));
}

async function getCurrentAppProcess() {
  const exe = state.paths.appExe || "";
  const nativePid = Number(window.NL_PID || 0);
  if (nativePid > 0) return { pid: String(nativePid), exe };
  const ps = [
    "$ErrorActionPreference='Stop'",
    `$exe=${psQuote(exe)}`,
    "$exe=(Resolve-Path -LiteralPath $exe).ProviderPath",
    "$current=Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $exe } | Sort-Object CreationDate -Descending | Select-Object -First 1",
    "if (-not $current) { throw 'current app process not found' }",
    "Write-Output ($current.ProcessId.ToString() + '|' + $current.ExecutablePath)"
  ].join("\n");
  const res = await Neutralino.os.execCommand(buildPowerShellExecCommand(ps));
  if (res.exitCode !== 0 && res.exitCode !== undefined) {
    throw new Error((res.stdErr || res.stdOut || "").trim() || `exit ${res.exitCode}`);
  }
  const parts = String(res.stdOut || "").trim().split("|");
  return { pid: parts[0] || "", exe: parts.slice(1).join("|") || "" };
}

async function isLockedInstanceAlive(lock, self) {
  if (!lock || !lock.pid || !lock.exe || String(lock.pid) === String(self.pid)) return false;
  const ps = [
    "$ErrorActionPreference='SilentlyContinue'",
    `$pidValue=${Number(lock.pid) || 0}`,
    `$exe=${psQuote(lock.exe)}`,
    "$exe=(Resolve-Path -LiteralPath $exe).ProviderPath",
    "$p=Get-CimInstance Win32_Process -Filter \"ProcessId=$pidValue\"",
    "if ($p -and $p.ExecutablePath -and $p.ExecutablePath.ToLowerInvariant() -eq $exe.ToLowerInvariant()) { Write-Output 'alive' } else { Write-Output 'dead' }"
  ].join("\n");
  const res = await Neutralino.os.execCommand(buildPowerShellExecCommand(ps));
  return String(res.stdOut || "").trim() === "alive";
}

function instanceCommandToken() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readInstanceJson(path) {
  if (!path) return null;
  try {
    return JSON.parse(await readPortableTextFile(path));
  }
  catch {
    return null;
  }
}

async function waitForInstanceAck(token, timeoutMs = INSTANCE_ACK_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ack = await readInstanceJson(state.paths.instanceAck);
    if (ack && ack.token === token) return !!ack.ok;
    await sleep(INSTANCE_ACK_POLL_MS);
  }
  return false;
}

async function signalPrimaryInstance(reason) {
  if (!state.paths.instanceSignal || !state.paths.instanceAck) return false;
  const token = instanceCommandToken();
  await Neutralino.filesystem.writeFile(
    state.paths.instanceSignal,
    JSON.stringify({ token, action: "show", at: Date.now(), reason: reason || "duplicate-start" })
  );
  return await waitForInstanceAck(token, INSTANCE_ACK_TIMEOUT_MS);
}

async function terminateProcessByPid(pid) {
  const target = Number(pid || 0);
  if (target <= 0) return false;
  const result = await Neutralino.os.execCommand(`taskkill /PID ${target} /T /F`);
  await sleep(INSTANCE_TAKEOVER_WAIT_MS);
  return result.exitCode === 0 || result.exitCode === undefined;
}

async function terminateLockedInstance(lock) {
  return await terminateProcessByPid(lock && lock.pid);
}

async function ensureSingleInstanceOrExit() {
  const self = await getCurrentAppProcess().catch((err) => {
    log(`Instance check skipped: ${err.message || err}`);
    return null;
  });
  if (!self || !state.paths.instanceLock) return true;

  const lock = await readInstanceJson(state.paths.instanceLock);
  const handoffArg = (window.NL_ARGS || []).find(arg => /^--handoff-from-pid=\d+$/.test(arg));
  if (handoffArg) {
    if (Number(lock?.pid) === Number(self.pid)) {
      // NL_ARGS survive WebView reload. This process already owns the lock;
      // the old one-shot handoff argument must not run a second takeover.
      state.handoffFromPid = 0;
      state.instanceIdentity = { pid: String(self.pid), exe: self.exe };
      log("UI handoff already completed; reloading current owner without takeover");
      return true;
    }
    const previousPid = Number(handoffArg.split("=")[1]);
    if (!lock || Number(lock.pid) !== previousPid || previousPid === Number(self.pid)) throw new Error("UI handoff rejected: previous owner does not match lock");
    state.handoffFromPid = previousPid;
    state.instanceIdentity = { pid: String(self.pid), exe: self.exe };
    log(`UI handoff candidate for ${previousPid}; old UI and core left running until readiness`);
    return true;
  }

  if (await isLockedInstanceAlive(lock, self).catch(() => false)) {
    const acknowledged = await signalPrimaryInstance("duplicate-start").catch(() => false);
    if (acknowledged) {
      await terminateProcessByPid(self.pid);
      return false;
    }
    log(`Primary instance ${lock.pid} did not acknowledge; taking over`);
    if (await isLockedInstanceAlive(lock, self).catch(() => false)) {
      await terminateLockedInstance(lock);
    }
  }

  state.instanceIdentity = { pid: String(self.pid), exe: self.exe };
  await Neutralino.filesystem.writeFile(
    state.paths.instanceLock,
    JSON.stringify({ ...state.instanceIdentity, at: Date.now() })
  );
  return true;
}

async function startInstanceSignalWatcher() {
  if (!state.paths.instanceSignal || state.instanceSignalTimer) return;
  const initial = await readInstanceJson(state.paths.instanceSignal);
  state.instanceSignalLast = initial && initial.token || "";
  log(`Instance signal watcher started: ${state.paths.instanceSignal} (last=${state.instanceSignalLast || "none"})`);
  state.instanceSignalTimer = setInterval(async () => {
    if (state.instanceSignalBusy || state.closing) return;
    state.instanceSignalBusy = true;
    try {
      const command = await readInstanceJson(state.paths.instanceSignal);
      if (!command || !command.token) {
        if (!state.instanceSignalReadWarned) {
          state.instanceSignalReadWarned = true;
          const raw = await readTextIfExists(state.paths.instanceSignal).catch(() => "");
          log(`Instance signal unreadable (once): len=${String(raw || "").length} head=${String(raw || "").slice(0, 40)}`);
        }
        return;
      }
      if (command.token === state.instanceSignalLast) return;
      state.instanceSignalLast = command.token;
      let ok = false;
      try {
        if (command.action === "health") ok = !!(state.uiReady && state.mainCoreReady && state.mainProcess);
        else if (command.action === "show") ok = await requestMainWindowShow("instance-command");
        else if (command.action === "reload-hidden") {
          ok = state.uiReady && state.settingsLoaded;
          if (ok) setTimeout(() => reloadAppSurface("instance-command", { hidden: true }), 250);
          else log("Hidden reload command declined: UI/settings not ready");
        }
        else log(`Instance command ignored: unsupported action ${String(command.action).slice(0, 80)}`);
      }
      catch (err) {
        log(`Instance command failed: ${err.message || err}`);
      }
      await Neutralino.filesystem.writeFile(
        state.paths.instanceAck,
        JSON.stringify({ token: command.token, ok, at: Date.now(), pid: Number(state.instanceIdentity?.pid || 0),
          build: APP_BUILD_ID, coreReady: !!state.mainCoreReady, node: state.currentNode,
          settingsLoaded: state.settingsLoaded, subscriptions: state.settings.subscriptions.length,
          siteFailoverEnabled: state.settings.siteFailoverEnabled, siteFailoverLogReady: state.siteFailoverLogReady })
      );
    }
    catch (err) {
      log(`Instance signal poll failed: ${err.message || err}`);
      return;
    }
    finally {
      state.instanceSignalBusy = false;
    }
  }, INSTANCE_SIGNAL_POLL_MS);
}

function isSilentStartup() {
  return Array.isArray(window.NL_ARGS) && window.NL_ARGS.includes("--silent");
}

function isIsolationTestMode() {
  return Array.isArray(window.NL_ARGS) && window.NL_ARGS.includes("--isolated-test");
}

function isWindowReadyVerificationMode() {
  return isIsolationTestMode()
    && Array.isArray(window.NL_ARGS)
    && window.NL_ARGS.includes("--verify-window-ready");
}

function isolatedCodexBulkVerificationLimit() {
  if (!isIsolationTestMode() || !Array.isArray(window.NL_ARGS)) return 0;
  const prefix = "--verify-wss-bulk-limit=";
  const argument = window.NL_ARGS.find((item) => String(item).startsWith(prefix));
  if (!argument) return 0;
  return Math.min(3, Math.max(1, Math.trunc(Number(String(argument).slice(prefix.length)) || 1)));
}

function isolatedContinuousVerificationLimit() {
  if (!isIsolationTestMode() || !Array.isArray(window.NL_ARGS)) return 0;
  const prefix = "--verify-continuous-wss-limit=";
  const argument = window.NL_ARGS.find((item) => String(item).startsWith(prefix));
  if (!argument) return 0;
  return Math.min(3, Math.max(1, Math.trunc(Number(String(argument).slice(prefix.length)) || 1)));
}

function shouldStartProxyOnBoot() {
  const directStart = Array.isArray(window.NL_ARGS) && window.NL_ARGS.includes("--start-proxy");
  return directStart || (isSilentStartup() && !!state.settings.autoStartSilent);
}

async function ensureDirectory(path) {
  try {
    await Neutralino.filesystem.createDirectory(path);
  }
  catch {
    return;
  }
}

async function access(path) {
  try {
    await Neutralino.filesystem.getStats(path);
    return true;
  }
  catch {
    return false;
  }
}

async function readPortableTextFile(path) {
  const bytes = await Neutralino.filesystem.readBinaryFile(path);
  return SmartProxyConfig.decodePortableTextBytes(bytes);
}

async function seedBundledPrivateConfig() {
  let manifest;
  try {
    manifest = JSON.parse(await Neutralino.resources.readFile(BUNDLED_PRIVATE_CONFIG_MANIFEST));
  }
  catch (err) {
    log(`Bundled seed manifest unavailable; existing local configuration retained: ${err.message || err}`);
    return;
  }
  if (manifest.privateSeedsIncluded === false) log("Public-safe build: no personal configuration embedded; loading existing local user files");

  const roots = {
    app: state.paths.appRoot,
    data: state.paths.data,
    runtime: state.paths.work
  };
  for (const item of Array.isArray(manifest.files) ? manifest.files : []) {
    const root = roots[item.scope];
    const name = String(item.name || "").trim();
    const source = String(item.source || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!root || !name || !source || /[\\\\/]/.test(name)) continue;
    const target = await Neutralino.filesystem.getJoinedPath(root, name);
    if (await access(target)) continue;
    try {
      await Neutralino.resources.extractFile(`/resources/private-config/files/${source}`, target);
      log(`Bundled private config restored: ${item.scope}/${name}`);
    }
    catch (err) {
      log(`Bundled private config restore failed (${item.scope}/${name}): ${err.message || err}`);
    }
  }
}

function currentCoreKind() {
  return "sing-box";
}

function defaultCorePath() {
  return state.paths.bundledSingBox;
}

function corePathForKind() {
  return state.settings.singBoxPath || state.paths.bundledSingBox;
}

function setCorePathForKind(kind, path) {
  state.settings.singBoxPath = path;
  writeSettingsToForm();
}

async function extractBundledCore() {
  const target = state.paths.bundledSingBox;
  const direct = await Neutralino.filesystem.getJoinedPath(state.paths.appRoot, "resources", "bin", "sing-box.exe");
  if (await access(direct)) {
    await removeFileIfExists(target);
    await Neutralino.filesystem.copy(direct, target);
  }
  else {
    try {
      await Neutralino.resources.extractFile("/resources/bin/sing-box.exe", target);
    }
    catch {
      await Neutralino.resources.extractFile("/bin/sing-box.exe", target);
    }
  }
  setCorePathForKind("sing-box", target);
  return target;
}

async function initPaths() {
  const appRoot = window.NL_PATH || await Neutralino.filesystem.getAbsolutePath(".");
  state.paths.appRoot = appRoot;
  state.paths.data = SmartProxyConfig.resolvePortableDataRoot({
    appPath: appRoot,
    dataDirName: PORTABLE_DATA_DIR
  });
  state.paths.work = await Neutralino.filesystem.getJoinedPath(state.paths.data, "runtime");
  state.paths.settings = await Neutralino.filesystem.getJoinedPath(state.paths.data, "settings.json");
  state.paths.appExe = await Neutralino.filesystem.getJoinedPath(appRoot, "smart-proxy-client-win_x64.exe");
  state.paths.launcher = await Neutralino.filesystem.getJoinedPath(appRoot, "smart-proxy-launcher.vbs");
  state.paths.instanceLock = await Neutralino.filesystem.getJoinedPath(state.paths.work, "app-instance.lock");
  state.paths.instanceSignal = await Neutralino.filesystem.getJoinedPath(state.paths.work, "show-window.signal");
  state.paths.instanceAck = await Neutralino.filesystem.getJoinedPath(state.paths.work, "show-window.ack");
  state.paths.lastNodeBootstrap = await Neutralino.filesystem.getJoinedPath(state.paths.work, "last-node-bootstrap.json");
  state.paths.appLog = await Neutralino.filesystem.getJoinedPath(state.paths.work, "smart-proxy.log");
  state.paths.bundledSingBox = await Neutralino.filesystem.getJoinedPath(state.paths.data, "sing-box.exe");
  await ensureDirectory(state.paths.data);
  await ensureDirectory(state.paths.work);
  await ensureDefaultCorePaths();
  writeSettingsToForm();
}

async function pickConfig() {
  const files = await Neutralino.os.showOpenDialog("选择 Clash/Mihomo YAML", {
    multiSelections: false,
    filters: [{ name: "YAML", extensions: ["yaml", "yml"] }]
  });
  const selectedPath = files && files[0];
  if (!selectedPath) return;

  let localYamlConfig = null;
  try {
    localYamlConfig = validateSubscriptionText(
      await readPortableTextFile(selectedPath),
      "离线 YAML"
    );
  }
  catch (err) {
    if ($("subscriptionStatus")) $("subscriptionStatus").textContent = "离线 YAML 无效，未加入节点池";
    log(`Offline YAML rejected without changing node pool: ${err.message || err}`);
    return;
  }

  const wasLive = !!state.mainProcess
    || await probeControllerLive(mainController(), MAIN_SECRET, 700).catch(() => false);
  state.settings.configPath = selectedPath;
  writeSettingsToForm();
  try {
    await persistSettingsFile();
    await refreshSubscriptionNodeCatalog({ localYamlConfig });
    renderProxyNodes();
    setStatus();
    if (wasLive) await applyRuntimeSettings();
    const nodeCount = getCandidateNodes(localYamlConfig).length;
    if ($("subscriptionStatus")) $("subscriptionStatus").textContent = `离线 YAML 已加入节点池（${nodeCount} 个节点）`;
    log(`Offline YAML node source added: ${selectedPath} (${nodeCount} node(s))`);
  }
  catch (err) {
    if ($("subscriptionStatus")) $("subscriptionStatus").textContent = "离线 YAML 已保存，但节点池应用失败";
    log(`Offline YAML node source apply failed: ${err.message || err}`);
  }
}

async function pickCore() {
  const files = await Neutralino.os.showOpenDialog("选择 sing-box.exe", {
    multiSelections: false,
    filters: [{ name: "Executable", extensions: ["exe"] }]
  });
  if (files && files[0]) {
    state.settings.singBoxPath = files[0];
    writeSettingsToForm();
    saveSettings();
  }
}

function isSingBoxCore() {
  return true;
}

function selectedCorePath() {
  return state.settings.singBoxPath;
}

async function subscriptionCachePathFor(profile) {
  const names = SmartProxyConfig.subscriptionCacheFileNames(profile);
  return Neutralino.filesystem.getJoinedPath(state.paths.work, names.config);
}

async function subscriptionCacheSourcePathFor(profile) {
  return (await subscriptionCachePathFor(profile)) + ".source-url.txt";
}

async function subscriptionHeadersCachePathFor(profile) {
  const names = SmartProxyConfig.subscriptionCacheFileNames(profile);
  return Neutralino.filesystem.getJoinedPath(state.paths.work, names.headers);
}

async function subscriptionCachePath() {
  return subscriptionCachePathFor(activeSubscription());
}

async function subscriptionHeadersCachePath() {
  return subscriptionHeadersCachePathFor(activeSubscription());
}

async function subscriptionDownloadTempPaths() {
  return {
    config: await Neutralino.filesystem.getJoinedPath(state.paths.work, "subscription.download.tmp.yaml"),
    headers: await Neutralino.filesystem.getJoinedPath(state.paths.work, "subscription.download.tmp.headers.txt")
  };
}

async function readTextIfExists(path) {
  try {
    if (path && await access(path)) return await readPortableTextFile(path);
  }
  catch {
    return "";
  }
  return "";
}

function nodeCodexResultForEntry(entry) {
  return state.nodeCodexResults.get(entry.key) || null;
}

function validateSubscriptionText(text, label) {
  let config = null;
  try {
    config = jsyaml.load(String(text || ""));
  }
  catch (err) {
    throw new Error(`${label} YAML parse failed: ${err.message || err}`);
  }
  if (!SmartProxyConfig.subscriptionConfigHasNodes(config)) {
    throw new Error(`${label} has no proxy nodes`);
  }
  return config;
}

function subscriptionNodeKey(profile, node) {
  return `${String(profile && profile.id || "default")}::${encodeURIComponent(String(node || ""))}`;
}

function offlineYamlSourceName(path) {
  const fileName = String(path || "").split(/[\\/]/).filter(Boolean).pop();
  return fileName ? `离线 YAML · ${fileName}` : "离线 YAML";
}

async function removeOfflineYamlSource() {
  if (state.subscriptionBusy || state.codexProbeRunning) throw new Error("请先停止测速或等待订阅操作完成");
  const previousPath = state.settings.configPath;
  if (!previousPath) return false;
  if (!window.confirm("移除离线 YAML 来源？原 YAML 文件会保留，当前代理不会重启或切换节点。")) return false;
  state.settings.configPath = "";
  try {
    await persistSettingsFile();
    await refreshSubscriptionNodeCatalog();
  } catch (err) {
    state.settings.configPath = previousPath;
    await persistSettingsFile().catch(saveError => log(`Restore offline source failed: ${saveError.message || saveError}`));
    throw err;
  }
  writeSettingsToForm(); renderProxyNodes(); setStatus();
  log("Offline YAML source removed; original file retained, running core unchanged until next manual start");
  return true;
}

async function readOfflineYamlSource(options = {}) {
  const sourcePath = String(state.settings.configPath || "").trim();
  if (!sourcePath) return null;
  try {
    const hasConfigOverride = Object.prototype.hasOwnProperty.call(options, "localYamlConfig");
    let config = hasConfigOverride ? options.localYamlConfig : null;
    if (!config) {
      const text = await readTextIfExists(sourcePath);
      if (!text) {
        log(`Offline YAML skipped (unavailable): ${sourcePath}`);
        return null;
      }
      config = validateSubscriptionText(text, "离线 YAML");
    }
    if (!SmartProxyConfig.subscriptionConfigHasNodes(config)) {
      throw new Error("离线 YAML has no proxy nodes");
    }
    return {
      id: LOCAL_YAML_SOURCE_ID,
      name: offlineYamlSourceName(sourcePath),
      config,
      nodeNames: getCandidateNodes(config),
      sourcePath
    };
  }
  catch (err) {
    log(`Offline YAML skipped without changing remote caches: ${err.message || err}`);
    return null;
  }
}

async function refreshSubscriptionNodeCatalog(options = {}) {
  const subscriptions = normalizeSubscriptionSettings();
  const activeId = state.settings.activeSubscriptionId;
  const hasActiveConfigOverride = Object.prototype.hasOwnProperty.call(options, "activeConfig");
  const activeConfig = hasActiveConfigOverride
    ? options.activeConfig
    : (state.sourceConfigSubscriptionId === activeId ? state.sourceConfig : null);
  const configs = new Map();
  const sources = [];

  for (const profile of subscriptions) {
    let config = profile.id === activeId ? activeConfig : null;
    if (!config) {
      let text = "";
      let cacheMatches = !profile.url || profile.cachedUrl === profile.url;
      if (!cacheMatches && profile.url) {
        const cachedSourceUrl = String(await readTextIfExists(await subscriptionCacheSourcePathFor(profile))).trim();
        if (cachedSourceUrl === profile.url) {
          cacheMatches = true;
          profile.cachedUrl = profile.url;
        }
      }
      if (cacheMatches) text = await readTextIfExists(await subscriptionCachePathFor(profile));
      if (!text) continue;
      try {
        config = validateSubscriptionText(text, `订阅 ${profile.name || profile.id} 缓存`);
      }
      catch (err) {
        log(`Subscription cache skipped (${profile.name || profile.id}): ${err.message || err}`);
        continue;
      }
    }
    configs.set(profile.id, config);
    sources.push({
      id: profile.id,
      name: profile.name || "默认订阅",
      config,
      nodeNames: getCandidateNodes(config)
    });
  }

  const offlineYamlSource = await readOfflineYamlSource(options);
  if (offlineYamlSource) {
    configs.set(LOCAL_YAML_SOURCE_ID, offlineYamlSource.config);
    sources.push(offlineYamlSource);
  }

  const merged = SmartProxyConfig.mergeSubscriptionConfigs(sources, {
    groupName: state.settings.targetGroup || DEFAULT_SETTINGS.targetGroup,
    baseConfig: activeConfig
      || configs.get(activeId)
      || (offlineYamlSource && offlineYamlSource.config)
      || state.sourceConfig
  });
  const catalog = merged.catalog.map((entry) => ({
    ...entry,
    key: entry.nodeId || subscriptionNodeKey({ id: entry.subscriptionId }, entry.tag)
  }));
  state.subscriptionConfigs = configs;
  state.mergedSourceConfig = merged.config;
  state.subscriptionNodeCatalog = catalog;
  state.nodes = catalog.map((entry) => entry.tag);
  if (configs.has(activeId)) {
    state.sourceConfig = configs.get(activeId);
    state.sourceConfigSubscriptionId = activeId;
  }
  else if (configs.has(LOCAL_YAML_SOURCE_ID)) {
    state.sourceConfig = configs.get(LOCAL_YAML_SOURCE_ID);
    state.sourceConfigSubscriptionId = LOCAL_YAML_SOURCE_ID;
  }
  const validKeys = new Set(catalog.map((entry) => entry.key));
  // Historical tok/s is durable state, not a catalog cache. A subscription may be
  // temporarily unavailable during startup, so never prune measurements here; a
  // later successful tok/s probe for the same stable key is the only overwrite.
  state.codexProbePendingKeys = new Set([...state.codexProbePendingKeys].filter((key) => validKeys.has(key)));
  if (state.codexProbeLastKey && !validKeys.has(state.codexProbeLastKey)) state.codexProbeLastKey = "";
  return catalog;
}

async function loadMergedCachedSubscriptionPoolForStartup() {
  // Rebuilding a catalog isn't proof the new configuration has started.
  const catalog = await refreshSubscriptionNodeCatalog({ activeConfig: null });
  const sourceCount = state.subscriptionConfigs.size;
  if (
    !sourceCount
    || !catalog.length
    || !SmartProxyConfig.subscriptionConfigHasNodes(state.mergedSourceConfig)
  ) {
    return false;
  }
  state.sourceConfig = state.mergedSourceConfig;
  state.sourceConfigSubscriptionId = "__merged-cache__";
  log(
    `Using merged cached subscription pool for core startup: ${sourceCount} source(s), ${catalog.length} node(s)`
  );
  return true;
}

async function runSubscriptionDownloadAttempt(options) {
  const temp = await subscriptionDownloadTempPaths();
  await Promise.all([removeFileIfExists(temp.config), removeFileIfExists(temp.headers)]);
  const cmd = SmartProxyConfig.buildSubscriptionCurlArgs({
    url: options.url,
    path: temp.config,
    headersPath: temp.headers,
    seconds: options.seconds,
    proxyUrl: options.proxyUrl
  }).map(quote).join(" ");
  log(`Downloading subscription (${options.label})`);
  const res = await Neutralino.os.execCommand(cmd, { cwd: state.paths.work });
  if (res.exitCode !== 0 && res.exitCode !== undefined) {
    throw new Error((res.stdErr || "").trim() || `${options.label} download failed`);
  }
  const configText = await readTextIfExists(temp.config);
  validateSubscriptionText(configText, options.label);
  return {
    configText,
    headersText: await readTextIfExists(temp.headers),
    source: options.label
  };
}

async function commitSubscriptionCache(download, path, headersPath) {
  const previousConfig = await readTextIfExists(path);
  const previousHeaders = await readTextIfExists(headersPath);
  try {
    await Neutralino.filesystem.writeFile(path, download.configText);
    await Neutralino.filesystem.writeFile(headersPath, download.headersText || "");
  }
  catch (err) {
    if (previousConfig) await Neutralino.filesystem.writeFile(path, previousConfig).catch(() => {});
    if (previousHeaders) await Neutralino.filesystem.writeFile(headersPath, previousHeaders).catch(() => {});
    throw err;
  }
}

async function downloadSubscription(options = {}) {
  state.subscriptionRefreshOutcome = null;
  const url = state.settings.subscriptionUrl.trim();
  if (!url) return "";
  const path = await subscriptionCachePath();
  const headersPath = await subscriptionHeadersCachePath();
  const failures = [];
  let downloaded = null;
  try {
    downloaded = await runSubscriptionDownloadAttempt({ url, label: "direct", seconds: 12 });
  }
  catch (err) {
    failures.push(`direct: ${err.message || err}`);
    log(`Subscription direct failed: ${err.message || err}`);
  }

  if (!downloaded) {
    const mainReady = !!state.mainProcess
      || await probeControllerLive(mainController(), MAIN_SECRET, 700).catch(() => false);
    if (mainReady) {
      try {
        downloaded = await runSubscriptionDownloadAttempt({
          url,
          label: "main proxy",
          seconds: 30,
          proxyUrl: `http://127.0.0.1:${state.settings.mainPort}`
        });
      }
      catch (err) {
        failures.push(`main proxy: ${err.message || err}`);
        log(`Subscription proxy fallback failed: ${err.message || err}`);
      }
    }
  }

  if (!downloaded) {
    const preservedText = await readTextIfExists(path);
    let preserved = false;
    try {
      validateSubscriptionText(preservedText, "Preserved cache");
      preserved = true;
    }
    catch {
      preserved = false;
    }
    if (preserved && options.allowPreservedCache) {
      state.subscriptionRefreshOutcome = {
        updated: false,
        preserved: true,
        source: "preserved-cache",
        error: failures.join(" | ")
      };
      log(`Using preserved subscription cache after refresh failure: ${path}`);
      await loadSubscriptionTraffic(path, headersPath);
      return path;
    }
    const error = `Subscription refresh failed${preserved ? "; previous cache preserved" : ""}: ${failures.join(" | ")}`;
    state.subscriptionRefreshOutcome = {
      updated: false,
      preserved,
      source: "error",
      error
    };
    throw new Error(error);
  }

  await commitSubscriptionCache(downloaded, path, headersPath);
  await Neutralino.filesystem.writeFile(await subscriptionCacheSourcePathFor(activeSubscription()), url);
  const temp = await subscriptionDownloadTempPaths();
  await Promise.all([removeFileIfExists(temp.config), removeFileIfExists(temp.headers)]);
  state.settings.cachedSubscriptionUrl = url;
  activeSubscription().cachedUrl = url;
  state.subscriptionRefreshOutcome = {
    updated: ["direct", "main proxy"].includes(downloaded.source),
    preserved: false,
    source: downloaded.source,
    error: failures.join(" | ")
  };
  await loadSubscriptionTraffic(path, headersPath);
  log(`Subscription downloaded via ${downloaded.source}: ${path}`);
  return path;
}

async function loadSubscriptionTraffic(configPath, headersPath) {
  const headerText = await readTextIfExists(headersPath || await subscriptionHeadersCachePath());
  const configText = await readTextIfExists(configPath);
  state.subscriptionTraffic = SmartProxyConfig.parseSubscriptionTraffic(`${headerText}\n${configText}`);
  if (state.subscriptionTraffic) {
    log(`Subscription traffic: ${state.subscriptionTraffic.remainingText} remaining / ${state.subscriptionTraffic.totalText} total`);
  }
  renderHomeTraffic();
  return state.subscriptionTraffic;
}

async function resolveSubscriptionConfigPath(options = {}) {
  const url = state.settings.subscriptionUrl.trim();
  if (!url) return "";
  const profile = activeSubscription();
  const path = await subscriptionCachePath();
  const headersPath = await subscriptionHeadersCachePath();
  const exists = await access(path);
  let startupCacheInvalid = false;
  if (exists && options.preferCache) {
    try {
      validateSubscriptionText(await readTextIfExists(path), "Startup cache");
      log(`Using cached subscription for core startup: ${path}`);
      await loadSubscriptionTraffic(path, headersPath);
      return path;
    }
    catch (err) {
      startupCacheInvalid = true;
      log(`Startup cache invalid, refresh required: ${err.message || err}`);
    }
  }
  if (options.cacheOnly) return "";
  if (SmartProxyConfig.shouldUseCachedSubscription({
    url,
    cachedUrl: profile.cachedUrl,
    exists,
    refresh: !!options.refreshUrl
  }) && !startupCacheInvalid) {
    try {
      validateSubscriptionText(await readTextIfExists(path), "Subscription cache");
      log(`Using cached subscription: ${path}`);
      await loadSubscriptionTraffic(path, headersPath);
      return path;
    }
    catch (err) {
      log(`Subscription cache invalid, refresh required: ${err.message || err}`);
    }
  }
  return downloadSubscription({
    allowPreservedCache: !!options.allowPreservedCache
  });
}

async function runCoreManager(action) {
  const script = await bundledProbeScriptPath("core-manager.ps1", "Core updater");
  const config = await Neutralino.filesystem.getJoinedPath(state.paths.work, "main.json");
  const command = `& ${psQuote(script)} -Action ${action} -DestinationDir ${psQuote(state.paths.data)} -WorkDir ${psQuote(state.paths.work)} -ConfigPath ${psQuote(config)}; exit $LASTEXITCODE`;
  const res = await Neutralino.os.execCommand(buildPowerShellExecCommand(command), { cwd: state.paths.work });
  if (res.stdErr?.trim()) log(`Core updater: ${res.stdErr.trim().slice(0, 1200)}`);
  if (Number(res.exitCode) !== 0) throw new Error(String(res.stdErr || "内核更新进程失败").trim().slice(0, 600));
  const info = JSON.parse(String(res.stdOut || "{}").trim());
  if (!info.latest || (action === "Install" && (!info.path || !info.sha256))) throw new Error("内核更新未返回完整校验结果");
  return info;
}

function coreOperationStatus(text, mode = "") {
  if ($("coreVersionStatus")) { $("coreVersionStatus").textContent = text; $("coreVersionStatus").setAttribute?.("data-state", mode); }
  setCoreUpdateHint(mode === "error" ? "更新失败" : mode === "done" ? "已检查" : "检查中", mode === "error" ? "show" : "busy", text);
  for (const id of ["checkCoreBtn", "downloadSingBoxBtn", "pickCoreBtn"]) if ($(id)) $(id).disabled = state.coreUpdateRunning;
}

function setCoreUpdateHint(text, mode, title) {
  const hint = $("coreUpdateHint");
  if (!hint) return;
  hint.textContent = text || "";
  hint.title = title || "";
  hint.className = `core-update-hint ${mode || ""}`.trim();
}

function coreLocalInfoScript(kind, corePath) {
  return [
    "$ErrorActionPreference='Stop'",
    `$corePath=${psQuote(corePath || "")}`,
    "$exists=Test-Path -LiteralPath $corePath",
    "$local=if ($exists) { try { (& $corePath version 2>$null | Select-Object -First 1) } catch { 'invalid' } } else { 'missing' }",
    "if ($exists -and -not $local) { $local='invalid' }",
    "[pscustomobject]@{kind='sing-box';local=$local;exists=$exists;path=$corePath} | ConvertTo-Json -Compress"
  ].join("; ");
}

async function getCoreLocalInfo(kind, corePath) {
  const ps = coreLocalInfoScript(kind, corePath);
  const res = await Neutralino.os.execCommand(buildPowerShellExecCommand(ps), { cwd: state.paths.work });
  if (res.exitCode !== 0 && res.exitCode !== undefined) {
    return { kind, local: "invalid", exists: await access(corePath), path: corePath };
  }
  return JSON.parse(String(res.stdOut || "{}").trim() || "{}");
}

async function getCoreVersionInfo(kind, corePath) {
  const local = await getCoreLocalInfo(kind, corePath);
  return { ...local, ...await runCoreManager("Check") };
}

function renderCoreUpdateState(kind, info, status) {
  if (status.status === "update") {
    setCoreUpdateHint("可更新", "show", `${kind} ${status.localVersion || "unknown"} -> ${status.latestVersion}`);
    log(`${kind} core update available: ${status.localVersion || "unknown"} -> ${status.latestVersion}`);
    return;
  }
  setCoreUpdateHint("", "", "");
  if (status.status === "latest") log(`${kind} core is latest: ${status.latestVersion}`);
  else log(`${kind} core version state: ${status.status}, local=${info.local || "-"}, latest=${info.latest || "-"}`);
}

async function ensureSelectedCoreReady(options = {}) {
  if (state.coreCheckRunning) return;
  state.coreCheckRunning = true;
  const autoRepairMissing = options.autoRepairMissing !== false;
  const checkLatest = options.checkLatest === true;
  const kind = currentCoreKind();
  let corePath = corePathForKind(kind);
  setCorePathForKind(kind, corePath || defaultCorePath(kind));
  corePath = corePathForKind(kind);
  setCoreUpdateHint("检查中", "busy", `检查 ${kind} 内核版本`);
  try {
    let localInfo = await getCoreLocalInfo(kind, corePath);
    const repairAction = SmartProxyConfig.coreRepairAction(localInfo);
    if (repairAction === "extract_bundled" && autoRepairMissing) {
      if (localInfo.exists) {
        log(`${kind} core invalid, extracting bundled core`);
        await Neutralino.filesystem.remove(corePath).catch(() => null);
      }
      else {
        log(`${kind} core missing, extracting bundled core`);
      }
      setCoreUpdateHint("安装中", "busy", `${kind} 内核不存在，正在使用内置内核`);
      await extractBundledCore(kind);
      corePath = corePathForKind(kind);
      localInfo = await getCoreLocalInfo(kind, corePath);
    }
    else if (repairAction === "extract_bundled" && localInfo.exists) {
      log(`${kind} core invalid`);
      await Neutralino.filesystem.remove(corePath).catch(() => null);
    }
    if (!(await access(corePath))) {
      setCoreUpdateHint("缺失", "show", `${kind} 内核不存在`);
      log(`${kind} core missing`);
      return;
    }
    if (!checkLatest) {
      const localVersion = SmartProxyConfig.normalizeCoreVersion(localInfo.local) || localInfo.local || "unknown";
      setCoreUpdateHint("", "", "");
      log(`${kind} core ready: ${localVersion}`);
      return;
    }
    const info = await getCoreVersionInfo(kind, corePath);
    renderCoreUpdateState(kind, info, SmartProxyConfig.coreUpdateStatus(info));
  }
  catch (err) {
    setCoreUpdateHint("", "", "");
    log(`Core startup check failed: ${err.message || err}`);
  }
  finally {
    state.coreCheckRunning = false;
  }
}

async function downloadCoreLatest() {
  if (state.coreUpdateRunning) { log("Core install skipped: update operation already running"); return; }
  state.coreUpdateRunning = true;
  const previousPath = state.settings.singBoxPath;
  coreOperationStatus("正在独立下载稳定版并校验官方 SHA256（最多 180 秒；官方受限时使用校验镜像）…");
  log("Core update: official direct download; running core and installed files untouched");
  try {
    const info = await runCoreManager("Install");
    state.settings.singBoxPath = info.path;
    try { await persistSettingsFile(); }
    catch (error) { state.settings.singBoxPath = previousPath; throw error; }
    writeSettingsToForm();
    const message = `已安装 ${info.latest}，官方 SHA256 校验通过${info.source ? ` · ${info.source}` : ""}；下次手动启动代理生效，当前内核未重启`;
    coreOperationStatus(message, "done"); log(message);
    return info;
  } catch (error) {
    coreOperationStatus(`更新失败，原内核保留：${error.message || error}`, "error");
    log(`Core update failed: ${error.message || error}`);
    throw error;
  } finally {
    state.coreUpdateRunning = false;
    for (const id of ["checkCoreBtn", "downloadSingBoxBtn", "pickCoreBtn"]) if ($(id)) $(id).disabled = false;
  }
}

async function checkCoreVersions() {
  if (state.coreUpdateRunning) { log("Core check skipped: update operation already running"); return; }
  state.coreUpdateRunning = true;
  let localVersion = "未检查";
  coreOperationStatus("正在检查本地与官方稳定版（联网最多 20 秒）…");
  try {
    const local = await getCoreLocalInfo("sing-box", selectedCorePath());
    localVersion = SmartProxyConfig.normalizeCoreVersion(local.local) || local.local;
    const remote = await runCoreManager("Check");
    const status = SmartProxyConfig.coreUpdateStatus({ ...local, ...remote });
    let running = "未启动";
    if (state.mainCoreReady) {
      try { running = (await api(mainController(), MAIN_SECRET, "/version")).version || "未知"; }
      catch (error) { running = "查询失败"; log(`Running core version read failed: ${error.message || error}`); }
    }
    const message = `运行中 ${running} · 已选择 ${localVersion} · 官方 ${remote.latest} · ${status.status === "latest" ? "已是最新版" : status.status === "update" ? "可下载更新" : "请检查本地内核"}`;
    coreOperationStatus(message, "done"); log(message);
    return { ...local, ...remote };
  } catch (error) {
    coreOperationStatus(`已选择 ${localVersion} · 检查失败：${error.message || error}`, "error");
    log(`Core version check failed: ${error.message || error}`); throw error;
  } finally {
    state.coreUpdateRunning = false;
    for (const id of ["checkCoreBtn", "downloadSingBoxBtn", "pickCoreBtn"]) if ($(id)) $(id).disabled = false;
  }
}

function compileRegex(pattern, fallback) {
  if (!pattern) return fallback;
  try {
    return new RegExp(pattern, "i");
  }
  catch (err) {
    log(`Regex invalid: ${pattern} / ${err.message}`);
    return fallback;
  }
}

function getCandidateNodes(config = state.sourceConfig) {
  const include = compileRegex(state.settings.includeRegex, /.*/i);
  const exclude = compileRegex(state.settings.excludeRegex, /$^/);
  const proxies = (config && config.proxies) || [];
  let names = proxies
    .map((p) => p && p.name)
    .filter(Boolean)
    .filter((name) => include.test(name))
    .filter((name) => !exclude.test(name));

  if (!names.length) {
    names = proxies
      .map((p) => p && p.name)
      .filter(Boolean)
      .filter((name) => !exclude.test(name));
  }

  const seen = new Set();
  return names.filter((name) => {
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  }).slice(0, Math.max(1, state.settings.maxNodes));
}

async function loadSourceConfig(options = {}) {
  if (!options.skipFormRead) readSettingsFromForm();
  const mode = SmartProxyConfig.sourceMode(state.settings);
  let configPath = mode === "url" ? "" : state.settings.configPath;
  if (mode === "url" && options.preferCache) {
    configPath = await resolveSubscriptionConfigPath({ ...options, cacheOnly: true });
    if (!configPath && await loadMergedCachedSubscriptionPoolForStartup()) {
      writeSettingsToForm();
      log(`Loaded merged cache config: ${state.nodes.length} candidate nodes`);
      return true;
    }
    if (!configPath && options.localOnly) return false;
  }
  if (mode === "url" && !configPath) {
    configPath = await resolveSubscriptionConfigPath({
      ...options,
      preferCache: false,
      cacheOnly: false
    });
  }
  if (!configPath) throw new Error("先填写订阅 URL 或选择 YAML 配置文件");
  const text = await readPortableTextFile(configPath);
  state.sourceConfig = jsyaml.load(text) || {};
  state.sourceConfigSubscriptionId = mode === "url"
    ? activeSubscription().id
    : LOCAL_YAML_SOURCE_ID;
  if (mode === "url") {
    writeSettingsToForm();
    await persistSettingsFile();
  }
  state.nodes = getCandidateNodes();
  if (mode === "url") {
    await refreshSubscriptionNodeCatalog({ activeConfig: state.sourceConfig });
  }
  else {
    await refreshSubscriptionNodeCatalog({
      activeConfig: null,
      localYamlConfig: state.sourceConfig
    });
  }
  log(`Loaded ${mode} config: ${state.nodes.length} candidate nodes`);
  return true;
}

async function refreshSubscription() {
  if (state.subscriptionBusy || state.autoRecoverBusy) { log("Manual subscription refresh skipped: another refresh is running"); return; }
  const button = $("refreshSubBtn");
  const previous = {
    sourceConfig: state.sourceConfig,
    mergedSourceConfig: state.mergedSourceConfig,
    sourceConfigSubscriptionId: state.sourceConfigSubscriptionId,
    nodes: state.nodes,
    subscriptionConfigs: state.subscriptionConfigs,
    subscriptionNodeCatalog: state.subscriptionNodeCatalog,
    traffic: state.subscriptionTraffic
  };
  const wasLive = !!state.mainProcess
    || await probeControllerLive(mainController(), MAIN_SECRET, 700).catch(() => false);
  setSubscriptionBusy(true, "正在更新当前订阅...");
  if (button) button.textContent = "更新中...";
  try {
    syncSubscriptionInputs("homeSubscriptionUrl");
    await saveSubscriptionProfile({ quiet: true });
    state.subscriptionRefreshOutcome = null;
    state.sourceConfig = null;
    await loadSourceConfig({ refreshUrl: true, allowPreservedCache: true });
    const outcome = state.subscriptionRefreshOutcome || {
      updated: true,
      preserved: false,
      source: "subscription"
    };
    await persistSettingsFile();
    if (wasLive) {
      // Newly downloaded files are staged; don't label old running routes with new node identities.
      state.sourceConfig = previous.sourceConfig; state.mergedSourceConfig = previous.mergedSourceConfig;
      state.sourceConfigSubscriptionId = previous.sourceConfigSubscriptionId; state.nodes = previous.nodes;
      state.subscriptionConfigs = previous.subscriptionConfigs; state.subscriptionNodeCatalog = previous.subscriptionNodeCatalog;
      if (!outcome.preserved) await applyRuntimeSettings();
    }
    setStatus();
    renderProxyNodes();
    if (outcome.preserved) {
      recordSubscriptionRefresh(activeSubscription(), { lastCheckedAt: Date.now(), error: String(outcome.error || "更新失败，已保留本地缓存").slice(0, 300) });
      if ($("subscriptionStatus")) $("subscriptionStatus").textContent = "更新失败，继续使用本地缓存";
      log(`Subscription refresh unavailable; preserved cache remains active: ${outcome.error || "remote unavailable"}`);
    }
    else {
      if ($("subscriptionStatus")) $("subscriptionStatus").textContent = wasLive ? "已下载，待下次手动启动生效" : "订阅缓存已更新";
      recordSubscriptionRefresh(activeSubscription(), { lastSuccessAt: Date.now(), error: "", pending: wasLive });
      log(`Subscription refreshed via ${outcome.source}: ${state.nodes.length} candidate nodes; running core unchanged`);
    }
    return outcome;
  }
  catch (err) {
    state.sourceConfig = previous.sourceConfig;
    state.mergedSourceConfig = previous.mergedSourceConfig;
    state.sourceConfigSubscriptionId = previous.sourceConfigSubscriptionId;
    state.nodes = previous.nodes;
    state.subscriptionConfigs = previous.subscriptionConfigs;
    state.subscriptionNodeCatalog = previous.subscriptionNodeCatalog;
    state.subscriptionTraffic = previous.traffic;
    setStatus();
    renderProxyNodes();
    renderHomeTraffic();
    recordSubscriptionRefresh(activeSubscription(), { lastCheckedAt: Date.now(), error: String(err.message || err).slice(0, 300) });
    if ($("subscriptionStatus")) $("subscriptionStatus").textContent = "更新失败，现有配置未改变";
    log(`Subscription refresh failed without changing active config: ${err.message || err}`);
    throw err;
  }
  finally {
    if (button) button.textContent = "更新当前订阅";
    setSubscriptionBusy(false);
    renderSubscriptionRefreshStatus();
  }
}

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config || {}));
}

function effectiveMainCustomRules() {
  const userRules = Array.isArray(state.settings.customRules) ? state.settings.customRules : [];
  const seen = new Set();
  return userRules.filter((rule) => {
    const key = [rule.type, rule.value, rule.outbound || "SMART", rule.position || "prepend"].join("\n").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeMainConfig() {
  const groupName = state.settings.targetGroup || DEFAULT_SETTINGS.targetGroup;
  const sourceConfig = state.mergedSourceConfig || state.sourceConfig;
  const allNodes = state.nodes.length ? state.nodes : getCandidateNodes();
  const nodeNames = getSwitchableNodes(allNodes);
  const preferredEntry = state.pendingNodeSelection || restorableNodeEntry();
  const preferredNode = preferredEntry && (preferredEntry.tag || preferredEntry.node);
  const builtConfig = SmartProxyConfig.buildSingBoxConfig(cloneConfig(sourceConfig), {
    groupName,
    forcedDomains: state.settings.forcedDomains,
    nodeNames,
    customRules: effectiveMainCustomRules(),
    globalProxy: !!state.settings.globalProxyEnabled,
    port: state.settings.mainPort,
    controllerPort: state.settings.mainControllerPort,
    secret: MAIN_SECRET,
    defaultNode: preferredNode,
    logLevel: state.settings.logLevel || "info",
    customOnlyRoutes: true,
    probeLanes: state.codexProbeLanesDisabled ? null : {
      inboundTagPrefix: "codex-probe-in",
      portBase: CODEX_PROBE_PROXY_PORT,
      maxLanes: 512
    }
  });
  state.probePortByTag = extractProbePortMap(builtConfig);
  return builtConfig;
}

// 从生成的 sing-box 配置反解「节点 tag -> 专属探测端口」映射
function extractProbePortMap(config) {
  const map = new Map();
  const portByInbound = new Map(
    (config && Array.isArray(config.inbounds) ? config.inbounds : [])
      .filter((inbound) => String(inbound && inbound.tag || "").startsWith("codex-probe-in"))
      .map((inbound) => [String(inbound.tag), Number(inbound.listen_port)])
  );
  const rules = config && config.route && Array.isArray(config.route.rules) ? config.route.rules : [];
  for (const rule of rules) {
    const inboundTag = Array.isArray(rule && rule.inbound) ? String(rule.inbound[0]) : String(rule && rule.inbound || "");
    if (portByInbound.has(inboundTag) && typeof rule.outbound === "string") {
      map.set(rule.outbound, portByInbound.get(inboundTag));
    }
  }
  return map;
}


async function writeYamlConfig(name, config) {
  const path = await Neutralino.filesystem.getJoinedPath(state.paths.work, name);
  await Neutralino.filesystem.writeFile(path, jsyaml.dump(config, { lineWidth: 180 }));
  return path;
}

async function writeCoreConfig(name, config) {
  if (!isSingBoxCore()) return writeYamlConfig(name, config);
  const jsonName = name.replace(/\.(yaml|yml)$/i, ".json");
  const path = await Neutralino.filesystem.getJoinedPath(state.paths.work, jsonName);
  await Neutralino.filesystem.writeFile(path, JSON.stringify(config, null, 2));
  return path;
}

function lastKnownMainConfigMatchesSettings(config) {
  const expectedPort = Number(state.settings.mainPort);
  const expectedController = `127.0.0.1:${Number(state.settings.mainControllerPort)}`;
  if (isSingBoxCore()) {
    const inbounds = Array.isArray(config && config.inbounds) ? config.inbounds : [];
    const mixedInbound = inbounds.some((inbound) =>
      inbound
      && inbound.type === "mixed"
      && Number(inbound.listen_port) === expectedPort
      && (!inbound.listen || inbound.listen === "127.0.0.1")
    );
    const clashApi = config && config.experimental && config.experimental.clash_api;
    return !!(
      mixedInbound
      && clashApi
      && clashApi.external_controller === expectedController
      && clashApi.secret === MAIN_SECRET
    );
  }
  return !!(
    config
    && Number(config["mixed-port"]) === expectedPort
    && config["external-controller"] === expectedController
    && config.secret === MAIN_SECRET
  );
}

async function resolveLastKnownMainConfigPath() {
  const fileName = isSingBoxCore() ? "main.json" : "main.yaml";
  const path = await Neutralino.filesystem.getJoinedPath(state.paths.work, fileName);
  if (!await access(path)) return "";
  try {
    const text = await readPortableTextFile(path);
    const config = isSingBoxCore() ? JSON.parse(text) : jsyaml.load(text);
    if (!lastKnownMainConfigMatchesSettings(config)) {
      throw new Error("saved ports, controller, or secret do not match current settings");
    }
    await validateCoreConfig(path, "Last-known main");
    log(`Using last-known compiled main config for core startup: ${path}`);
    return path;
  }
  catch (err) {
    log(`Last-known main config skipped: ${err.message || err}`);
    return "";
  }
}

async function waitForController(baseUrl, secret, timeoutMs, proc = null) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (proc && proc.id !== undefined && state.spawnedCoreFailures.has(proc.id)) {
      return false;
    }
    try {
      const res = await fetch(`${baseUrl}/version`, {
        headers: { Authorization: `Bearer ${secret}` }
      });
      if (res.ok) return true;
    }
    catch {}
    await sleep(250);
  }
  return false;
}

async function probeControllerLive(baseUrl, secret, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/version`, {
        headers: { Authorization: `Bearer ${secret}` }
      });
      if (res.ok || res.status === 401 || res.status === 403) return true;
    }
    catch {}
    await sleep(250);
  }
  return false;
}

async function validateCoreConfig(configPath, label) {
  if (!isSingBoxCore()) return;
  const corePath = selectedCorePath();
  const res = await Neutralino.os.execCommand(`${quote(corePath)} check -c ${quote(configPath)}`, { cwd: state.paths.work });
  const output = [res.stdOut, res.stdErr].filter(Boolean).join("\n").trim();
  if (res.exitCode !== 0 && res.exitCode !== undefined) {
    throw new Error(`${label} config check failed: ${output || `exit ${res.exitCode}`}`);
  }
  if (output) log(`${label} config check: ${output.split(/\r?\n/).slice(-1)[0]}`);
}

async function killCorePorts(ports, label) {
  const portList = ports.map((port) => Number(port)).filter(Boolean);
  const ps = SmartProxyConfig.buildCorePortCleanupScript(portList);
  if (!ps) return;
  const res = await Neutralino.os.execCommand(buildPowerShellExecCommand(ps));
  if (res.exitCode !== 0 && res.exitCode !== undefined) {
    throw new Error(`${label} ports cleanup failed: ${(res.stdErr || res.stdOut || "").trim() || `exit ${res.exitCode}`}`);
  }
  log(`${label} ports cleared: ${portList.join(", ")}`);
}

async function killStaleCoreProcesses(label) {
  const ps = SmartProxyConfig.buildCoreProcessCleanupScript({
    corePath: selectedCorePath(),
    runtimePath: state.paths.work
  });
  if (!ps) return;
  const res = await Neutralino.os.execCommand(buildPowerShellExecCommand(ps));
  if (res.exitCode !== 0 && res.exitCode !== undefined) {
    throw new Error(`${label} process cleanup failed: ${(res.stdErr || res.stdOut || "").trim() || `exit ${res.exitCode}`}`);
  }
  const output = String(res.stdOut || "").trim();
  if (output) log(`${label} processes cleared: ${output}`);
}






async function spawnCore(configPath, label) {
  const corePath = selectedCorePath();
  if (!corePath) throw new Error("sing-box.exe path is empty");
  await validateCoreConfig(configPath, label);
  const command = isSingBoxCore()
    ? `${quote(corePath)} run -c ${quote(configPath)}`
    : `${quote(corePath)} -d ${quote(state.paths.work)} -f ${quote(configPath)}`;
  log(`${label} starting`);
  const proc = await Neutralino.os.spawnProcess(command, { cwd: state.paths.work });
  if (proc && proc.id !== undefined) {
    state.spawnedCoreLabels.set(proc.id, label);
    state.spawnedCoreFailures.delete(proc.id);
  }
  return proc;
}

async function attachExistingMainCore() {
  const live = await probeControllerLive(mainController(), MAIN_SECRET, 350).catch(() => false);
  if (!live) return false;
  state.mainProcess = {
    pid: null,
    ports: [state.settings.mainPort, state.settings.mainControllerPort],
    attached: true
  };
  state.mainCoreReady = true;
  state.mainCoreDesired = true;
  try {
    const configText = await readTextIfExists(await Neutralino.filesystem.getJoinedPath(state.paths.work, "main.json"));
    if (configText) state.probePortByTag = extractProbePortMap(JSON.parse(configText));
  }
  catch (err) {
    log(`Attach probe port map failed: ${err.message || err}`);
  }
  await applyDesiredSystemProxy().catch((err) => {
    state.systemProxyApplied = false;
    log(`System proxy apply failed while attaching core: ${err.message || err}`);
  });
  startCoreLogStream();
  startConnectionPolling();
  await updateCurrentNode();
  renderProxyNodes();
  setStatus();
  log("Attached to existing main core");
  return true;
}

async function startMainCore(options = {}) {
  state.mainCoreDesired = true;
  if (state.mainProcess && state.mainCoreReady) return state.mainProcess;
  if (state.mainStartPromise) return state.mainStartPromise;
  state.mainStartPromise = startMainCoreWithRetries(options);
  try {
    return await state.mainStartPromise;
  }
  finally {
    state.mainStartPromise = null;
    setStatus();
    if (state.mainCoreReady) setTimeout(() => scheduleContinuousCompetition("core-ready"), 0);
  }
}

async function startMainCoreWithRetries(options = {}) {
  await saveSettingsFileOnly();
  let localSourceReady = false;
  try {
    localSourceReady = await loadSourceConfig({
      preferCache: true,
      allowPreservedCache: true,
      localOnly: true
    });
  }
  catch (err) {
    log(`Local source config unavailable: ${err.message || err}`);
  }
  const mainPorts = [state.settings.mainPort, state.settings.mainControllerPort];
  let path = localSourceReady
    ? await writeCoreConfig("main.yaml", makeMainConfig())
    : await resolveLastKnownMainConfigPath();
  if (!path) {
    log("No usable local startup config; subscription refresh is required");
    await loadSourceConfig({ allowPreservedCache: true });
    path = await writeCoreConfig("main.yaml", makeMainConfig());
  }
  let lastError = null;

  for (let attempt = 1; attempt <= MAIN_CORE_START_ATTEMPTS; attempt++) {
    let proc = null;
    state.mainCoreReady = false;
    state.mainProcess = null;
    try {
      proc = await spawnCore(path, `Main core attempt ${attempt}`);
      state.mainProcess = proc;
      const ok = await waitForController(
        mainController(),
        MAIN_SECRET,
        MAIN_CONTROLLER_TIMEOUT_MS,
        proc
      );
      if (!ok) {
        const detail = proc && proc.id !== undefined
          ? state.spawnedCoreFailures.get(proc.id)
          : "";
        throw new Error(
          detail
            ? `core exited before ready: ${detail}`
            : `controller not ready after ${MAIN_CONTROLLER_TIMEOUT_MS / 1000}s`
        );
      }
      state.mainCoreReady = true;
      setStatus();
      await applyDesiredSystemProxy().catch((err) => {
        state.systemProxyApplied = false;
        log(`System proxy apply failed after core ready: ${err.message || err}`);
      });
      startCoreLogStream();
      startConnectionPolling();
      await updateCurrentNode();
      const pending = state.pendingNodeSelection;
      const pendingTag = pending && (pending.tag || pending.node);
      if (pendingTag && state.nodes.includes(pendingTag)) {
        const selected = await switchToNode(pendingTag, "Prepared manual node", { manual: true }).catch((err) => {
          log(`Prepared node switch failed: ${err.message || err}`);
          return false;
        });
        if (selected) state.pendingNodeSelection = null;
      }
      setStatus();
      renderProxyNodes();
      if (localSourceReady) {
        state.pendingConfigApply = null;
        for (const profile of state.settings.subscriptions || []) {
          if (state.subscriptionConfigs.has(profile.id) && state.settings.subscriptionRefreshStatus?.[profile.id]?.pending) recordSubscriptionRefresh(profile, { pending: false });
        }
      }
      log(`Main core ready on attempt ${attempt}`);
      return proc;
    }
    catch (err) {
      lastError = err;
      state.mainCoreReady = false;
      state.mainProcess = null;
      await killProcess(proc, `Main core attempt ${attempt}`);
      await killCorePorts(mainPorts, `Main core failed attempt ${attempt}`).catch(() => {});
      log(`Main core start attempt ${attempt}/${MAIN_CORE_START_ATTEMPTS} failed: ${err.message || err}`);
      if (
        attempt === 1
        && isSingBoxCore()
        && !state.codexProbeLanesDisabled
        && (state.mergedSourceConfig || state.sourceConfig)
        && /bind|listen|address already in use|only one usage/i.test(String(err.message || err))
      ) {
        state.codexProbeLanesDisabled = true;
        path = await writeCoreConfig("main.yaml", makeMainConfig());
        log("Probe lane ports unavailable; retrying the main core without probe lanes");
        continue;
      }
      if (attempt < MAIN_CORE_START_ATTEMPTS) await sleep(MAIN_CORE_RETRY_DELAY_MS);
    }
  }
  throw new Error(`Main core failed after ${MAIN_CORE_START_ATTEMPTS} attempts: ${lastError && (lastError.message || lastError)}`);
}

async function clearStaleCorePortsOnBoot() {
  const ports = [
    state.settings.mainPort,
    state.settings.mainControllerPort
  ];
  await killStaleCoreProcesses("Startup stale core");
  await killCorePorts(ports, "Startup stale core");
}


async function killProcess(proc, label) {
  if (!proc) return;
  try {
    if (!proc.pid) {
      if (Array.isArray(proc.ports)) await killCorePorts(proc.ports, label);
      else log(`${label} stop skipped: pid unavailable`);
      return;
    }
    await Neutralino.os.execCommand(`taskkill /PID ${proc.pid} /T /F`);
    log(`${label} stopped`);
  }
  catch (err) {
    log(`${label} stop failed: ${err.message || err}`);
  }
  finally {
    if (proc && proc.id !== undefined) {
      state.spawnedCoreLabels.delete(proc.id);
      state.spawnedCoreFailures.delete(proc.id);
    }
  }
}

async function stopMainCore() {
  stopContinuousCompetition("proxy-stopped");
  state.mainCoreDesired = false;
  state.mainCoreReady = false;
  if (state.mainRestartTimer) {
    clearTimeout(state.mainRestartTimer);
    state.mainRestartTimer = null;
  }
  const proc = state.mainProcess;
  state.mainProcess = null;
  stopCoreLogStream();
  stopConnectionPolling();
  setStatus();
  await Promise.allSettled([
    disableSystemProxy(),
    killProcess(proc, "Main core")
  ]);
}


async function stopAll() {
  state.codexProbeCancelRequested = true;
  await stopMainCore();
}

function systemProxyPowerShell(enabled, server = "") {
  const registryPath = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
  const update = enabled
    ? [
      `Set-ItemProperty -Path ${psQuote(registryPath)} -Name ProxyEnable -Value 1`,
      `Set-ItemProperty -Path ${psQuote(registryPath)} -Name ProxyServer -Value ${psQuote(server)}`
    ]
    : [
      `Set-ItemProperty -Path ${psQuote(registryPath)} -Name ProxyEnable -Value 0`
    ];
  const verify = enabled
    ? `if ([int]$current.ProxyEnable -ne 1 -or [string]$current.ProxyServer -ne ${psQuote(server)}) { throw 'system proxy verification failed' }`
    : "if ([int]$current.ProxyEnable -ne 0) { throw 'system proxy disable verification failed' }";
  return [
    "$ErrorActionPreference='Stop'",
    ...update,
    "Add-Type -Namespace SmartProxy -Name WinInet -MemberDefinition '[System.Runtime.InteropServices.DllImport(\"wininet.dll\", SetLastError=true)] public static extern bool InternetSetOption(System.IntPtr hInternet, int dwOption, System.IntPtr lpBuffer, int dwBufferLength);'",
    "$null=[SmartProxy.WinInet]::InternetSetOption([IntPtr]::Zero,39,[IntPtr]::Zero,0)",
    "$null=[SmartProxy.WinInet]::InternetSetOption([IntPtr]::Zero,95,[IntPtr]::Zero,0)",
    "$null=[SmartProxy.WinInet]::InternetSetOption([IntPtr]::Zero,37,[IntPtr]::Zero,0)",
    `$current=Get-ItemProperty -Path ${psQuote(registryPath)}`,
    verify,
    `[pscustomobject]@{enabled=[bool]${enabled ? "$true" : "$false"};server=[string]$current.ProxyServer} | ConvertTo-Json -Compress`
  ].join("\n");
}

async function writeSystemProxySettings(enabled, server = "") {
  const result = await Neutralino.os.execCommand(
    buildPowerShellExecCommand(systemProxyPowerShell(enabled, server))
  );
  if (result.exitCode !== 0 && result.exitCode !== undefined) {
    throw new Error(
      String(result.stdErr || result.stdOut || `exit ${result.exitCode}`).trim()
    );
  }
  return parseJsonObjectOutput(result.stdOut || "");
}

async function enableSystemProxy() {
  if (isIsolationTestMode()) {
    log("System proxy enable skipped in isolated test mode");
    return { skipped: true };
  }
  const live = await probeControllerLive(mainController(), MAIN_SECRET, 1200).catch(() => false);
  if (!live) {
    state.systemProxyApplied = false;
    throw new Error("Main core is not ready; system proxy unchanged");
  }
  const server = `127.0.0.1:${state.settings.mainPort}`;
  await writeSystemProxySettings(true, server);
  state.systemProxyApplied = true;
  log(`System proxy enabled and refreshed: ${server}`);
  updateHomeProxyControls();
  return { enabled: true, server };
}

async function disableSystemProxy() {
  if (isIsolationTestMode()) {
    state.systemProxyApplied = false;
    log("System proxy disable skipped in isolated test mode");
    updateHomeProxyControls();
    return { skipped: true };
  }
  try {
    await writeSystemProxySettings(false);
    state.systemProxyApplied = false;
    log("System proxy disabled and refreshed");
    updateHomeProxyControls();
    return { enabled: false };
  }
  catch (err) {
    log(`Disable system proxy failed: ${err.message || err}`);
    throw err;
  }
}

async function applyDesiredSystemProxy() {
  if (isIsolationTestMode()) {
    state.systemProxyApplied = false;
    log("System proxy apply skipped in isolated test mode");
    return { skipped: true };
  }
  if (state.settings.systemProxyEnabled) return enableSystemProxy();
  return disableSystemProxy();
}

function parseJsonObjectOutput(output) {
  const lines = String(output || "").trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const jsonLine = lines.reverse().find((line) => line.startsWith("{") && line.endsWith("}"));
  if (!jsonLine) throw new Error("status json not found");
  return JSON.parse(jsonLine);
}

function systemNetworkOptimizeDetail(status) {
  if (!status) return "WinHTTP/TCP 未检测";
  if (status.checking) return "正在读取 WinHTTP 和 TCP KeepAlive";
  if (status.error) return status.error;
  const tcp = status.tcpOk ? "TCP 已优化" : "TCP 未优化";
  const winhttp = status.winHttpOk ? `WinHTTP 端口 ${status.expectedPort}` : `WinHTTP 未指向 ${status.expectedPort}`;
  return `${tcp} / ${winhttp}`;
}

function updateSystemNetworkOptimizeStatus(status) {
  const current = status || state.systemNetworkOptimizeStatus;
  const badge = $("systemNetworkOptimizeStatus");
  const detail = $("systemNetworkOptimizeStatusText");
  if (!badge && !detail) return;
  let tone = "pending";
  let label = "未检测";
  if (current && current.checking) {
    label = "检测中";
  }
  else if (current && current.error) {
    tone = "bad";
    label = "检测失败";
  }
  else if (current && current.ok) {
    tone = "ok";
    label = "已优化";
  }
  else if (current && (current.tcpOk || current.winHttpOk)) {
    tone = "warn";
    label = "部分生效";
  }
  else if (current) {
    tone = "bad";
    label = "未优化";
  }
  if (badge) {
    badge.textContent = label;
    badge.className = `network-optimize-status ${tone}`.trim();
  }
  if (detail) detail.textContent = systemNetworkOptimizeDetail(current);
}

function setSystemNetworkOptimizeBusy(busy) {
  state.systemNetworkOptimizeBusy = !!busy;
  const applyBtn = $("applySystemNetworkOptimizeBtn");
  const refreshBtn = $("refreshSystemNetworkOptimizeStatusBtn");
  if (applyBtn) {
    applyBtn.disabled = !!busy;
    applyBtn.textContent = busy ? "处理中" : "应用/修复";
  }
  if (refreshBtn) refreshBtn.disabled = !!busy;
}

async function readSystemNetworkOptimizeStatus() {
  const script = SmartProxyConfig.buildWindowsNetworkStatusScript({
    mainPort: state.settings.mainPort
  });
  const res = await Neutralino.os.execCommand(buildPowerShellExecCommand(script));
  if (res.exitCode !== 0 && res.exitCode !== undefined) {
    throw new Error((res.stdErr || res.stdOut || "").trim() || `status exit ${res.exitCode}`);
  }
  return parseJsonObjectOutput(res.stdOut || "");
}

async function refreshSystemNetworkOptimizeStatus(options = {}) {
  if (!options.silent) {
    state.systemNetworkOptimizeStatus = { checking: true };
    updateSystemNetworkOptimizeStatus();
  }
  try {
    const status = await readSystemNetworkOptimizeStatus();
    state.systemNetworkOptimizeStatus = status;
    updateSystemNetworkOptimizeStatus(status);
    if (options.logResult) {
      log(`System network optimization status: ${status.ok ? "ok" : "needs repair"} (${systemNetworkOptimizeDetail(status)})`);
    }
    return status;
  }
  catch (err) {
    const status = { ok: false, tcpOk: false, winHttpOk: false, error: err.message || String(err) };
    state.systemNetworkOptimizeStatus = status;
    updateSystemNetworkOptimizeStatus(status);
    if (options.throwOnError) throw err;
    if (!options.silent) log(`System network optimization status check failed: ${status.error}`);
    return status;
  }
}

async function applySystemNetworkOptimize(options = {}) {
  if (!options.skipReadForm) {
    readSettingsFromForm();
    await persistSettingsFile();
  }
  setSystemNetworkOptimizeBusy(true);
  try {
    const before = options.force ? null : await refreshSystemNetworkOptimizeStatus({ silent: true });
    if (before && before.ok) {
      log("System network optimization already active");
      return before;
    }
    state.systemNetworkOptimizeStatus = { checking: true };
    updateSystemNetworkOptimizeStatus();
    const source = options.source || "manual";
    log(`Requesting UAC for system network optimization (${source}): TCP keepalive + WinHTTP proxy`);
    const optimizeScript = SmartProxyConfig.buildWindowsNetworkOptimizeScript({
      mainPort: state.settings.mainPort
    });
    const revertScript = SmartProxyConfig.buildWindowsNetworkRevertScript();
    const command = buildElevatedPowerShellCommand(optimizeScript);
    const revertCommand = buildElevatedPowerShellCommand(revertScript);
    await Neutralino.os.execCommand(command);
    await writeTextToClipboard(revertCommand).catch(() => null);
    await sleep(SYSTEM_NETWORK_OPTIMIZE_RECHECK_DELAY_MS);
    const after = await refreshSystemNetworkOptimizeStatus({ silent: true });
    log(`System network optimization ${after.ok ? "verified" : "requested but not verified"}. Revert command copied to clipboard.`);
    return after;
  }
  finally {
    setSystemNetworkOptimizeBusy(false);
  }
}

async function ensureSystemNetworkOptimized(source) {
  if (!state.settings.systemProxyEnabled) {
    await refreshSystemNetworkOptimizeStatus({ silent: true });
    log("System network optimization auto repair skipped because system proxy is disabled");
    return state.systemNetworkOptimizeStatus;
  }
  const status = await refreshSystemNetworkOptimizeStatus({ silent: true });
  if (status && status.ok) {
    log("System network optimization already active");
    return status;
  }
  try {
    return await applySystemNetworkOptimize({ source: source || "startup", skipReadForm: true });
  }
  catch (err) {
    log(`System network optimization auto repair failed: ${err.message || err}`);
    await refreshSystemNetworkOptimizeStatus({ silent: true });
    return state.systemNetworkOptimizeStatus;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(baseUrl, secret, path, options = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(abort, options.timeoutMs || CONTROLLER_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}${path}`, { ...options, signal: controller.signal,
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...(options.headers || {}) } });
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
    return res.status === 204 ? null : await res.json();
  } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); }
}








async function reselectCurrentNodeState(reason = {}) {
  if (!state.mainProcess || !shouldResetCurrentNode(reason)) return false;
  const proxies = await getMainProxies();
  const groups = proxies.proxies || {};
  const target = findTargetGroupEntry(groups, state.settings.targetGroup);
  if (!target) {
    log("Current node reselect skipped: target group not found");
    return false;
  }

  const originalSelection = target.group.now;
  const current = resolveFinalNode(groups, originalSelection);
  if (!originalSelection) {
    log("Current node reselect skipped: empty group selection");
    return false;
  }
  log(`Current node reselect started: ${current || "-"} using ${originalSelection}`);
  try {
    await api(
      mainController(),
      MAIN_SECRET,
      `/proxies/${encodeURIComponent(target.groupName)}`,
      { method: "PUT", body: JSON.stringify({ name: originalSelection }) }
    );
    await sleep(120);
    await updateCurrentNode();
    log(`Current node reselect completed: ${current || "-"} using ${originalSelection}`);
    return true;
  }
  catch (err) {
    await updateCurrentNode().catch(() => null);
    log(`Current node reselect failed: ${err.message || err}`);
    return false;
  }
}


async function getMainProxies() {
  return api(mainController(), MAIN_SECRET, "/proxies", { method: "GET" });
}

async function getCurrentMainNode() {
  let name = state.settings.targetGroup || DEFAULT_SETTINGS.targetGroup;
  const seen = new Set();
  while (!seen.has(name)) {
    seen.add(name);
    const group = await api(mainController(), MAIN_SECRET, `/proxies/${encodeURIComponent(name)}`);
    if (!group?.now) return name === state.settings.targetGroup ? "-" : name;
    if (!state.nodes.includes(group.now) && Array.isArray(group.all)) { name = group.now; continue; }
    return group.now;
  }
  throw new Error("Proxy group selection cycle");
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

function findTargetGroup(groups, preferred) {
  const entry = findTargetGroupEntry(groups, preferred);
  return entry ? entry.group : null;
}

function findTargetGroupEntry(groups, preferred) {
  let group = groups[preferred];
  if (group && group.now) return { groupName: preferred, group };
  const entry = Object.entries(groups).find(([, g]) => g && g.now && Array.isArray(g.all));
  return entry ? { groupName: entry[0], group: entry[1] } : null;
}

function findGroupForNode(groups, preferred, node) {
  let groupName = preferred;
  let group = groups[groupName];
  if (!group || !Array.isArray(group.all) || !group.all.includes(node)) {
    const entry = Object.entries(groups).find(([, item]) => Array.isArray(item.all) && item.all.includes(node));
    if (entry) {
      groupName = entry[0];
      group = entry[1];
    }
  }
  return group ? { groupName, group } : null;
}

function stripAnsi(value) {
  return String(value || "").replace(/\x1b\[[0-9;]*m/g, "");
}

function coreLogConnectionId(payload) {
  // 时长形如 0ms / 3.10s / 1m50s / 16m16s：旧正则只认前两种，
  // 于是长连接（正是抖动最典型的死法）的错误行拿不到连接 ID。
  const match = stripAnsi(payload).match(/\[(\d+)\s+[\d.hms]+\]/);
  return match ? match[1] : "";
}

function processNameFromPath(path) {
  const value = String(path || "").trim();
  return value.split(/[\\/]/).filter(Boolean).pop() || value || "-";
}


function rememberCoreLogProcess(payload) {
  const clean = stripAnsi(payload);
  const id = coreLogConnectionId(clean);
  const match = clean.match(/router:\s+found process path:\s*(.+)$/i);
  if (!id || !match) return;
  state.coreProcessByConnId.set(id, match[1].trim());
  if (state.coreProcessByConnId.size > 5000) {
    state.coreProcessByConnId = new Map([...state.coreProcessByConnId].slice(-3000));
  }
}


function shouldShowSpawnedProcessLine(label, line) {
  const text = stripAnsi(line);
  return /FATAL|panic|bind:|address.*in use|Only one usage|start service:|failed to start|configuration.*error/i.test(text);
}

function rememberSpawnedCoreFailure(id, line) {
  if (id === undefined || id === null || !line) return;
  const previous = state.spawnedCoreFailures.get(id);
  const lines = [...(Array.isArray(previous) ? previous : previous ? [previous] : []), String(line)]
    .slice(-8);
  state.spawnedCoreFailures.set(id, lines);
}

async function waitForSpawnedCoreReady(proc, label) {
  const deadline = Date.now() + 1200;
  while (Date.now() < deadline) {
    await sleep(100);
  }
  return true;
}

function onSpawnedProcess(event) {
  const detail = event && event.detail || {};
  const label = state.spawnedCoreLabels.get(detail.id);
  if (!label) return;
  const action = String(detail.action || detail.event || "");
  if (/exit/i.test(action)) {
    const exitText = `exit ${detail.data ?? ""}`.trim();
    rememberSpawnedCoreFailure(detail.id, exitText);
    log(`[core-proc/exit] ${detail.data ?? ""}`);
    if (state.mainProcess && state.mainProcess.id === detail.id) {
      state.mainProcess = null;
      state.mainCoreReady = false;
      state.systemProxyApplied = false;
      stopCoreLogStream();
      stopConnectionPolling();
      setStatus();
      if (
        state.mainCoreDesired
        && !state.mainStartPromise
        && !state.closing
        && !state.mainRestartTimer
      ) {
        log(`Main core exited unexpectedly; restart scheduled in ${MAIN_CORE_RETRY_DELAY_MS}ms`);
        state.mainRestartTimer = setTimeout(() => {
          state.mainRestartTimer = null;
          startMainCore({ reason: "unexpected-exit" }).catch((err) => {
            log(`Main core automatic restart failed: ${err.message || err}`);
          });
        }, MAIN_CORE_RETRY_DELAY_MS);
      }
    }
    return;
  }
  const data = String(detail.data || "");
  if (!data.trim()) return;
  const lines = data.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  lines.forEach((line) => {
    if (shouldShowSpawnedProcessLine(label, line)) {
      rememberSpawnedCoreFailure(detail.id, line);
      log(`[core-proc/critical] ${line}`);
    }
  });
}

function enrichCoreLogPayload(payload) {
  rememberCoreLogProcess(payload);
  const clean = stripAnsi(payload);
  const id = coreLogConnectionId(clean);
  const processPath = id ? state.coreProcessByConnId.get(id) : "";
  if (!processPath) return payload;
  if (/router:\s+found process path:/i.test(clean) || /\sprocess=/.test(clean)) return payload;
  if (!/(outbound\/|connection:\s+open connection|inbound\/mixed)/i.test(clean)) return payload;
  return `${payload} process=${processNameFromPath(processPath)}`;
}


function startCoreLogStream() {
  stopCoreLogStream();
  state.coreProcessByConnId = new Map();
  state.coreHostByConnId = new Map();
  try {
    const url = `ws://127.0.0.1:${state.settings.mainControllerPort}/logs?level=info&token=${encodeURIComponent(MAIN_SECRET)}`;
    const ws = new WebSocket(url);
    state.logSocket = ws;
    ws.onopen = () => {
      log("[core] log stream connected");
      syncSiteFailoverState("log-stream-connected").catch(err => log(`Site failover readiness failed: ${err.message || err}`));
    };
    ws.onmessage = (event) => {
      const raw = String(event.data || "");
      try {
        const item = JSON.parse(raw);
        const level = item.type || item.level || "info";
        const payload = enrichCoreLogPayload(item.payload || item.message || raw);
        log(`[core/${level}] ${payload}`);
        try {
          recordSiteFailoverSignal(level, payload);
          recordCoreLogSignal(level, payload);
        } catch (err) { log(`Core signal processing failed: ${err.message || err}`); }
      }
      catch {
        log(`[core] ${enrichCoreLogPayload(raw)}`);
      }
    };
    ws.onerror = () => log("[core] log stream error");
    ws.onclose = () => {
      if (state.logSocket !== ws) return;
      state.logSocket = null;
      state.siteFailoverLogReady = false;
      if (!state.closing && state.mainCoreReady) {
        log("[core] log stream closed; failover detection paused, reconnect in 2s (core unchanged)");
        state.logReconnectTimer = setTimeout(() => { state.logReconnectTimer = null; startCoreLogStream(); }, 2000);
      } else log("[core] log stream closed; no reconnect: core stopped or app closing");
    };
  }
  catch (err) {
    log(`Core log stream failed: ${err.message || err}`);
  }
}


function stopCoreLogStream() {
  if (state.logReconnectTimer) clearTimeout(state.logReconnectTimer);
  state.logReconnectTimer = null;
  state.siteFailoverLogReady = false;
  if (!state.logSocket) return;
  const ws = state.logSocket;
  state.logSocket = null;
  try {
    ws.close();
  }
  catch {
    return;
  }
}


async function updateCurrentNode() {
  try {
    state.currentNode = await getCurrentMainNode();
    $("homeNode").textContent = state.currentNode;
    rememberSelectedNode(state.currentNode);
  }
  catch {
    state.currentNode = "-";
    $("homeNode").textContent = "-";
  }
  updateHomeNodeGroup();
}

function updateHomeNodeGroup() {
  const box = $("homeNodeGroup");
  if (!box) return;
  const entry = state.subscriptionNodeCatalog.find((item) => (item.tag || item.node) === state.currentNode);
  if (!entry) { box.textContent = "-"; return; }
  const rule = classifyNodeGroup(entry);
  const cooling = groupCooldownActive(rule.id);
  box.textContent = `${rule.id} · ${rule.label}${cooling ? "（冷却中）" : ""}`;
}

async function switchToNode(node, label, options = {}) {
  if (options.manual !== true) {
    log(`Blocked non-manual low-level node switch: ${node || "-"}`);
    return false;
  }
  state.siteFailoverRevision += 1; // Manual intent cancels any in-flight automatic selection.
  if (!node) return false;
  if (!state.mainProcess) {
    log(`${label || "Switch"} skipped: main core is not running`);
    return false;
  }
  const proxies = await getMainProxies();
  const groups = proxies.proxies || {};
  const target = findGroupForNode(groups, state.settings.targetGroup, node);
  if (!target) {
    log(`${label || "Switch"} failed: no group contains ${node}`);
    return false;
  }
  const current = resolveFinalNode(groups, target.group.now);
  if (current === node) {
    state.currentNode = current;
    $("homeNode").textContent = current || "-";
    rememberSelectedNode(current);
    log(`${label || "Switch"} skipped: already on ${node}`);
    return true;
  }
  await api(
    mainController(),
    MAIN_SECRET,
    `/proxies/${encodeURIComponent(target.groupName)}`,
    { method: "PUT", body: JSON.stringify({ name: node }) }
  );
  await updateCurrentNode();
  // 低层入口已强制 manual；仅用户要求时清理旧连接。
  if (options.resetConnections) await resetActiveConnections(`${current || "-"} -> ${node}`);
  log(`${label || "Switched"} ${target.groupName}: ${current || "-"} -> ${node}`);
  return true;
}

// 切换节点后关掉旧节点上的存量连接，强制客户端立刻在新节点上重建
async function resetActiveConnections(reason = "node switch") {
  try {
    const snapshot = await api(mainController(), MAIN_SECRET, "/connections").catch(() => null);
    const connections = snapshot && Array.isArray(snapshot.connections) ? snapshot.connections : [];
    const targets = connections.filter((connection) => {
      const chains = Array.isArray(connection && connection.chains) ? connection.chains.map(String) : [];
      // 只清主链路连接，保留探测通道自己的连接
      return !chains.some((item) => item.startsWith("codex-probe") || item.startsWith("CodexProbe"));
    });
    await Promise.all(targets.map((connection) => api(
      mainController(),
      MAIN_SECRET,
      `/connections/${encodeURIComponent(String(connection.id))}`,
      { method: "DELETE" }
    ).catch(() => {})));
    if (targets.length) log(`Reset ${targets.length} live connections after ${reason}`);
  }
  catch (err) {
    log(`Reset connections failed: ${err.message || err}`);
  }
}

async function selectProxyNode(node) {
  await switchToNode(node, "Manual selected", { manual: true, resetConnections: true });
}

async function selectCatalogNode(key, options = {}) {
  if (options.manual !== true) {
    log(`Blocked non-manual node selection: ${key || "-"}`);
    return false;
  }
  const entry = catalogEntryByKey(key);
  if (!entry) throw new Error("节点不在订阅缓存中");
  const tag = entry.tag || entry.node;
  const live = !!state.mainProcess
    || await probeControllerLive(mainController(), MAIN_SECRET, 700).catch(() => false);
  if (!live) {
    state.pendingNodeSelection = { ...entry };
    state.currentNode = tag;
    rememberSelectedNode(entry);
    if ($("homeNode")) $("homeNode").textContent = tag;
    renderProxyNodes();
    log("Node prepared without starting proxy: " + entry.subscriptionName + "/" + entry.node + " -> " + tag);
    return false;
  }
  const switched = await switchToNode(tag, "Manual selected", {
    manual: true,
    resetConnections: true
  });
  if (switched) state.pendingNodeSelection = null;
  return switched;
}

function nodeCodexPresentation(entry, key) {
  if (state.codexProbePendingKeys.has(key)) return { text: state.codexProbeCancelRequested ? "停止中" : "测速中", className: "busy", title: "独立通道；固定 SSE + 串行下载；不消耗模型额度；历史保留" };
  const stale = entry?.lastAttempt && entry.lastAttempt.status !== "done";
  if (entry?.metricKind !== "stream-quality-v1" || !entry.download) return { text: stale ? entry.lastAttempt.status === "cancelled" ? "已停止" : "本次未通过" : "未测", className: "muted", title: entry?.lastAttempt?.error || "标准流式质量与下载测速，不代表模型速度" };
  const { stream, download } = entry;
  const quality = `${entry.successfulSamples}/${entry.sampleCount} 次完整成功${entry.verified ? " · 复测" : " · 初筛/未验证"}`;
  return { text: `${stream.flowPass ? "流稳" : "有波动"} · ${download.mbps.toFixed(1)} Mbps${stale ? " 历史" : ""}`,
    className: stale ? "muted" : stream.flowPass ? "fast" : "medium",
    title: `${entry.endpoint} / ${entry.location}；${quality}；首段 ${stream.firstSampleMs.toFixed(0)} ms；抖动 ${stream.jitterMs.toFixed(0)} ms；额外停顿最大 ${stream.maxExtraGapMs.toFixed(0)} ms；攒包 ${(stream.burstRatio * 100).toFixed(1)}%；${download.shortSample ? "下载不足1秒，短样本，不代表带宽上限；" : ""}测于 ${new Date(entry.measuredAt).toLocaleString()}${stale ? `；最新：${entry.lastAttempt.error || entry.lastAttempt.status}` : ""}；不是 tok/s` };
}


function codexProbeController() {
  return mainController();
}

// 可达性检测网址：设置里可填，留空回落 Anthropic Messages API
function gateProbeUrl() {
  const url = String(state.settings.probeGateUrl || "").trim();
  return /^https?:\/\//.test(url) ? url : ANTHROPIC_PROBE_URL;
}

let tokenMixProbeKeyCache = "";
let tokenMixProbeSequence = 0;

async function tokenMixProbeKey() {
  if (tokenMixProbeKeyCache) return tokenMixProbeKeyCache;
  const text = await Neutralino.filesystem.readFile(TOKENMIX_TOK_PROBE_KEY_FILE);
  const line = String(text || "").split(/\r?\n/).find((item) => item.trim().startsWith("sk-tm-"));
  if (!line) throw new Error("TokenMix credential is unavailable");
  tokenMixProbeKeyCache = line.trim();
  return tokenMixProbeKeyCache;
}

const bundledProbeScriptPromises = new Map();

async function bundledProbeScriptPath(fileName, label) {
  const resources = await Neutralino.filesystem.getJoinedPath(state.paths.appRoot, "resources");
  const scripts = await Neutralino.filesystem.getJoinedPath(resources, "scripts");
  const direct = await Neutralino.filesystem.getJoinedPath(scripts, fileName);
  if ((typeof NL_RESMODE === "undefined" || NL_RESMODE === "directory") && await access(direct)) return direct;

  if (!bundledProbeScriptPromises.has(fileName)) {
    const promise = (async () => {
      const resourceRoot = await Neutralino.filesystem.getJoinedPath(state.paths.work, "probe-resources");
      const targetDir = await Neutralino.filesystem.getJoinedPath(resourceRoot, "scripts");
      const helperDir = await Neutralino.filesystem.getJoinedPath(resourceRoot, "js");
      await ensureDirectory(targetDir);
      await ensureDirectory(helperDir);
      const target = await Neutralino.filesystem.getJoinedPath(targetDir, fileName);
      const helperTarget = await Neutralino.filesystem.getJoinedPath(helperDir, "config-helpers.js");
      await removeFileIfExists(target);
      await removeFileIfExists(helperTarget);
      try {
        await Neutralino.resources.extractFile("/resources/js/config-helpers.js", helperTarget);
        await Neutralino.resources.extractFile(`/resources/scripts/${fileName}`, target);
      }
      catch (err) {
        throw new Error(`${label} is missing from the portable executable: ${err.message || err}`);
      }
      if (!await access(target) || !await access(helperTarget)) {
        throw new Error(`${label} dependencies could not be extracted: ${target}`);
      }
      log(`Bundled probe helper restored: ${fileName}`);
      return target;
    })();
    bundledProbeScriptPromises.set(fileName, promise);
  }
  try {
    return await bundledProbeScriptPromises.get(fileName);
  }
  catch (err) {
    bundledProbeScriptPromises.delete(fileName);
    throw err;
  }
}

async function codexSubscriptionProbeScriptPath() {
  return bundledProbeScriptPath(CODEX_TOK_PROBE_SCRIPT, "Codex subscription probe script");
}

async function dualModelProbeScriptPath() {
  await bundledProbeScriptPath("stream-quality.js", "Stream Quality protocol");
  return bundledProbeScriptPath(TOK_PROBE_BATCH_SCRIPT, "Stream Quality runner");
}

async function resolveProbeNodeRuntime() {
  const resolver = await bundledProbeScriptPath("resolve-node.ps1", "Node runtime resolver");
  const result = await Neutralino.os.execCommand(buildPowerShellExecCommand(
    `& ${psQuote(resolver)} -AppRoot ${psQuote(state.paths.appRoot)}; exit $LASTEXITCODE`
  ), { cwd: state.paths.work });
  if (String(result.stdErr || "").trim()) log(`Node discovery: ${String(result.stdErr).trim().slice(0, 600)}`);
  let runtime;
  try { runtime = JSON.parse(String(result.stdOut || "").trim()); } catch { /* Fixed error below; no raw subprocess output. */ }
  if (Number(result.exitCode) !== 0 || !runtime?.path || !/^v(?:2[2-9]|[3-9]\d|\d{3,})\./.test(runtime.version || "")) {
    log("Node discovery failed: no validated Node 22+ runtime; benchmark not started");
    throw new Error("找不到可用的 Node 22+；已检查应用目录、PATH、运行中的 Pi/Node 和标准安装目录");
  }
  log(`Benchmark Node runtime: ${runtime.path} (${runtime.version})`);
  return runtime.path;
}

async function ensureCodexProbeReady() {
  if (state.networkProbeJob) throw new Error("网络测试正在运行，请先停止它");
  if (state.phoneProbeController || state.phoneProbeStarting) throw new Error("手机控制模式占用测速执行层，请先停止手机控制");
  if (state.codexProbePreparing) throw new Error("测速正在准备，请勿重复启动");
  state.codexProbePreparing = true;
  try {
    if (!selectedCorePath() || !await access(selectedCorePath())) throw new Error("请选择可用的 sing-box；测速会使用独立核心，不要求启动日常代理");
    StreamQuality.endpoint(state.settings.streamQualityEndpoint || STREAM_QUALITY_ENDPOINT);
    if (!state.mergedSourceConfig) await refreshSubscriptionNodeCatalog();
    return true;
  } finally { state.codexProbePreparing = false; }
}

function probePortForEntry(entry) {
  return state.probePortByTag.get(String(entry.tag || entry.node)) || 0;
}

// 探测静态资产：anthropic 探针 JSON、空 body、随机上传负载（一次生成循环复用）
async function ensureProbeAssets() {
  if (state.probeAssets) return state.probeAssets;
  const dir = await Neutralino.filesystem.getJoinedPath(state.paths.work, "codex-probe-work");
  await ensureDirectory(dir);
  const gatePath = await Neutralino.filesystem.getJoinedPath(dir, "gate.json");
  const emptyPath = await Neutralino.filesystem.getJoinedPath(dir, "empty.bin");
  const screenPath = await Neutralino.filesystem.getJoinedPath(dir, "payload-screen.bin");
  const finalPath = await Neutralino.filesystem.getJoinedPath(dir, "payload-final.bin");
  await Neutralino.filesystem.writeFile(gatePath, '{"model":"claude-3-5-haiku-latest","max_tokens":1,"messages":[{"role":"user","content":"ping"}]}');
  await Neutralino.filesystem.writeBinaryFile(emptyPath, new ArrayBuffer(0));
  const fillRandom = (bytes) => {
    const buffer = new Uint8Array(bytes);
    for (let offset = 0; offset < bytes; offset += 65536) {
      crypto.getRandomValues(buffer.subarray(offset, Math.min(bytes, offset + 65536)));
    }
    return buffer.buffer;
  };
  await Neutralino.filesystem.writeBinaryFile(screenPath, fillRandom(PROBE_SCREEN_UPLOAD_BYTES));
  await Neutralino.filesystem.writeBinaryFile(finalPath, fillRandom(PROBE_FINAL_UPLOAD_BYTES));
  state.probeAssets = { dir, gatePath, emptyPath, screenPath, finalPath };
  return state.probeAssets;
}

// ---- curl 探测执行层：单次 HTTPS POST,进程开销 <100ms,无 PS/文件轮询 ----

function parseCurlStat(stdout) {
  const line = String(stdout || "").split(/\r?\n/).map((item) => item.trim()).find((item) => item.startsWith("CURLSTAT:"));
  if (!line) return null;
  const parts = line.slice(9).trim().split(/\s+/).map(Number);
  if (parts.length < 4 || parts.slice(0, 4).some((value) => !Number.isFinite(value))) return null;
  return {
    http: Math.trunc(parts[0]),
    preMs: parts[1] * 1000,
    startMs: parts[2] * 1000,
    totalMs: parts[3] * 1000,
    // curl 自己测得的上行字节率(B/s),按真实发送时长统计,是速率的权威来源
    speedUpBps: Number.isFinite(parts[4]) ? parts[4] : 0,
    uploadedBytes: Number.isFinite(parts[5]) ? parts[5] : 0
  };
}

async function curlProxyPost(proxyPort, url, dataFileName, timeoutSeconds, contentType = "") {
  const assets = await ensureProbeAssets();
  const parts = [
    "curl.exe", "-sS", "-o", "NUL",
    "-x", `http://127.0.0.1:${proxyPort}`,
    "--connect-timeout", String(Math.max(2, Math.trunc(timeoutSeconds))),
    "-m", String(Math.max(3, Math.trunc(timeoutSeconds))),
    "--data-binary", `@${dataFileName}`
  ];
  if (contentType) parts.push("-H", `"content-type: ${contentType}"`);
  parts.push("-w", '"CURLSTAT:%{http_code} %{time_pretransfer} %{time_starttransfer} %{time_total} %{speed_upload} %{size_upload}"', url);
  const startedAt = Date.now();
  const result = await Neutralino.os.execCommand(parts.join(" "), { cwd: assets.dir });
  return {
    exitCode: Number(result.exitCode || 0),
    stat: parseCurlStat(result.stdOut),
    stdErr: String(result.stdErr || "").trim().split(/\r?\n/)[0] || "",
    elapsedMs: Date.now() - startedAt
  };
}

// 用 sing-box 内置 clash API 的 /delay 端点做可达性+延迟测量。
// 内核原生并发，不起进程、不需要探测端口；一次请求同时给出
// 「能否到达 Anthropic」和「真实往返延迟」——后者才是对话体感的主导指标
// （上行带宽只在大上下文时才成为瓶颈，故降级为可选深度检查）。
// 【已停用，保留作回退】clash /group/delay 判据太松（任何响应都算通过、只测一次），
// 2026-08-14 起全量扫描改走 runBatchGateScan 严格 gate。
async function measureNodeDelay(entry, timeoutMs = DELAY_PROBE_TIMEOUT_MS) {
  const tag = String(entry.tag || entry.node);
  const path = `/proxies/${encodeURIComponent(tag)}/delay`
    + `?timeout=${Math.max(1000, Math.trunc(timeoutMs))}`
    + `&url=${encodeURIComponent(ANTHROPIC_PROBE_URL)}`;
  const startedAt = Date.now();
  try {
    const res = await api(mainController(), MAIN_SECRET, path);
    const delay = Math.max(1, Math.trunc(Number(res && res.delay) || 0));
    if (!delay) throw new Error("no delay");
    return { ok: true, delayMs: delay, error: "" };
  }
  catch (err) {
    return {
      ok: false,
      delayMs: 0,
      error: String(err && err.message || err || "unreachable").slice(0, 120),
      durationMs: Date.now() - startedAt
    };
  }
}

// 整组并行延迟测量：sing-box 的 /group/{name}/delay 会在内核内部
// 对该组全部成员同时发起测试，一个请求测完所有节点。
// 【关键特性】耗时只等于 timeout，与节点数量无关（179 节点实测 5.06s）；
// 逐节点调用 /proxies/{n}/delay 则要 10s+，浏览器 fetch 并发更是被
// WebView2 的 ~6 连接上限拖到 53s。
// 响应只包含测试成功的节点（{节点名: 延迟ms}），未出现 = 超时内不可达。
async function runDelayScan(entries, onEach) {
  if (!entries.length) return;
  const group = state.settings.targetGroup || DEFAULT_SETTINGS.targetGroup;
  const path = `/group/${encodeURIComponent(group)}/delay`
    + `?timeout=${DELAY_PROBE_TIMEOUT_MS}`
    + `&url=${encodeURIComponent(gateProbeUrl())}`;
  let byNode = {};
  try {
    byNode = await api(mainController(), MAIN_SECRET, path) || {};
  }
  catch (err) {
    log(`Group delay test failed: ${err.message || err}`);
  }
  for (const entry of entries) {
    if (state.codexProbeCancelRequested) return;
    const delayMs = Math.max(0, Math.trunc(Number(byNode[String(entry.tag || entry.node)]) || 0));
    const result = delayMs > 0
      ? { ok: true, delayMs, error: "" }
      : { ok: false, delayMs: 0, error: "超时内不可达", durationMs: DELAY_PROBE_TIMEOUT_MS };
    if (onEach) await onEach(entry, result);
  }
}

// 批量可达性扫描：把 N 个节点写进一个 curl 配置文件（--next 分隔，各自独立代理），
// 单进程 --parallel 并发跑完。逐节点单独起进程会被 Neutralino 运行时串行化，
// 实测 179 节点要 233 秒；本方案实测 3 秒。
// 单轮批量：返回 Map<port, {http, ms, body}>，body 用于 Anthropic 特征校验
async function runGateRound(assets, usable, timeoutSeconds, roundTag, concurrency = CODEX_PROBE_GATE_CONCURRENCY) {
  const blocks = usable.map((item, index) => [
    index ? "--next" : null,
    `--proxy "http://127.0.0.1:${item.port}"`,
    '--data-binary "@gate.json"',
    '--header "content-type: application/json"',
    `--write-out "R ${item.port} %{http_code} %{time_total}\\n"`,
    `--output "gate-out-${roundTag}-${item.port}.txt"`,
    `--max-time ${timeoutSeconds}`,
    `--connect-timeout ${timeoutSeconds}`,
    'url = "' + gateProbeUrl() + '"'
  ].filter(Boolean).join("\n"));
  const confName = `gate-batch-${roundTag}.conf`;
  const confPath = await Neutralino.filesystem.getJoinedPath(assets.dir, confName);
  await Neutralino.filesystem.writeFile(confPath, blocks.join("\n\n") + "\n");
  const byPort = new Map();
  try {
    const result = await Neutralino.os.execCommand(
      `curl.exe -s -K ${confName} --parallel --parallel-max ${Math.min(concurrency, usable.length)}`,
      { cwd: assets.dir }
    );
    for (const line of String(result.stdOut || "").split(/\r?\n/)) {
      if (!line.startsWith("R ")) continue;
      const parts = line.trim().split(/\s+/);
      const port = Number(parts[1]);
      if (!port) continue;
      byPort.set(port, {
        http: Number(parts[2]),
        ms: Math.max(1, Math.round(Number(parts[3]) * 1000))
      });
    }
    for (const item of usable) {
      const outPath = await Neutralino.filesystem.getJoinedPath(assets.dir, `gate-out-${roundTag}-${item.port}.txt`);
      let body = "";
      try { body = await Neutralino.filesystem.readFile(outPath); } catch (err) { /* 无响应体 */ }
      await removeFileIfExists(outPath);
      const rec = byPort.get(item.port);
      if (rec) rec.body = body;
      else byPort.set(item.port, { http: 0, ms: 0, body });
    }
    return byPort;
  }
  finally {
    await removeFileIfExists(confPath);
  }
}

// 批量可达性扫描：把 N 个节点写进一个 curl 配置文件（--next 分隔，各自独立代理），
// 单进程 --parallel 并发跑完。逐节点单独起进程会被 Neutralino 运行时串行化，
// 实测 179 节点要 233 秒；本方案单轮实测 3 秒。
// 判据见 GATE_STRICT_CODES 处注释：400/401 + Anthropic body + 连续 repeat 轮全过。
async function runBatchGateScan(items, timeoutSeconds = PROBE_GATE_TIMEOUT_S, repeat = GATE_REPEAT_BATCH) {
  const assets = await ensureProbeAssets();
  const usable = items.filter((item) => Number(item.port) > 0);
  if (!usable.length) return new Map();
  if (!GATE_CHECK_ENABLED) {
    return new Map(usable.map((item) => [item.port, {
      ok: null, http: 0, ms: 0, msMax: 0, passCount: 0, roundCount: 0, gateSkipped: true, error: "Anthropic 可达性未测量"
    }]));
  }
  const rounds = Math.max(1, Math.trunc(Number(repeat) || 1));
  const agg = new Map(usable.map((item) => [item.port, { pass: 0, msSum: 0, msMax: 0, http: 0, error: "" }]));
  // 首轮全量高并发（秒级筛掉 DNS 死入口/403/连不上），复核轮只针对首轮通过者
  // 且并发降到 GATE_RECHECK_CONCURRENCY——实测 179 路并发会把 ANYTLS 一族打抖
  // （并发下 1/3 通过，串行 5/5 通过），高并发复核等于误杀好节点。
  let pool = usable;
  for (let round = 0; round < rounds; round++) {
    if (round) {
      await sleep(GATE_ROUND_GAP_MS);
      pool = usable.filter((item) => agg.get(item.port).pass === round);
      if (!pool.length) break;
    }
    const byPort = await runGateRound(
      assets, pool, timeoutSeconds, `${Date.now()}-${round}`,
      round ? GATE_RECHECK_CONCURRENCY : CODEX_PROBE_GATE_CONCURRENCY
    );
    for (const item of pool) {
      const rec = byPort.get(item.port) || { http: 0, ms: 0, body: "" };
      const acc = agg.get(item.port);
      const httpOk = GATE_STRICT_CODES.has(rec.http);
      const bodyOk = GATE_ANTHROPIC_RE.test(String(rec.body || ""));
      if (rec.http) acc.http = rec.http;
      if (httpOk && bodyOk) {
        acc.pass++;
        acc.msSum += rec.ms;
        acc.msMax = Math.max(acc.msMax, rec.ms);
      }
      else if (!acc.error) {
        acc.error = !rec.http ? "连接失败"
          : rec.http === 403 ? "HTTP 403（出口被 Anthropic 拒绝）"
            : httpOk ? "响应不是 Anthropic（疑似劫持/中转假页）"
              : `HTTP ${rec.http}`;
      }
    }
  }
  const out = new Map();
  for (const [port, acc] of agg) {
    const ok = acc.pass === rounds;
    out.set(port, {
      ok,
      http: acc.http,
      ms: acc.pass ? Math.round(acc.msSum / acc.pass) : 0,
      msMax: acc.msMax,
      passCount: acc.pass,
      roundCount: rounds,
      error: ok ? "" : (acc.error || `仅 ${acc.pass}/${rounds} 次通过（时通时断）`)
    });
  }
  return out;
}

// gate:出口能否到达 Anthropic API。与批量扫描共用同一套判据，避免两处漂移。
async function runAnthropicGate(proxyPort, repeat = GATE_REPEAT_GUARD) {
  const byPort = await runBatchGateScan([{ port: Number(proxyPort) }], PROBE_GATE_TIMEOUT_S, repeat);
  const rec = byPort.get(Number(proxyPort));
  if (!rec) return { ok: false, http: 0, ms: 0, passCount: 0, roundCount: repeat, error: "无探测结果" };
  return rec;
}

function tokProbeFailure(scope, error, extra = {}) {
  return {
    ...extra,
    ok: false,
    failureScope: scope === "model" ? "model" : "node",
    error: String(error && (error.message || error) || "tok/s 测速失败").slice(0, 240)
  };
}

function codexProbeFailureScope(error) {
  const detail = String(error && (error.message || error) || "");
  return /codex executable|app-server (?:failed|exited|unavailable|could not start)|initialize (?:failed|error)|thread\/?start.*(?:failed|error)|requested model .* codex resolved|model .*?(?:not found|unavailable|unsupported)|auth(?:entication)?|unauthorized|sign.?in|log.?in|subscription|rate.?limit|quota|usage.?limit/i.test(detail)
    ? "model"
    : "node";
}

async function runCodexSubscriptionModelProbe(item, scriptPath) {
  const port = Number(item.port);
  try {
    const command = buildPowerShellExecCommand([
      `$probe=${psQuote(scriptPath)}`,
      `& $probe -ProxyPort ${port} -Model ${psQuote(CODEX_TOK_PROBE_MODEL)} -TimeoutSeconds ${CODEX_TOK_PROBE_TIMEOUT_S}`
    ].join("\r\n"));
    const result = await Neutralino.os.execCommand(command, { cwd: state.paths.work });
    const lines = String(result.stdOut || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    let parsed = null;
    try { parsed = lines.length ? JSON.parse(lines[lines.length - 1]) : null; }
    catch { parsed = null; }
    if (!parsed || typeof parsed !== "object") {
      const detail = String(result.stdErr || "").trim();
      return tokProbeFailure("model", detail || "Codex subscription probe returned no JSON", { http: 0 });
    }
    if (parsed.ok !== true) {
      return tokProbeFailure(codexProbeFailureScope(parsed.error), parsed.error, { ...parsed, http: Number(parsed.http || 0) });
    }
    if (parsed.resolvedModelVerified !== true
      || parsed.requestedModel !== CODEX_TOK_PROBE_MODEL
      || parsed.resolvedModel !== CODEX_TOK_PROBE_MODEL) {
      return tokProbeFailure("model", "Codex subscription probe did not verify the requested model", { http: 0 });
    }
    return { ...parsed, probeModelId: "codex-subscription" };
  }
  catch (error) {
    return tokProbeFailure("model", error, { http: 0 });
  }
}

function parseTokenMixStream(bodyText) {
  let characters = 0;
  let resolvedModel = "";
  let apiError = "";
  const source = String(bodyText || "");
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
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
    catch { /* ignore non-JSON curl diagnostics */ }
  }
  if (!resolvedModel) {
    const match = source.match(/"model"\s*:\s*"([^"]+)"/);
    if (match) resolvedModel = match[1];
  }
  return { characters, resolvedModel, apiError };
}

function tokenMixChannelFailure(http, detail) {
  return http === 401 || http === 402 || http === 404 || http === 429 || http >= 500
    || /model.*(?:not found|unavailable|unsupported)|does not exist|auth(?:entication)?|invalid api key|quota|rate.?limit/i.test(String(detail || ""));
}

async function runTokenMixModelProbe(item) {
  const port = Number(item.port);
  const assets = await ensureProbeAssets();
  const key = await tokenMixProbeKey();
  const stamp = `${Date.now()}-${port}-${++tokenMixProbeSequence}`;
  const bodyName = `tokenmix-body-${stamp}.json`;
  const confName = `tokenmix-${stamp}.conf`;
  const outName = `tokenmix-out-${stamp}.txt`;
  const bodyPath = await Neutralino.filesystem.getJoinedPath(assets.dir, bodyName);
  const confPath = await Neutralino.filesystem.getJoinedPath(assets.dir, confName);
  const outPath = await Neutralino.filesystem.getJoinedPath(assets.dir, outName);
  try {
    await Neutralino.filesystem.writeFile(bodyPath, JSON.stringify({
      model: TOKENMIX_TOK_PROBE_MODEL,
      stream: true,
      max_tokens: TOKENMIX_TOK_PROBE_MAX_TOKENS,
      messages: [{ role: "user", content: "Count from 1 to 60 in words, one per line." }]
    }));
    await Neutralino.filesystem.writeFile(confPath, [
      `--proxy "http://127.0.0.1:${port}"`,
      `--header "Authorization: Bearer ${key}"`,
      '--header "content-type: application/json"',
      `--data-binary "@${bodyName}"`,
      "--no-buffer",
      `--write-out "T %{http_code} %{time_starttransfer} %{time_total}\\n"`,
      `--output "${outName}"`,
      `--max-time ${TOKENMIX_TOK_PROBE_TIMEOUT_S}`,
      `--connect-timeout ${Math.min(10, TOKENMIX_TOK_PROBE_TIMEOUT_S)}`,
      `url = "${TOKENMIX_TOK_PROBE_URL}"`
    ].join("\n") + "\n");
    const result = await Neutralino.os.execCommand(`curl.exe -sS -K ${confName}`, { cwd: assets.dir });
    const statLine = String(result.stdOut || "").split(/\r?\n/).map((line) => line.trim()).find((line) => line.startsWith("T "));
    const parts = statLine ? statLine.split(/\s+/) : [];
    const http = Number(parts[1] || 0);
    const startSeconds = Number(parts[2] || 0);
    const totalSeconds = Number(parts[3] || 0);
    let bodyText = "";
    try { bodyText = await Neutralino.filesystem.readFile(outPath); } catch { /* no response body */ }
    const parsed = parseTokenMixStream(bodyText);
    const detail = parsed.apiError || String(result.stdErr || "").trim().split(/\r?\n/)[0] || "TokenMix request failed";
    if (!http) return tokProbeFailure("node", detail, { http: 0 });
    if (http !== 200) {
      return tokProbeFailure(tokenMixChannelFailure(http, detail) ? "model" : "node", `TokenMix HTTP ${http}: ${detail}`, { http });
    }
    if (parsed.resolvedModel !== TOKENMIX_TOK_PROBE_MODEL) {
      return tokProbeFailure("model", `TokenMix resolved unexpected model ${parsed.resolvedModel || "(missing)"}`, { http });
    }
    const streamMs = Math.max(0, Math.round((totalSeconds - startSeconds) * 1000));
    const ttftMs = Math.max(1, Math.round(startSeconds * 1000));
    if (parsed.characters < 40) {
      return tokProbeFailure("node", "TokenMix response was too short", { http, ttftMs });
    }
    const tokEst = Math.max(1, Math.round(parsed.characters / 4));
    return {
      ok: true,
      http,
      ttftMs,
      tokEst,
      streamMs,
      elapsedMs: Math.max(1, Math.round(totalSeconds * 1000)),
      tokPerSec: Math.round((tokEst / Math.max(0.001, totalSeconds)) * 10) / 10,
      requestedModel: TOKENMIX_TOK_PROBE_MODEL,
      resolvedModel: parsed.resolvedModel,
      resolvedModelVerified: true,
      modelVerificationSource: "tokenmix-sse-model",
      streamBuffered: streamMs < TOKENMIX_TOK_PROBE_MIN_STREAM_MS,
      timingSource: "request-end-to-end-tok",
      probeModelId: "tokenmix"
    };
  }
  finally {
    await removeFileIfExists(outPath);
    await removeFileIfExists(confPath);
    await removeFileIfExists(bodyPath);
  }
}

// The legacy function name is internal compatibility only; no model/account inputs.
async function runBatchTokProbe(items, options = {}) {
  const usable = SmartProxyConfig.uniqueCodexProbeItems(items.filter(item => item.entry?.key), item => item.entry.key);
  const byKey = new Map();
  if (!usable.length) return byKey;
  const scriptPath = await dualModelProbeScriptPath(), nodePath = await resolveProbeNodeRuntime();
  const endpoint = StreamQuality.endpoint(state.settings.streamQualityEndpoint || STREAM_QUALITY_ENDPOINT);
  const rounds = state.settings.streamQualityRounds === 3 ? 3 : 1;
  const config = SmartProxyConfig.buildSingBoxConfig(cloneConfig(state.mergedSourceConfig || state.sourceConfig), {
    groupName: "SQ-ISOLATED", nodeNames: usable.map(item => item.entry.tag || item.entry.node),
    forcedDomains: [], customRules: [], customOnlyRoutes: true, port: 1080, controllerPort: 9090,
    secret: "unused-isolated-controller", probeLanes: null, logLevel: "error"
  });
  const payload = await SmartProxyStreamQuality.execute({ ns: Neutralino, workDir: state.paths.work, nodePath, scriptPath,
    job: { endpoint, rounds, corePath: selectedCorePath(), config,
      nodes: usable.map(item => ({ key: item.entry.key, tag: item.entry.tag || item.entry.node })) } }, {
    log, onJob: job => { state.probeJob = job; }, isCancelled: () => state.codexProbeCancelRequested,
    onEvent: event => {
      if (event.type === "log") log(`Stream Quality: ${String(event.message || "").slice(0, 500)}`);
      if (event.type === "start") {
        state.lastProbeRoundId = event.roundId || "";
        log(`Stream Quality ${event.profile}; serial ${rounds} round(s), max ${(event.maxDownloadBytes / 1048576).toFixed(0)} MiB download; isolated core`);
      }
      if (event.type === "progress" && !state.codexProbeCancelRequested) {
        state.codexProbeCompleted = Number(event.completed || 0); state.codexProbeTotal = Number(event.total || usable.length);
        if (typeof options.onProgress === "function") options.onProgress(event);
        renderProxyNodes();
      }
    }
  });
  state.modelProbeNotice = "";
  byKey.roundInfo = payload;
  if (payload.cancelled) state.lastProbeRoundId = "";
  for (const record of payload.outcomes || []) byKey.set(record.key, record.value);
  for (const item of usable) if (!byKey.has(item.entry.key)) byKey.set(item.entry.key, { ok: false, failureScope: "round", error: "本轮未返回节点结果" });
  log(`Stream Quality completed ${byKey.size} nodes in ${payload.elapsedMs}ms; daily core and selection untouched`);
  return byKey;
}

async function togglePhoneQualityController() {
  if (state.phoneProbeController) { await state.phoneProbeController.stop(); return; }
  if (state.phoneProbeStarting || state.codexProbeRunning || state.codexProbePreparing || state.networkProbeJob) throw new Error("请先停止现有测速或等待准备完成");
  await ensureCodexProbeReady();
  state.phoneProbeStarting = true;
  try {
    const entries = state.subscriptionNodeCatalog;
    if (!entries.length) throw new Error("没有缓存订阅节点");
    const runnerPath = await dualModelProbeScriptPath();
    const resourceDir = runnerPath.replace(/[\\/][^\\/]+$/, "");
    await ensureDirectory(await Neutralino.filesystem.getJoinedPath(resourceDir, "web"));
    for (const file of ["web/index.html", "web/app.js", "web/controller.js", "web/style.css"]) await bundledProbeScriptPath(file, "Stream Quality phone UI");
    const scriptPath = await bundledProbeScriptPath("controller.cjs", "Stream Quality private controller");
    const config = SmartProxyConfig.buildSingBoxConfig(cloneConfig(state.mergedSourceConfig || state.sourceConfig), {
      groupName: "SQ-ISOLATED", nodeNames: entries.map(e => e.tag || e.node), forcedDomains: [], customRules: [], customOnlyRoutes: true, probeLanes: null, logLevel: "error"
    });
    const owner = await SmartProxyStreamQuality.serve({ ns: Neutralino, workDir: state.paths.work, scriptPath, nodePath: await resolveProbeNodeRuntime(),
      job: { endpoint: state.settings.streamQualityEndpoint || STREAM_QUALITY_ENDPOINT, corePath: selectedCorePath(), config,
        nodes: entries.map(e => ({ key: e.key, tag: e.tag || e.node, label: e.node,
          subscriptions: e.subscriptionNames || [e.subscriptionName] })), history: Object.fromEntries(state.nodeCodexResults) } }, {
      log, onClose: () => { state.phoneProbeController = null; $("phonePairCode").value = ""; $("phonePairing").hidden = true; $("phoneQualityBtn").textContent = "启动手机控制"; log("Phone controller stopped; daily core untouched"); },
      onEvent: event => {
        if (event.type === "log") log(`Phone Stream Quality: ${String(event.message || "").slice(0, 500)}`);
        if (event.type === "start") state.lastProbeRoundId = event.roundId || "";
        if (event.type === "result") {
          if (event.cancelled) state.lastProbeRoundId = "";
          for (const record of event.outcomes || []) { const entry = catalogEntryByKey(record.key); if (entry) storeCodexProbeResult(entry, buildTokResult(entry, null, record.value)); }
          renderProxyNodes();
        }
      }
    });
    state.phoneProbeController = owner;
    $("phonePairCode").value = owner.token;
    $("phoneLocalUrl").value = `http://127.0.0.1:${owner.port}`;
    $("phonePairing").hidden = false; $("phoneQualityBtn").textContent = "停止手机控制";
    log(`Phone controller ready on loopback ${owner.port}; private HTTPS access must be configured separately. Local measurements paused; no daily routing changes.`);
  } finally { state.phoneProbeStarting = false; }
}

// Shared result envelope; Stream Quality has no model tokens or account gate.
function buildTokResult(entry, gate, tok) {
  const base = { node: entry.tag || entry.node, anthropicOk: gate?.gateSkipped || !gate ? null : gate.ok,
    gateRounds: gate?.roundCount || 0, gateSkipped: !gate || gate.gateSkipped === true,
    anthropicHttp: gate?.http || 0, anthropicMs: gate?.ms || 0, routeVerification: "static-node-lane", measuredAt: Date.now() };
  if (!tok?.ok) return { ...base, status: tok?.failureScope === "cancelled" ? "cancelled" : "error",
    failureScope: tok?.failureScope || "round", error: tok?.error || "未获得完整测速结果", roundId: tok?.roundId || "" };
  return { ...base, ...tok, status: "ok", successCount: 1, probeReachable: true,
    routeVerification: "isolated-node-lane", serverConfirmed: true };
}

async function runCodexNetworkProbeAttempt(entry, laneIndex = 0, uploadBytes = 0, probeOptions = {}) {
  const startedAt = Date.now();
  try {
    if (state.codexProbeCancelRequested) return { status: "cancelled", failureScope: "cancelled", node: entry.tag || entry.node };
    const tokMap = await runBatchTokProbe([{ entry }]);
    return buildTokResult(entry, null, tokMap.get(entry.key) || { ok: false, failureScope: "round", error: "无测速结果" });
  }
  catch (err) {
    return {
      status: "error",
      durationMs: Math.max(1, Math.min(PROBE_TIMEOUT_MS, Date.now() - startedAt)),
      connectionCount: 0,
      attemptCount: 1,
      successCount: 0,
      error: `上传测速失败：${String(err.message || err)}`
    };
  }
}

async function runCodexNetworkProbe(entry, laneIndex = 0, uploadBytes = PROBE_FINAL_UPLOAD_BYTES, probeOptions = {}) {
  const maxAttempts = 1; // repetitions are explicit and interleaved by Stream Quality
  return SmartProxyConfig.runCodexProbeWithRetry(
    () => runCodexNetworkProbeAttempt(entry, laneIndex, uploadBytes, probeOptions),
    {
      maxAttempts,
      shouldRetry: (result) => !state.codexProbeCancelRequested && SmartProxyConfig.shouldRetryCodexProbe(result),
      onRetry: async ({ nextAttempt, result }) => {
        log(`Codex probe transient failure, retry ${nextAttempt}/${maxAttempts}: ${entry.subscriptionName}/${entry.node} - ${result.error || "unknown error"}`);
        await sleep(250);
      }
    }
  );
}

function catalogEntryByKey(key) {
  return state.subscriptionNodeCatalog.find((entry) => entry.key === key) || null;
}

function catalogEntriesForSubscription(subscriptionId) {
  return state.subscriptionNodeCatalog.filter((entry) => entry.subscriptionId === subscriptionId);
}

function codexSuccessfulCatalogEntries(entries) {
  const current = [...(entries || [])]
    .filter((entry) => state.nodeCodexResults.get(entry.key)?.status === "done")
    .sort((left, right) => {
      const leftResult = state.nodeCodexResults.get(left.key);
      const rightResult = state.nodeCodexResults.get(right.key);
      const anthropic = Number(rightResult.anthropicOk !== false) - Number(leftResult.anthropicOk !== false);
      if (anthropic) return anthropic;
      const verified = Number(!!rightResult.verified) - Number(!!leftResult.verified);
      if (verified) return verified;
      const tok = Number(rightResult.tokPerSec || 0) - Number(leftResult.tokPerSec || 0);
      return tok || String(left.key).localeCompare(String(right.key));
    });
  return current;
}

async function requestCodexProbeCancel() {
  state.networkProbeJob?.abort();
  state.codexProbeCancelRequested = true;
  if (state.probeJob?.proc) {
    try { await Neutralino.os.updateSpawnedProcess(state.probeJob.proc.id, "stdIn", '{"action":"cancel"}\n'); }
    catch (err) { log(`Probe cancellation delivery failed: ${err.message || err}`); }
  }
  renderProxyNodes();
}

function storeCodexProbeResult(entry, result) {
  const status = result.status === "ok" ? "done" : result.status;
  const candidate = { ...result, status };
  const merged = SmartProxyConfig.mergeCodexProbeResult(state.nodeCodexResults.get(entry.key), candidate);
  state.nodeCodexResults.set(entry.key, merged);
  state.codexProbePendingKeys.delete(entry.key);
  state.codexProbeLastKey = entry.key;
  const store = state.settings.streamQualityStore || (state.settings.streamQualityStore = { version: 1, updatedAt: 0, results: {} });
  store.results ||= {};
  store.results[entry.key] = SmartProxyConfig.normalizeCodexProbeResult(merged);
  store.updatedAt = Date.now();
  scheduleSettingsPersist("probe result batch");
  return merged;
}

function markCodexProbePending(entry) {
  if (entry && entry.key) state.codexProbePendingKeys.add(entry.key);
}

async function testCodexNode(key) {
  if (!key) throw new Error("未指定要测试的节点");
  if (state.codexProbeRunning) {
    if (state.codexProbeBusyKey === key) return requestCodexProbeCancel();
    throw new Error("Codex 节点测试正在运行");
  }
  if (!state.subscriptionNodeCatalog.length) await refreshSubscriptionNodeCatalog();
  const entry = catalogEntryByKey(key);
  if (!entry) throw new Error("节点不在统一节点缓存中");
  await ensureCodexProbeReady();

  state.codexProbeRunning = true;
  state.codexProbeMode = "single";
  state.codexProbeBusyKey = entry.key;
  state.codexProbeCompleted = 0;
  state.codexProbeTotal = 1;
  state.codexProbeCancelRequested = false;
  markCodexProbePending(entry);
  renderProxyNodes();
  try {
    const result = await runCodexNetworkProbe(entry);
    state.codexProbeCompleted = 1;
    const stored = storeCodexProbeResult(entry, result);
    const metric = stored.status === "done" && stored.download ? ` ${stored.stream.flowPass ? "流式达标" : "有波动"} / ${stored.download.mbps.toFixed(1)} Mbps` : "";
    const detail = result.error ? " - " + result.error : "";
    log("Codex network probe " + result.status + ": " + entry.subscriptionName + "/" + entry.node + metric + detail);
    return stored;
  }
  catch (err) {
    const stored = {
      status: "error",
      error: String(err.message || err),
      durationMs: 0,
      connectionCount: 0
    };
    storeCodexProbeResult(entry, stored);
    state.codexProbeLastKey = entry.key;
    throw err;
  }
  finally {
    state.codexProbeRunning = false;
    state.codexProbeMode = "";
    state.codexProbeBusyKey = "";
    state.codexProbeCancelRequested = false;
    state.codexProbePendingKeys.clear();
    renderProxyNodes();
  }
}


async function testAllCodexNodes(options = {}) {
  if (state.codexProbeRunning) return requestCodexProbeCancel();
  const benchmarkStartedAt = Date.now();
  if (!state.subscriptionNodeCatalog.length) await refreshSubscriptionNodeCatalog();
  await ensureCodexProbeReady();
  const scoped = Array.isArray(options.entries) && options.entries.length ? options.entries : null;
  let entries = SmartProxyConfig.uniqueCodexProbeItems(scoped || state.subscriptionNodeCatalog, entry => entry.key);
  if (!entries.length) throw new Error("没有可测试的节点");
  entries = SmartProxyConfig.rankCodexProbeEntries(entries, state.nodeCodexResults);
  // All cached subscription nodes get independent ephemeral lanes, including inactive nodes.
  const limit = Math.max(0, Math.trunc(Number(options.limit || 0)));
  if (limit) entries = entries.slice(0, limit);
  if (!entries.length) throw new Error("没有缓存节点可测；请先导入订阅或离线 YAML");
  state.codexProbeRunning = true;
  state.codexProbeMode = options.continuous ? "continuous" : scoped ? "group" : "all";
  state.codexProbeCancelRequested = false; state.codexProbeCompleted = 0; state.codexProbeTotal = entries.length;
  entries.forEach(markCodexProbePending); renderProxyNodes();
  const byKey = new Map(entries.map(entry => [entry.key, entry]));
  try {
    const tokMap = await runBatchTokProbe(entries.map(entry => ({ entry })), {
      onProgress: event => {
        const entry = byKey.get(event.key);
        if (!entry) return;
        state.codexProbeBusyKey = entry.key;
        // Show progress without prematurely replacing durable results. The final
        // outcome may still be an account, environment, or cancellation failure.
      }
    });
    const currentKeys = new Set(), gates = new Map(), roundResults = new Map();
    let failed = 0;
    for (const entry of entries) {
      const value = state.codexProbeCancelRequested ? { ok: false, failureScope: "cancelled", error: "测速已停止" }
        : tokMap.get(entry.key);
      const result = buildTokResult(entry, null, value);
      roundResults.set(entry.key, result);
      const stored = storeCodexProbeResult(entry, result);
      if (result.status === "ok") currentKeys.add(entry.key); else failed++;
      gates.set(entry.key, { ok: null });
      if (typeof options.onResult === "function") await options.onResult(entry, stored);
      if (result.status === "error") log(`Benchmark ${result.failureScope} failure; previous success retained: ${entry.node} - ${result.error}`);
    }
    const verifiedRanked = state.codexProbeCancelRequested || tokMap.roundInfo?.channelFailure ? []
      : SmartProxyConfig.rankCurrentCodexProbeEntries(entries, state.nodeCodexResults, gates, currentKeys);
    const winner = verifiedRanked[0];
    if (winner) log(`Benchmark candidate verified with >=3 successful samples: ${winner.node}; selection and connections unchanged`);
    else log("Benchmark has no comparable three-sample winner; selection and connections unchanged");
    const benchmarkElapsedMs = Math.max(1, Date.now() - benchmarkStartedAt);
    log(`Benchmark completed: ${currentKeys.size}/${entries.length} measured, ${verifiedRanked.length} fully sampled finalists, ${failed} unfinished/failed, ${(benchmarkElapsedMs / 1000).toFixed(1)}s`);
    evaluateBenchmarkSubscriptionEvidence(entries, roundResults,
      { cancelled: state.codexProbeCancelRequested, channelFailure: !!tokMap.roundInfo?.channelFailure });
    return { total: entries.length, successful: currentKeys.size, reachable: currentKeys.size,
      finalists: verifiedRanked.length, verified: verifiedRanked.length, modelFailures: tokMap.roundInfo?.channelFailure ? failed : 0,
      cancelled: state.codexProbeCancelRequested, elapsedMs: benchmarkElapsedMs };
  } catch (err) {
    log(`Benchmark infrastructure failure; existing scores retained: ${err.message || err}`);
    for (const entry of entries) storeCodexProbeResult(entry, { status: "error", failureScope: "local", error: String(err.message || err) });
    throw err;
  } finally {
    state.codexProbeRunning = false; state.codexProbeMode = ""; state.codexProbeBusyKey = "";
    state.codexProbeCancelRequested = false; state.codexProbePendingKeys.clear(); renderProxyNodes();
  }
}

// 分组测速:只测该订阅的节点,冠军切换自然限定在组内
async function testCodexGroup(subscriptionId) {
  if (state.codexProbeRunning) return requestCodexProbeCancel();
  const entries = catalogEntriesForSubscription(subscriptionId);
  if (!entries.length) throw new Error("该订阅暂无缓存节点");
  return testAllCodexNodes({ entries });
}

function stopContinuousCompetition(reason = "disabled") {
  const wasDesired = state.continuousProbeDesired;
  state.continuousProbeDesired = false;
  if (state.codexProbeRunning && state.codexProbeMode === "continuous") {
    state.codexProbeCancelRequested = true;
  }
  if (wasDesired) log(`Continuous upload competition stopping: ${reason}`);
}

async function applyContinuousRecord(entry, result) {
  if (!state.continuousProbeDesired || !result || result.status !== "done") return false;
  if (result.metricKind !== "stream-quality-v1" || !result.verified || !result.stream?.flowPass || result.lastAttempt?.status !== "done") return false;
  // Passing fixed flows tie; bandwidth records do not become automatic selections.
  state.continuousProbeBestKey ||= entry.key;
  log(`Continuous Stream Quality pass (manual selection only): ${entry.subscriptionName}/${entry.node}`);
  return true;
}

// 轮间等待:按设置的分钟数,分段 sleep 以便取消/关闭即时中断
async function waitContinuousRoundInterval() {
  const minutes = Math.max(0, Math.min(1440, Math.trunc(Number(state.settings.continuousProbeIntervalMinutes) || 0)));
  const totalMs = minutes > 0 ? minutes * 60000 : CONTINUOUS_PROBE_ROUND_DELAY_MS;
  const deadline = Date.now() + totalMs;
  while (Date.now() < deadline && state.continuousProbeDesired && !state.closing) {
    await sleep(Math.min(1000, Math.max(50, deadline - Date.now())));
  }
}

async function runContinuousCompetition() {
  log("Continuous upload competition started");
  while (state.continuousProbeDesired && state.mainCoreReady && !state.closing) {
    state.continuousProbeRound += 1;
    try {
      const fullRound = state.continuousForceFullRound
        || (Date.now() - state.lastFullProbeAt) >= CONTINUOUS_FULL_ROUND_INTERVAL_MS;
      const summary = await testAllCodexNodes({ continuous: true, uploadStages: fullRound, onResult: applyContinuousRecord });
      if (!state.continuousProbeDesired) break;
      if (fullRound && !state.codexProbeCancelRequested) {
        state.lastFullProbeAt = Date.now();
        state.continuousForceFullRound = false;
      }
      log(`Continuous ${fullRound ? "full" : "gate-only"} round ${state.continuousProbeRound} complete: ${summary.successful}/${summary.total}; next round in ${Math.max(0, Math.trunc(Number(state.settings.continuousProbeIntervalMinutes) || 0))} min`);
      await waitContinuousRoundInterval();
    }
    catch (err) {
      if (!state.continuousProbeDesired) break;
      log(`Continuous upload round ${state.continuousProbeRound} failed; retrying: ${err.message || err}`);
      await sleep(CONTINUOUS_PROBE_FAILURE_DELAY_MS);
    }
  }
  log("Continuous upload competition stopped");
}

function scheduleContinuousCompetition(reason = "sync") {
  if (!state.settings.continuousWssAutoSwitchEnabled || !state.mainCoreReady || state.closing) return null;
  state.continuousProbeDesired = true;
  if (state.continuousProbePromise) return state.continuousProbePromise;
  state.continuousProbeBestMbps = 0;
  state.continuousProbeBestKey = "";
  state.continuousProbeRound = 0;
  log(`Continuous upload competition scheduled: ${reason}`);
  state.continuousProbePromise = runContinuousCompetition()
    .catch((err) => log(`Continuous upload competition stopped by error: ${err.message || err}`))
    .finally(() => { state.continuousProbePromise = null; });
  return state.continuousProbePromise;
}

function syncContinuousCompetition(reason = "settings") {
  if (state.settings.continuousWssAutoSwitchEnabled) return scheduleContinuousCompetition(reason);
  stopContinuousCompetition(reason);
  return null;
}


// ---- 入口域名健康检查 ----
// 机场把上百个节点挂在少数几个入口域名下。域名一下线，该域名下所有节点
// 全部不可用（2026-08-06 实测：6 个入口有 2 个 NXDOMAIN，波及 127/179 个节点）。
// 逐节点测速要几分钟才发现，而按入口域名批量解析只需几秒。

function entryServerHost(entry) {
  const server = String((entry && entry.server) || "").trim();
  if (server) return server;
  // 旧缓存的 catalog 没有 server 字段，回退到从订阅配置里按节点名反查
  const node = String((entry && entry.node) || "");
  for (const config of state.subscriptionConfigs.values()) {
    const proxies = Array.isArray(config && config.proxies) ? config.proxies : [];
    const hit = proxies.find((proxy) => String(proxy && proxy.name || "") === node);
    if (hit && hit.server) return String(hit.server).trim();
  }
  return "";
}

function endpointDead(host) {
  // System DNS is a different resolver from the core. Its diagnostics can never
  // blacklist a route (including stale entries from a previous application load).
  state.deadEndpoints.delete(String(host || ""));
  return false;
}

function entryEndpointDead(entry) {
  const host = entryServerHost(entry);
  return host ? endpointDead(host) : false;
}

async function refreshEndpointDnsHealth(options = {}) {
  if (state.endpointDnsBusy) return null;
  const hosts = [...new Set(state.subscriptionNodeCatalog
    .map((entry) => entryServerHost(entry))
    .filter((host) => host && !/^\d+\.\d+\.\d+\.\d+$/.test(host)))];
  if (!hosts.length) return null;
  if (!options.force && state.endpointDnsCheckedAt
    && Date.now() - state.endpointDnsCheckedAt < ENDPOINT_DNS_RECHECK_MS) return null;
  state.endpointDnsBusy = true;
  try {
    const list = hosts.map((host) => psQuote(host)).join(",");
    const script = `$ErrorActionPreference='SilentlyContinue';`
      + `$out=@();foreach($h in @(${list})){`
      + `$r=@(Resolve-DnsName -Name $h -Type A -DnsOnly -QuickTimeout -ErrorAction SilentlyContinue);`
      + `$r+=@(Resolve-DnsName -Name $h -Type AAAA -DnsOnly -QuickTimeout -ErrorAction SilentlyContinue);`
      + `$out+=[PSCustomObject]@{h=$h;ok=[bool]($r | Where-Object { $_.IPAddress })}}`
      + `$out | ConvertTo-Json -Compress`;
    const result = await Neutralino.os.execCommand(buildPowerShellExecCommand(script));
    const raw = String(result && result.stdOut || "").trim();
    if (!raw) { log("Endpoint DNS diagnostic returned no data; no node state changed"); return null; }
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    const dead = [];
    for (const row of rows) {
      const host = String(row && row.h || "");
      if (!host) continue;
      state.deadEndpoints.delete(host);
      if (!row.ok) dead.push(host);
    }
    state.endpointDnsCheckedAt = Date.now();
    const affected = state.subscriptionNodeCatalog.filter((entry) => entryEndpointDead(entry)).length;
    if (dead.length) {
      log(`System DNS advisory: ${dead.length}/${hosts.length} hosts unresolved; core uses its own resolver, no nodes blocked and no automatic subscription update`);
    }
    else log(`Endpoint DNS check: all ${hosts.length} entry host(s) resolve`);
    renderProxyNodes();
    // DNS-only evidence must not alter subscriptions, node health, or the running core.
    return { hosts: hosts.length, dead: dead.length, affected };
  }
  catch (err) {
    log(`Endpoint DNS check failed: ${err.message || err}`);
    return null;
  }
  finally {
    state.endpointDnsBusy = false;
  }
}

// 针对单个订阅下载并落缓存（不动 active 订阅、不重启内核，纯网络操作）
async function downloadSubscriptionForProfile(profile, label = "auto-refresh") {
  const url = String(profile && profile.url || "").trim();
  if (!url) return null;
  const path = await subscriptionCachePathFor(profile);
  const headersPath = await subscriptionHeadersCachePathFor(profile);
  const name = profile.name || profile.id;
  let downloaded = null;
  try {
    downloaded = await runSubscriptionDownloadAttempt({ url, label: `${label} direct`, seconds: 12 });
  }
  catch (err) {
    log(`Subscription ${label} direct download failed (${name}): ${err.message || err}`);
  }
  if (!downloaded && state.mainProcess) {
    downloaded = await runSubscriptionDownloadAttempt({
      url, label: `${label} via proxy`, seconds: 30,
      proxyUrl: `http://127.0.0.1:${state.settings.mainPort}`
    }).catch((err) => {
      log(`Subscription ${label} proxy download failed (${name}): ${err.message || err}`);
      return null;
    });
  }
  if (!downloaded) return null;
  validateSubscriptionText(downloaded.configText, `订阅 ${name}`);
  await commitSubscriptionCache(downloaded, path, headersPath);
  await Neutralino.filesystem.writeFile(await subscriptionCacheSourcePathFor(profile), url);
  profile.cachedUrl = url;
  const temp = await subscriptionDownloadTempPaths();
  await Promise.all([removeFileIfExists(temp.config), removeFileIfExists(temp.headers)]);
  return downloaded;
}

async function readCachedSubscriptionConfig(profile) {
  const text = await readTextIfExists(await subscriptionCachePathFor(profile));
  if (!text) return null;
  try {
    return validateSubscriptionText(text, `订阅 ${profile.name || profile.id} 缓存`);
  }
  catch (err) {
    log(`Subscription cache unreadable for endpoint diff (${profile.name || profile.id}): ${err.message || err}`);
    return null;
  }
}

// ---- 订阅自动更新（按真实证据，不看系统 DNS）----
// 证据只有两种：① 一轮测速里该订阅 ≥ ENDPOINT_AUTO_RECOVER_RATIO 的节点连接级(node-scope)失败；
// ② 缓存年龄超过机场声明的 Profile-Update-Interval（默认 24h）。
// 命中后：后台拉新订阅 → 比对入口 host:port 集合 → 直连 TCP 探测新入口 → 只写缓存并提醒。
// 运行中的内核、当前节点、活动连接一律不动；新配置在下次手动启动代理时生效。
// 2026-09-14 实例：lovenao 换中转域名但保留旧域名 DNS 记录，DNS 诊断永远“正常”，
// 只有测速里 40/40 dial tcp i/o timeout 和线上订阅入口已变这两条证据能抓到。

function preferDistinctHosts(endpoints) {
  const seen = new Set();
  const distinct = [];
  const rest = [];
  for (const endpoint of endpoints || []) {
    const host = endpoint.slice(0, endpoint.lastIndexOf(":"));
    (seen.has(host) ? rest : distinct).push(endpoint);
    seen.add(host);
  }
  return distinct.concat(rest);
}

// 直连 TCP 探测入口 host:port，与内核拨号路径一致（绕过系统代理）。只回答“能否建立连接”。
async function probeEntryEndpointsTcp(endpoints, timeoutMs = ENTRY_TCP_PROBE_TIMEOUT_MS) {
  const targets = (endpoints || []).slice(0, ENTRY_TCP_PROBE_MAX);
  if (!targets.length) return [];
  const list = targets.map((endpoint) => psQuote(endpoint)).join(",");
  const waitMs = Math.max(1000, Math.trunc(Number(timeoutMs) || ENTRY_TCP_PROBE_TIMEOUT_MS));
  const script = `$ErrorActionPreference='SilentlyContinue';$out=@();foreach($t in @(${list})){`
    + "$i=$t.LastIndexOf(':');$h=$t.Substring(0,$i);$p=[int]$t.Substring($i+1);"
    + "$sw=[System.Diagnostics.Stopwatch]::StartNew();$ok=$false;"
    + `try{$c=New-Object System.Net.Sockets.TcpClient;$ok=($c.ConnectAsync($h,$p).Wait(${waitMs}) -and $c.Connected);$c.Close()}catch{$ok=$false};`
    + "$out+=[PSCustomObject]@{t=$t;ok=[bool]$ok;ms=[int]$sw.ElapsedMilliseconds}};"
    + "ConvertTo-Json -InputObject @($out) -Compress";
  const result = await Neutralino.os.execCommand(buildPowerShellExecCommand(script));
  const raw = String(result && result.stdOut || "").trim();
  if (!raw) throw new Error("entry TCP probe returned no data");
  const parsed = JSON.parse(raw);
  return (Array.isArray(parsed) ? parsed : [parsed]).map((row) => ({
    endpoint: String(row && row.t || ""),
    ok: !!(row && row.ok),
    ms: Number(row && row.ms || 0)
  }));
}

async function stageSubscriptionRefresh(profile, reason, evidence = "") {
  if (!profile || !String(profile.url || "").trim()) return null;
  const name = profile.name || profile.id;
  const detail = evidence ? `: ${evidence}` : "";
  if (state.settings.autoRecoverOnEndpointFailure === false) {
    log(`Subscription auto-refresh disabled by settings; ${name} not refreshed (${reason}${detail})`);
    return null;
  }
  if (state.autoRecoverBusy || state.subscriptionBusy) {
    log(`Subscription auto-refresh skipped (${reason}) for ${name}: another subscription operation is running`);
    return null;
  }
  const lastAt = state.subscriptionRefreshLastAt.get(profile.id) || 0;
  if (lastAt && Date.now() - lastAt < ENDPOINT_AUTO_RECOVER_COOLDOWN_MS) {
    const remaining = Math.ceil((ENDPOINT_AUTO_RECOVER_COOLDOWN_MS - (Date.now() - lastAt)) / 60000);
    log(`Subscription auto-refresh skipped (${reason}) for ${name}: cooldown, ${remaining} min remaining`);
    return null;
  }
  state.autoRecoverBusy = true;
  state.subscriptionRefreshLastAt.set(profile.id, Date.now());
  try {
    log(`Subscription auto-refresh (${reason}) for ${name}${detail}`);
    const previous = await readCachedSubscriptionConfig(profile) || state.subscriptionConfigs.get(profile.id) || null;
    const downloaded = await downloadSubscriptionForProfile(profile, "auto-refresh");
    if (!downloaded) {
      recordSubscriptionRefresh(profile, { lastCheckedAt: Date.now(), error: "下载失败；保留缓存，冷却 20 分钟后重试" });
      log(`Subscription auto-refresh (${reason}) for ${name}: download failed; cache and running core unchanged`);
      return { profileId: profile.id, name, reason, downloaded: false };
    }
    const next = validateSubscriptionText(downloaded.configText, `订阅 ${name}`);
    const diff = SmartProxyConfig.diffSubscriptionEndpoints(previous, next);
    const contentChanged = JSON.stringify(previous) !== JSON.stringify(next);
    recordSubscriptionRefresh(profile, { lastCheckedAt: Date.now(), lastSuccessAt: Date.now(), error: "", pending: contentChanged || !!state.settings.subscriptionRefreshStatus?.[profile.id]?.pending });
    const outcome = { profileId: profile.id, name, reason, downloaded: true, diff, contentChanged, reachable: [], unreachable: [] };
    if (!contentChanged) {
      const pending = state.pendingConfigApply;
      if (pending && pending.profileId === profile.id) {
        log(`Subscription auto-refresh (${reason}) for ${name}: upstream unchanged since staged refresh; waiting for a manual proxy start`);
        if ($("subscriptionStatus")) $("subscriptionStatus").textContent = `${name} 已下载，待下次手动启动代理生效`;
      }
      else {
        log(`Subscription auto-refresh (${reason}) for ${name}: upstream entry endpoints unchanged (${diff.next}); cache and headers refreshed, nothing to apply`);
      }
      return outcome;
    }
    const probes = await probeEntryEndpointsTcp(preferDistinctHosts(diff.added)).catch((err) => {
      log(`Entry TCP probe failed for ${name}: ${err.message || err}`);
      return [];
    });
    outcome.reachable = probes.filter((probe) => probe.ok).map((probe) => probe.endpoint);
    outcome.unreachable = probes.filter((probe) => !probe.ok).map((probe) => probe.endpoint);
    const probeText = probes.map((probe) => `${probe.endpoint}=${probe.ok ? `${probe.ms}ms` : "fail"}`).join(", ") || "not probed";
    log(`Subscription auto-refresh (${reason}) for ${name}: entry endpoints changed +${diff.added.length}/-${diff.removed.length}; new entries reachable ${outcome.reachable.length}/${probes.length} (${probeText})`);
    if (!outcome.reachable.length) log(`Subscription auto-refresh (${reason}) for ${name}: new entries not verified; cache staged, reachability is advisory only`);
    state.pendingConfigApply = {
      at: Date.now(), profileId: profile.id, name, reason,
      added: diff.added.length, removed: diff.removed.length,
      reachable: outcome.reachable.length, probed: probes.length
    };
    scheduleConfigApply();
    return outcome;
  }
  catch (err) {
    recordSubscriptionRefresh(profile, { lastCheckedAt: Date.now(), error: String(err.message || err).slice(0, 300) });
    log(`Subscription auto-refresh (${reason}) for ${name} failed: ${err.message || err}; running core unchanged`);
    return null;
  }
  finally {
    state.autoRecoverBusy = false;
    renderSubscriptionRefreshStatus();
  }
}

// 测速轮结束后的证据评估：只用本轮 node-scope 失败，按订阅统计；账户/模型/本机/取消都不算。
function evaluateBenchmarkSubscriptionEvidence(entries, roundResults, roundInfo = {}) {
  if (roundInfo.cancelled) {
    log("Benchmark subscription evidence skipped: round cancelled");
    return null;
  }
  if (roundInfo.channelFailure) {
    log("Benchmark subscription evidence skipped: account/model channel failure is not subscription evidence");
    return null;
  }
  const evidence = SmartProxyConfig.subscriptionRefreshEvidence(entries, roundResults, {
    ratio: ENDPOINT_AUTO_RECOVER_RATIO,
    excludeIds: [LOCAL_YAML_SOURCE_ID]
  });
  if (!evidence.stale.length) return evidence;
  const profiles = normalizeSubscriptionSettings();
  const tasks = [];
  for (const stat of evidence.stale) {
    const profile = profiles.find((item) => item.id === stat.subscriptionId && String(item.url || "").trim());
    if (!profile) continue;
    tasks.push({
      profile,
      evidence: `${stat.nodeFailures}/${stat.total} node-level failures this round (>= ${Math.round(ENDPOINT_AUTO_RECOVER_RATIO * 100)}%)`
    });
  }
  if (!tasks.length) return evidence;
  state.subscriptionRefreshPromise = (async () => {
    for (const task of tasks) await stageSubscriptionRefresh(task.profile, "benchmark", task.evidence);
  })().catch((err) => log(`Benchmark subscription evidence failed: ${err.message || err}`))
    .finally(() => { state.subscriptionRefreshPromise = null; });
  return evidence;
}

// 按机场声明的刷新周期后台刷新缓存（Profile-Update-Interval，默认 24h）。
async function subscriptionScheduledRefreshTick() {
  if (state.closing || !state.settingsLoaded) return null;
  if (state.settings.autoRecoverOnEndpointFailure === false) {
    if (!state.subscriptionRefreshDisabledLogged) {
      state.subscriptionRefreshDisabledLogged = true;
      log("Scheduled subscription refresh disabled by settings; caches age without background updates");
    }
    return null;
  }
  state.subscriptionRefreshDisabledLogged = false;
  const profiles = normalizeSubscriptionSettings().filter((profile) => String(profile.url || "").trim());
  const outcomes = [];
  for (const profile of profiles) {
    const path = await subscriptionCachePathFor(profile);
    let stats = null;
    try { stats = await Neutralino.filesystem.getStats(path); }
    catch { stats = null; }
    // Missing caches are due too; download failures must not postpone the next attempt for 24h.
    const headersText = await readTextIfExists(await subscriptionHeadersCachePathFor(profile));
    const hours = SmartProxyConfig.parseProfileUpdateIntervalHours(headersText, SUBSCRIPTION_REFRESH_DEFAULT_HOURS);
    const rawModified = Number(stats?.modifiedAt || 0);
    const modifiedAt = rawModified > 0 && rawModified < 1e12 ? rawModified * 1000 : rawModified;
    const since = Math.max(modifiedAt, Number(state.settings.subscriptionRefreshStatus?.[profile.id]?.lastSuccessAt || 0));
    const ageMs = since ? Date.now() - since : Infinity;
    if (ageMs < hours * 3600 * 1000) continue;
    const ageText = Number.isFinite(ageMs) ? `${Math.round(ageMs / 3600000)}h` : "unknown";
    outcomes.push(await stageSubscriptionRefresh(profile, "scheduled", `cache age ${ageText} >= interval ${hours}h`));
  }
  return outcomes;
}

function startSubscriptionRefreshScheduler() {
  if (state.subscriptionRefreshTimer) return;
  const tick = () => subscriptionScheduledRefreshTick()
    .catch((err) => log(`Scheduled subscription refresh failed: ${err.message || err}`));
  setTimeout(tick, SUBSCRIPTION_REFRESH_FIRST_TICK_MS);
  state.subscriptionRefreshTimer = setInterval(tick, SUBSCRIPTION_REFRESH_TICK_MS);
}

function scheduleConfigApply() {
  const pending = state.pendingConfigApply;
  if (!pending || pending.notified) return;
  pending.notified = true;
  log(`Refreshed subscription ready (${pending.name}: entry endpoints +${pending.added}/-${pending.removed}, ${pending.reachable}/${pending.probed} new entries reachable); running core unchanged, apply on next manual proxy start`);
  if ($("subscriptionStatus")) $("subscriptionStatus").textContent = `${pending.name} 已下载，待下次手动启动代理生效`;
  if (Neutralino.os && typeof Neutralino.os.showNotification === "function") {
    Neutralino.os.showNotification("Smart Proxy：新订阅已就绪",
      `${pending.name} 配置已下载（新增入口 ${pending.added}，已验证连通 ${pending.reachable}）；当前代理不重启，下次手动启动时生效`).catch(err => log(`Subscription notification failed: ${err.message || err}`));
  }
}

// ---- Website failure hot-switch: explicit opt-in, historical scores or random OTHER subscription ----
async function syncSiteFailoverState(reason) {
  if (!state.settings.siteFailoverEnabled) {
    log(`[site-failover] disabled (${reason}); existing manual-only policy retained`);
    return false;
  }
  try {
    const cfg = SmartProxySiteFailover.config(state.settings);
    const running = await api(mainController(), MAIN_SECRET, "/configs");
    state.siteFailoverLogReady = ["info", "debug", "trace"].includes(running?.["log-level"]);
    if (!state.siteFailoverLogReady) {
      log(`[site-failover] not armed: running core log level=${running?.["log-level"] || "unknown"}; info required for connection attribution; core unchanged`);
      return false;
    }
    log(`[site-failover] armed (${reason}): sites=${cfg.targets.map(t => t.host).join(",")} threshold=${cfg.threshold}/${cfg.windowMs / 1000}s cooldown=${cfg.cooldownMs / 1000}s; other-subscription historical best, random if no history; probes=0`);
    return true;
  } catch (err) {
    state.siteFailoverLogReady = false;
    log(`[site-failover] not armed: ${err.message || err}; no restart or silent fallback`);
    return false;
  }
}

function recordSiteFailoverSignal(level, payload) {
  if (!state.siteFailoverGuard) {
    state.siteFailoverGuard = SmartProxySiteFailover.createGuard({
      log,
      settings: () => state.settings,
      snapshot: () => ({ ready: state.mainCoreReady && state.siteFailoverLogReady && !state.closing && !state.networkProbeJob && !state.codexProbeRunning,
        node: state.currentNode, revision: state.siteFailoverRevision }),
      candidates: async excluded => {
        const group = await api(mainController(), MAIN_SECRET, `/proxies/${encodeURIComponent(state.settings.targetGroup)}`);
        return SmartProxySiteFailover.rankHistoricalAlternates(state.subscriptionNodeCatalog, state.nodeCodexResults,
          state.currentNode, Array.isArray(group?.all) ? group.all : [], excluded);
      },
      select: applySiteFailoverSelection
    });
  }
  return state.siteFailoverGuard.ingest(level, payload);
}

async function applySiteFailoverSelection(node, context) {
  const allowed = () => state.settings.siteFailoverEnabled === true && !state.closing && state.mainCoreReady && !state.networkProbeJob && !state.codexProbeRunning
    && state.siteFailoverRevision === context.revision && context.valid();
  if (!allowed()) { log("[site-failover] selection cancelled: settings/manual intent changed"); return false; }
  const groupName = state.settings.targetGroup;
  const endpoint = `/proxies/${encodeURIComponent(groupName)}`;
  const group = await api(mainController(), MAIN_SECRET, endpoint);
  if (!allowed() || group?.now !== context.node || !group?.all?.includes(node)) {
    log("[site-failover] selection cancelled: running group/current node changed or candidate absent"); return false;
  }
  // sing-box selector API hot-switches new connections; never reload config or restart.
  await api(mainController(), MAIN_SECRET, endpoint, { method: "PUT", body: JSON.stringify({ name: node }) });
  await updateCurrentNode();
  if (state.currentNode !== node) { log("[site-failover] selector readback mismatch; no connections closed"); return false; }
  renderProxyNodes();
  if (state.siteFailoverRevision !== context.revision || !state.settings.siteFailoverEnabled) {
    log("[site-failover] manual/settings change after selector write; preserving all connections"); return true;
  }
  try {
    const snapshot = await api(mainController(), MAIN_SECRET, "/connections");
    const targets = (snapshot?.connections || []).filter(c => {
      const chains = (c.chains || []).map(String);
      const host = String(c.metadata?.host || "").toLowerCase();
      return host === context.host.toLowerCase() && chains.includes(context.node) && chains.includes(groupName)
        && !chains.some(tag => /^(codex-probe|CodexProbe)/i.test(tag));
    });
    for (const c of targets) {
      if (state.siteFailoverRevision !== context.revision || !state.settings.siteFailoverEnabled) {
        log("[site-failover] remaining failed-site cleanup cancelled by manual/settings change"); break;
      }
      await api(mainController(), MAIN_SECRET, `/connections/${encodeURIComponent(c.id)}`, { method: "DELETE" })
        .catch(err => log(`[site-failover] failed-site connection cleanup failed: ${err.message || err}`));
    }
    log(`[site-failover] hot switch readback verified; targeted old-site connections=${targets.length}; unrelated connections preserved`);
  } catch (err) { log(`[site-failover] hot switch succeeded but targeted cleanup failed: ${err.message || err}`); }
  return true;
}

// ---- 节点分组与抖动判别 ----

function normalizeNodeGroupRules() {
  const raw = Array.isArray(state.settings.nodeGroupRules) ? state.settings.nodeGroupRules : [];
  const rules = raw
    .map((rule) => ({
      id: String(rule && rule.id || "").trim().slice(0, 4) || "?",
      label: String(rule && rule.label || "").trim().slice(0, 24) || "未命名组",
      field: (rule && rule.field) === "subscription" ? "subscription" : "node",
      pattern: String(rule && rule.pattern || "").trim()
    }))
    .filter((rule) => rule.id !== "?");
  if (!rules.length) rules.push(...DEFAULT_SETTINGS.nodeGroupRules.map((rule) => ({ ...rule })));
  // 兜底组（pattern 为空）必须存在且排在最后
  if (!rules.some((rule) => !rule.pattern)) rules.push({ id: "B", label: "IEPL 主力", field: "node", pattern: "" });
  state.settings.nodeGroupRules = rules;
  return rules;
}

function classifyNodeGroup(entry) {
  const rules = normalizeNodeGroupRules();
  if (!entry) return rules[rules.length - 1];
  for (const rule of rules) {
    if (!rule.pattern) return rule;
    const target = rule.field === "subscription"
      ? `${entry.subscriptionId || ""} ${entry.subscriptionName || ""}`
      : String(entry.node || entry.tag || "");
    const regex = compileRegex(rule.pattern, null);
    if (regex && regex.test(target)) return rule;
  }
  return rules[rules.length - 1];
}

function groupCooldownActive(groupId) {
  const until = state.groupCooldownUntil.get(groupId) || 0;
  if (until <= Date.now()) {
    state.groupCooldownUntil.delete(groupId);
    return false;
  }
  return true;
}

// info 行携带 outbound 标签，error 行往往只有连接 ID：先建立 连接ID → 出口 的
// 映射，出错时反查，才能把「代理节点故障」和「直连国内站/被墙站超时」分开。
function rememberCoreLogOutbound(payload) {
  const clean = stripAnsi(payload);
  const id = coreLogConnectionId(clean);
  const match = clean.match(/outbound\/([a-z0-9]+)\[([^\]]+)\]/i);
  if (!id || !match) return null;
  const info = { kind: match[1].toLowerCase(), node: match[2], host: (clean.match(/connection to ([^\s:]+):/i) || [])[1] || "" };
  state.coreOutboundByConnId.set(id, info);
  if (state.coreOutboundByConnId.size > 5000) {
    state.coreOutboundByConnId = new Map([...state.coreOutboundByConnId].slice(-3000));
  }
  return info;
}

// 从核心日志流里筛出「代理出口侧」的连接错误。三类一律排除：
// 本地环回（客户端自己取消）、direct 出站（直连国内站/被墙站，与机场无关）、
// 无法归属到出口的错误（宁可漏判不可误判）。
function recordCoreLogSignal(level, payload) {
  if (!state.settings.jitterGuardEnabled || !state.mainCoreReady) return;
  const text = stripAnsi(String(payload || ""));
  const outbound = rememberCoreLogOutbound(text);
  if (level !== "error") {
    if (outbound && /outbound connection to /i.test(text)) recordAnthropicDial(outbound, text);
    return;
  }
  if (/raw-read tcp 127\.0\.0\.1/.test(text) || /->\s*127\.0\.0\.1/.test(text)) return;
  let kind = "";
  if (/connection (download|upload) closed|forcibly closed|connection reset/i.test(text)) kind = "midstream";
  else if (/open connection to /i.test(text)) kind = "open";
  else return;
  const known = outbound || state.coreOutboundByConnId.get(coreLogConnectionId(text));
  if (!known || known.kind === "direct") return;
  const now = Date.now();
  state.jitterEvents = state.jitterEvents.filter((event) => now - event.at < JITTER_WINDOW_MS);
  state.jitterEvents.push({ at: now, kind, node: known.node });
  evaluateJitter();
}

// 重连风暴：只统计「走当前出口、到 Anthropic」的新建连接。
// 测速 gate scan 是 179 个节点各 1 条，落不到同一出口上，天然不会误判。
function recordAnthropicDial(outbound, text) {
  if (outbound.kind === "direct") return;
  if (!/anthropic/i.test(text)) return;
  if (state.currentNode && state.currentNode !== "-" && outbound.node !== state.currentNode) return;
  const now = Date.now();
  state.anthropicDialAt = state.anthropicDialAt.filter((at) => now - at < RECONNECT_STORM_WINDOW_MS);
  state.anthropicDialAt.push(now);
  if (state.anthropicDialAt.length < RECONNECT_STORM_MIN) return;
  // 第二证据：同一出口在同窗口内确有失败。缺了它，密集使用就会被当成故障。
  const errors = state.jitterEvents.filter((event) =>
    now - event.at < RECONNECT_STORM_WINDOW_MS && event.node === outbound.node).length;
  if (errors < RECONNECT_STORM_MIN_ERRORS) return;
  if (state.reconnectStormLastHandledAt && now - state.reconnectStormLastHandledAt < RECONNECT_STORM_HANDLE_COOLDOWN_MS) return;
  if (state.nodeGuardEscaping) return;
  state.reconnectStormLastHandledAt = now;
  const count = state.anthropicDialAt.length;
  state.anthropicDialAt = [];
  const detail = `${count} dials/60s + ${errors} errors on ${outbound.node}`;
  log(`Reconnect storm detected: ${detail}; node passes gate but real traffic is failing`);
  handleReconnectStorm(detail).catch((err) => log(`Reconnect storm report failed: ${err.message || err}`));
}

async function handleReconnectStorm(detail) {
  const currentEntry = catalogEntryByKey(currentCatalogKey());
  const currentGroup = classifyNodeGroup(currentEntry);
  const minutes = Math.max(1, Math.min(120, Math.trunc(Number(state.settings.jitterCooldownMinutes) || 10)));
  state.groupCooldownUntil.set(currentGroup.id, Date.now() + minutes * 60000);
  state.jitterEvents = [];
  log(`Reconnect storm: group ${currentGroup.id}(${currentGroup.label}) cooldown ${minutes} min`);
  await reportUnhealthyNode(`reconnect storm: ${detail}`);
}

function evaluateJitter() {
  if (state.jitterLastHandledAt && Date.now() - state.jitterLastHandledAt < JITTER_HANDLE_COOLDOWN_MS) return;
  const now = Date.now();
  const events = state.jitterEvents.filter((event) => now - event.at < JITTER_WINDOW_MS);
  if (events.length < 3) return;
  const midstream = events.filter((event) => event.kind === "midstream");
  const distinctNodes = new Set(events.map((event) => event.node)).size;
  const hits = [
    distinctNodes >= JITTER_DISTINCT_NODES_MIN,
    midstream.length >= JITTER_MIDSTREAM_MIN && midstream.length / events.length > JITTER_MIDSTREAM_RATIO
  ].filter(Boolean).length;
  if (hits < 2) return;
  state.jitterLastHandledAt = now;
  const detail = `errors=${events.length} midstream=${midstream.length} nodes=${distinctNodes}`;
  handleJitterFailure(detail).catch((err) => log(`Jitter report failed: ${err.message || err}`));
}

async function handleJitterFailure(detail) {
  const currentEntry = catalogEntryByKey(currentCatalogKey());
  const currentGroup = classifyNodeGroup(currentEntry);
  const minutes = Math.max(1, Math.min(120, Math.trunc(Number(state.settings.jitterCooldownMinutes) || 10)));
  state.groupCooldownUntil.set(currentGroup.id, Date.now() + minutes * 60000);
  state.jitterEvents = [];
  log(`Jitter detected on group ${currentGroup.id}(${currentGroup.label}): ${detail}; group cooldown ${minutes} min, automatic switch disabled`);
  await reportUnhealthyNode(`jitter: ${detail}`);
}

// ---- 当前节点守护:走主端口真实分流路径探测 Claude 可达性,故障秒级告警 ----

function currentCatalogKey() {
  const entry = state.subscriptionNodeCatalog.find((item) => (item.tag || item.node) === state.currentNode);
  return entry ? entry.key : "";
}

async function reportUnhealthyNode(reason) {
  if (state.nodeGuardEscaping) return false;
  state.nodeGuardEscaping = true;
  try {
    log(`Node guard detected an unhealthy route (${reason}); automatic node switching is disabled, keeping ${state.currentNode || "current node"}`);
    if (Neutralino.os && typeof Neutralino.os.showNotification === "function") {
      await Neutralino.os.showNotification("Smart Proxy：当前节点异常",
        `${state.currentNode || "当前节点"} 连接异常；已保留当前选择，请手动切换`).catch(() => {});
    }
    return false;
  }
  finally {
    state.nodeGuardEscaping = false;
  }
}

async function nodeGuardTick() {
  if (!GATE_CHECK_ENABLED) {
    state.nodeGuardFails = 0;
    state.nodeGuardLast = { at: Date.now(), ok: null, skipped: true };
    log("Anthropic guard disabled: availability unknown; no failure alert or request");
    return;
  }
  // 守护走主端口真实路径,不占探测 lane;仅在非 continuous 的手动测速期间让位
  if (!state.mainCoreReady || state.closing || state.nodeGuardEscaping) return;
  if (state.codexProbeRunning && state.codexProbeMode !== "continuous") return;
  if (!state.mainProcess) return;
  try {
    await ensureProbeAssets();
    const gate = await runAnthropicGate(state.settings.mainPort);
    if (gate.ok) {
      state.nodeGuardFails = 0;
      state.nodeGuardLast = { at: Date.now(), ok: true, http: gate.http };
      return;
    }
    state.nodeGuardFails += 1;
    state.nodeGuardLast = { at: Date.now(), ok: false, http: gate.http, error: gate.error };
    log(`Node guard: current node Claude check failed (${state.nodeGuardFails}/${NODE_GUARD_FAIL_THRESHOLD}): ${gate.error}`);
    if (state.nodeGuardFails >= NODE_GUARD_FAIL_THRESHOLD) {
      state.nodeGuardFails = 0;
      await reportUnhealthyNode(gate.error || "gate failed");
    }
  }
  catch (err) {
    log(`Node guard tick error: ${err.message || err}`);
  }
}

function startNodeGuard() {
  if (state.nodeGuardTimer) return;
  if (GATE_CHECK_ENABLED) {
    state.nodeGuardTimer = setInterval(() => { nodeGuardTick().catch(err => log(`Node guard failed: ${err.message || err}`)); }, NODE_GUARD_INTERVAL_MS);
  } else {
    state.nodeGuardLast = { at: Date.now(), ok: null, skipped: true };
    log("Anthropic guard disabled: periodic requests and failure notifications are not scheduled");
  }
  startSubscriptionRefreshScheduler();
  // Startup DNS diagnosis is advisory only and never an automatic escape trigger.
  setTimeout(() => { refreshEndpointDnsHealth({ force: true }).catch(err => log(`DNS diagnosis failed: ${err.message || err}`)); }, 3000);
}

function recordSubscriptionRefresh(profile, patch) {
  const statuses = state.settings.subscriptionRefreshStatus ||= {};
  statuses[profile.id] = { ...(statuses[profile.id] || {}), ...patch };
  scheduleSettingsPersist("subscription refresh status");
  renderSubscriptionRefreshStatus();
}

function renderSubscriptionRefreshStatus() {
  const box = $("subscriptionRefreshDetails");
  if (!box) return;
  const profiles = state.settings.subscriptions || [];
  box.innerHTML = profiles.filter(p => p.url).map(profile => {
    const s = state.settings.subscriptionRefreshStatus?.[profile.id] || {};
    const time = s.lastSuccessAt ? new Date(s.lastSuccessAt).toLocaleString("zh-CN", { hour12: false }) : "尚无本版更新记录";
    return `<div class="refresh-row"><strong>${escapeHtml(profile.name)}</strong><span>${escapeHtml(time)}</span><b class="${s.error ? "bad" : s.pending ? "pending" : "muted"}">${escapeHtml(s.error || (s.pending ? "已下载 · 待下次手动启动生效" : "运行配置保持不变"))}</b></div>`;
  }).join("") || "添加订阅后，会在这里显示下载结果。";
  if ($("subscriptionScheduleHint")) $("subscriptionScheduleHint").textContent = state.settings.autoRecoverOnEndpointFailure === false
    ? "自动更新已关闭；缓存与现有节点保留。" : "自动更新已开启 · 按机场周期（默认 24 小时）检查，失败冷却 20 分钟重试 · 不重启代理";
}

function showNetworkError(error) {
  state.networkProgress = `网络测试未完成：${error.message || error}`;
  log(state.networkProgress);
  if ($("networkScoreSummary")) $("networkScoreSummary").textContent = state.networkProgress;
}

async function testNetworkNodes(filter = {}) {
  if (state.networkProbeJob) { state.networkProbeJob.abort(); state.networkProgress = "正在停止…"; renderNetworkProbeState(state.subscriptionNodeCatalog); renderProxyNodes(); return; }
  if (state.codexProbeRunning || state.codexProbePreparing || state.phoneProbeController || state.phoneProbeStarting) throw new Error("流式测速或手机控制正在运行，请先停止它");
  const controller = new AbortController();
  state.networkProbeJob = controller;
  state.networkProgress = "正在读取运行中节点…";
  renderNetworkProbeState(state.subscriptionNodeCatalog);
  try {
    // No subscription download, expiry check, account, model or extra core is required.
    const runtime = await api(mainController(), MAIN_SECRET, "/proxies", { signal: controller.signal });
    const live = runtime.proxies || {};
    const catalog = state.subscriptionNodeCatalog.length ? state.subscriptionNodeCatalog : state.nodes.map(node => ({ key: node, node, tag: node }));
    const entries = catalog.filter(e => (!filter.key || e.key === filter.key) && (!filter.group || e.subscriptionId === filter.group));
    if (!entries.length) throw new Error("没有缓存节点；请先导入订阅或离线 YAML");
    state.networkPendingKeys = new Set(entries.map(e => e.key));
    state.networkProgress = `网络测试 0/${entries.length}`; renderProxyNodes();
    log(`Network test started: ${entries.length} cached nodes, HTTPS gstatic, concurrency <=4; no switching`);
    const round = await SmartProxyNetwork.runRound(entries, {
      signal: controller.signal, log,
      probe: async (entry, signal) => {
        const tag = String(entry.tag || entry.node);
        if (!live[tag]) throw Object.assign(new Error("此节点尚未载入运行内核，待下次手动启动后测试"), { scope: "local" });
        try {
          const result = await api(mainController(), MAIN_SECRET, `/proxies/${encodeURIComponent(tag)}/delay?timeout=5000&url=${encodeURIComponent("https://www.gstatic.com/generate_204")}`, { signal, timeoutMs: 6500 });
          return result?.delay;
        } catch (error) {
          if (/^(401|403|404)\b/.test(error.message || "")) error.scope = "local";
          throw error;
        }
      },
      onProgress: ({ completed, total, entry, value, phase }) => {
        state.networkPendingKeys.delete(entry.key);
        const store = state.settings.networkProbeStore ||= {};
        store[entry.key] = SmartProxyNetwork.merge(store[entry.key], value);
        state.networkProgress = `网络测试 ${completed}/${total}${phase === "control" ? " · 低并发对照复测" : ""}`;
        renderProxyNodes();
      }
    });
    const store = state.settings.networkProbeStore ||= {};
    for (const [key, value] of round.results) {
      store[key] = SmartProxyNetwork.merge(store[key], value);
      if (value.status === "error") log(`Network test ${key}: ${value.failureScope}: ${value.error}`);
    }
    const ok = [...round.results.values()].filter(v => v.status === "done").length;
    state.networkProgress = `${round.cancelled ? "已停止" : "网络测试完成"} · ${ok}/${entries.length} 可达 · 延迟不是带宽或模型速度 · 当前节点未切换`;
    log(`${state.networkProgress}; peak concurrency ${round.peak}`);
    scheduleSettingsPersist("network test results");
    evaluateBenchmarkSubscriptionEvidence(entries, round.results, { cancelled: round.cancelled });
    return round;
  } finally {
    state.networkProbeJob = null; state.networkPendingKeys.clear(); renderNetworkProbeState(state.subscriptionNodeCatalog); renderProxyNodes();
  }
}

function renderNetworkProbeState(entries) {
  if ($("testNetworkBtn")) { $("testNetworkBtn").textContent = state.networkProbeJob ? "停止网络测试" : "一键网络测试"; $("testNetworkBtn").disabled = state.codexProbeRunning; }
  if ($("testAllCodexBtn")) $("testAllCodexBtn").disabled = !!state.networkProbeJob;
  if ($("networkScoreSummary")) $("networkScoreSummary").textContent = state.networkProgress || `${entries.length} 个缓存节点 · HTTPS 连通与延迟 · 无需模型账户，订阅过期仍可测试`;
}

function networkMetric(entry) {
  if (state.networkPendingKeys.has(entry.key)) return { text: "网络测试中…", title: "使用运行中通道，不切节点", css: "busy" };
  const r = state.settings.networkProbeStore?.[entry.key];
  if (!r) return { text: "网络未测", title: "网络测试不消耗模型额度", css: "muted" };
  if (r.status === "done") return { text: `${r.delayMs} ms`, title: `HTTPS 连接延迟 · ${new Date(r.measuredAt).toLocaleString()}`, css: "fast" };
  const label = r.status === "cancelled" ? "已停止" : r.failureScope === "local" ? "待载入" : r.failureScope === "round" ? "环境待确认" : "目标未达";
  return { text: label, title: `${r.error || label}${r.lastSuccess ? `；历史 ${r.lastSuccess.delayMs} ms（${new Date(r.lastSuccess.measuredAt).toLocaleString()}）` : ""}`, css: "muted" };
}

function renderProxyNodes() {
  if (state.currentView !== "proxy-nodes") return;
  if ((state.codexProbeRunning || state.networkProbeJob) && !state.proxyRenderFlushing) {
    if (!state.proxyRenderTimer) {
      state.proxyRenderTimer = setTimeout(() => {
        state.proxyRenderTimer = null;
        state.proxyRenderFlushing = true;
        try { renderProxyNodes(); }
        finally { state.proxyRenderFlushing = false; }
      }, 150);
    }
    return;
  }
  const box = $("nodeGroups");
  if (!box) return;
  const active = activeSubscription();
  const allEntries = state.subscriptionNodeCatalog.length
    ? state.subscriptionNodeCatalog
    : getSwitchableNodes(state.nodes.length ? state.nodes : getCandidateNodes()).map((node) => ({
      key: subscriptionNodeKey(active, node),
      subscriptionId: active.id,
      subscriptionName: active.name || "默认订阅",
      subscriptionNames: [active.name || "默认订阅"],
      node,
      tag: node
    }));

  const query = String($("nodeSearch")?.value || "").trim().toLowerCase();
  const filter = $("nodeFilter")?.value || "all";
  const entries = allEntries.filter(entry => (!query || `${entry.node} ${(entry.subscriptionNames || [entry.subscriptionName]).join(" ")}`.toLowerCase().includes(query))
    && (filter !== "reachable" || state.settings.networkProbeStore?.[entry.key]?.status === "done")
    && (filter !== "current" || (entry.tag || entry.node) === state.currentNode));
  const resultOf = (entry) => state.nodeCodexResults.get(entry.key) || null;

  const groups = [];
  const groupIndex = new Map();
  for (const entry of entries) {
    let group = groupIndex.get(entry.subscriptionId);
    if (!group) {
      group = { id: entry.subscriptionId, name: entry.subscriptionName || "默认订阅", entries: [] };
      groupIndex.set(entry.subscriptionId, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }

  if (!state.nodeGroupCollapseReady && groups.length) {
    const currentEntry = entries.find((entry) => (entry.tag || entry.node) === state.currentNode);
    const currentGroupId = currentEntry ? currentEntry.subscriptionId : (groups[0] && groups[0].id);
    groups.forEach((group) => { if (group.id !== currentGroupId) state.nodeGroupCollapsed.add(group.id); });
    state.nodeGroupCollapseReady = true;
  }

  const currentEntries = entries.filter(entry => resultOf(entry)?.roundId && resultOf(entry).roundId === state.lastProbeRoundId);
  const globalBestEntry = SmartProxyConfig.rankCurrentCodexProbeEntries(currentEntries, state.nodeCodexResults,
    new Map(currentEntries.map(entry => [entry.key, { ok: null }])), new Set(currentEntries.map(entry => entry.key)))[0] || null;
  const globalBestKey = globalBestEntry ? globalBestEntry.key : "";

  box.innerHTML = groups.length
    ? groups.map((group) => {
      const sorted = SmartProxyConfig.rankCodexProbeEntries(group.entries, state.nodeCodexResults);
      const reachable = group.entries.filter((entry) => {
        const result = resultOf(entry);
        return result?.metricKind === "stream-quality-v1" && result.status === "done" && (!result.lastAttempt || result.lastAttempt.status === "done");
      }).length;
      const blocked = group.entries.filter((entry) => {
        const result = resultOf(entry);
        return !!result?.lastAttempt && !["done", "cancelled"].includes(result.lastAttempt.status);
      }).length;
      const groupRunning = state.codexProbeRunning && state.codexProbeMode === "group"
        && group.entries.some((entry) => entry.key === state.codexProbeBusyKey || state.codexProbePendingKeys.has(entry.key));
      const statText = [`${group.entries.length} 节点`]
        .concat([`网络可达 ${group.entries.filter(e => state.settings.networkProbeStore?.[e.key]?.status === "done").length}`])
        .concat(reachable ? [`质量成绩 ${reachable}`] : [])
        .concat(blocked ? [`本次未通过 ${blocked}`] : [])
        .join(" · ");
      const collapsed = !query && filter === "all" && state.nodeGroupCollapsed.has(group.id);
      const rows = collapsed ? "" : sorted.map((entry) => {
        const meta = SmartProxyConfig.nodeDisplayMeta(entry.node);
        const result = resultOf(entry);
        const current = (entry.tag || entry.node) === state.currentNode;
        const prepared = state.pendingNodeSelection && state.pendingNodeSelection.key === entry.key;
        const fastest = entry.key === globalBestKey;
        const codex = nodeCodexPresentation(result, entry.key);
        const metric = codex.text, metricClass = codex.className;
        const dot = metricClass === "busy" ? "busy" : metricClass === "fast" ? "ok" : "idle";
        const network = networkMetric(entry);
        const tag = current ? "当前" : prepared ? "已准备" : fastest ? "本轮候选" : "";
        return `
          <div tabindex="0" role="button" aria-label="选择 ${escapeHtml(entry.node)}" class="node-row ${current || prepared ? "current" : ""} ${result && result.anthropicOk === false ? "blocked" : ""}" data-select-node="${escapeHtml(entry.node)}" data-node-key="${escapeHtml(entry.key)}" title="${escapeHtml(`${entry.subscriptionName} / ${entry.node}`)}&#10;${escapeHtml(codex.title)}">
            <span class="node-dot ${dot}"></span>
            <span class="node-group-chip${groupCooldownActive(classifyNodeGroup(entry).id) ? " cooling" : ""}${current ? " current" : ""}" title="分组 ${escapeHtml(classifyNodeGroup(entry).label)}${groupCooldownActive(classifyNodeGroup(entry).id) ? "（抖动冷却中）" : ""}${current ? " · 当前所在组" : ""}">${escapeHtml(classifyNodeGroup(entry).id)}</span>
            <span class="node-ico">${escapeHtml(meta.icon)}</span>
            <span class="node-label">${escapeHtml(meta.shortName)}</span>
            <span class="network-metric ${network.css}" title="${escapeHtml(network.title)}">${escapeHtml(network.text)}</span>
            <span class="node-metric ${metricClass}" title="流式质量 / 下载：${escapeHtml(codex.title)}">${escapeHtml(metric)}</span>
            <span class="node-tag ${fastest && !current ? "gold" : ""}">${escapeHtml(tag)}</span>
            <button class="node-network" data-network-probe-key="${escapeHtml(entry.key)}" title="测试网络连通性与延迟" ${state.codexProbeRunning || state.networkProbeJob ? "disabled" : ""}>网络</button>
            <button class="node-retest" data-codex-probe-key="${escapeHtml(entry.key)}" title="固定流式 + 8 MiB 下载，不调用模型" ${state.networkProbeJob || state.codexProbeRunning && state.codexProbeBusyKey !== entry.key ? "disabled" : ""}>质量</button>
          </div>`;
      }).join("");
      return `
        <section class="node-group ${collapsed ? "collapsed" : ""}">
          <header class="node-group-head">
            <button class="group-caret" data-toggle-group="${escapeHtml(group.id)}" title="${collapsed ? "展开" : "折叠"}">${collapsed ? "▸" : "▾"}</button>
            <div class="node-group-title" data-toggle-group="${escapeHtml(group.id)}">
              <strong>${escapeHtml(group.name)}</strong>
              <span>${escapeHtml(statText)}</span>
            </div>
            <button class="mini" data-test-group="${escapeHtml(group.id)}" ${state.codexProbeRunning && !groupRunning ? "disabled" : ""}>${groupRunning ? "停止" : "测本组"}</button>
          </header>
          ${collapsed ? "" : `<div class="node-grid">${rows}</div>`}
        </section>`;
    }).join("")
    : `<div class="empty-grid">${allEntries.length ? "没有匹配节点，请调整搜索或筛选条件" : "暂无缓存节点 · 请在订阅页添加订阅或导入离线 YAML"}</div>`;

  if ($("testAllCodexBtn")) {
    $("testAllCodexBtn").textContent = state.codexProbeRunning && state.codexProbeMode !== "single" && state.codexProbeMode !== "group"
      ? "停止全测"
      : "质量全测";
  }
  renderNetworkProbeState(entries);
  const summaryBox = $("nodeScoreSummary");
  if (!summaryBox) return;
  if (!entries.length) {
    summaryBox.textContent = "暂无缓存节点";
  }
  else if (state.codexProbeRunning) {
    const busy = catalogEntryByKey(state.codexProbeBusyKey);
    const target = busy ? ` · ${busy.subscriptionName}/${busy.node}` : "";
    const modeText = state.codexProbeMode === "group" ? "分组测速" : state.codexProbeMode === "continuous" ? "持续竞赛" : "全量测速";
    summaryBox.textContent = `${modeText} ${state.codexProbeCompleted}/${state.codexProbeTotal}${target}`;
  }
  else {
    const reachableTotal = entries.filter((entry) => {
      const result = resultOf(entry);
      return result?.metricKind === "stream-quality-v1" && result.status === "done" && (!result.lastAttempt || result.lastAttempt.status === "done");
    }).length;
    const blockedTotal = entries.filter((entry) => {
      const result = resultOf(entry);
      return !!result?.lastAttempt && !["done", "cancelled"].includes(result.lastAttempt.status);
    }).length;
    const guard = state.nodeGuardLast;
    const guardText = guard && !guard.skipped && guard.ok !== null ? ` · 守护${guard.ok ? "正常" : "告警"} ${Math.max(0, Math.round((Date.now() - guard.at) / 1000))}s 前` : "";
    const globalBestResult = globalBestEntry ? resultOf(globalBestEntry) : null;
    const bestText = globalBestEntry && globalBestResult
      ? ` · 本轮流式复测达标（并列） ${globalBestEntry.subscriptionName}/${globalBestEntry.node}`
      : "";
    summaryBox.textContent = `${state.modelProbeNotice}${entries.length} 节点 · 有成绩 ${reachableTotal} · 本次未通过 ${blockedTotal}${bestText}${guardText} · 全测流量上限约 ${(entries.length * (state.settings.streamQualityRounds === 3 ? 3 : 1) * 8.1).toFixed(0)} MiB · 独立核心，不切日常节点`;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function refreshConnections() {
  if (state.connectionRefreshPromise) return state.connectionRefreshPromise;
  if (!state.mainProcess) {
    if (state.currentView === "connections" && !document.hidden) $("connRows").innerHTML = `<tr><td colspan="6">主核心未启动</td></tr>`;
    return;
  }
  state.connectionRefreshPromise = (async () => {
    try {
      const data = await api(mainController(), MAIN_SECRET, "/connections", { method: "GET" });
      state.connections = data.connections || []; state.mainHealthFailures = 0;
      logNewConnections(state.connections); renderConnections();
      if (Date.now() - state.lastCurrentNodeCheckAt >= 15000) {
        state.lastCurrentNodeCheckAt = Date.now(); await updateCurrentNode();
      }
    } catch (err) {
      if (state.currentView === "connections" && !document.hidden) $("connRows").innerHTML = `<tr><td colspan="6">读取失败：${escapeHtml(err.message || err)}</td></tr>`;
      state.mainHealthFailures++;
      if (state.mainHealthFailures % 3 === 0) log(`Controller unavailable for ${state.mainHealthFailures} polls; proxy not restarted on control-plane evidence alone: ${err.message || err}`);
    }
  })();
  try { return await state.connectionRefreshPromise; }
  finally { state.connectionRefreshPromise = null; }
}

function connectionKey(c) {
  const meta = c.metadata || {};
  return c.id || [
    meta.network,
    meta.type,
    meta.sourceIP,
    meta.sourcePort,
    meta.host || meta.destinationIP,
    meta.destinationPort,
    meta.process
  ].join("|");
}

function connectionProcessPath(c) {
  const meta = c.metadata || {};
  return meta.process || state.coreProcessByConnId.get(String(c.id || "")) || "";
}

function connectionSearchText(c) {
  const meta = c.metadata || {};
  const chain = Array.isArray(c.chains) ? c.chains.join(" / ") : "";
  const processPath = connectionProcessPath(c);
  return [
    meta.host,
    meta.destinationIP,
    meta.destinationPort,
    processPath,
    processNameFromPath(processPath),
    c.rule,
    c.rulePayload,
    chain
  ].filter(Boolean).join(" ").toLowerCase();
}


async function controllerConnections(baseUrl, secret) {
  const data = await api(baseUrl, secret, "/connections", { method: "GET" });
  return Array.isArray(data && data.connections) ? data.connections : [];
}


function logNewConnections(conns) {
  for (const c of conns) {
    const key = connectionKey(c);
    if (!key || state.seenConnections.has(key)) continue;
    state.seenConnections.add(key);
    if (state.seenConnections.size > 5000) {
      state.seenConnections = new Set([...state.seenConnections].slice(-3000));
    }
    const meta = c.metadata || {};
    const host = meta.host || meta.destinationIP || "-";
    const processPath = connectionProcessPath(c);
    const process = processPath ? processNameFromPath(processPath) : "-";
    const chain = Array.isArray(c.chains) ? c.chains.join(" / ") : "-";
    const rule = [c.rule, c.rulePayload].filter(Boolean).join("/");
    log(`[conn] ${process} -> ${host} rule=${rule || "-"} chain=${chain}`);
  }
}

function renderConnections() {
  if (state.currentView !== "connections" || !state.surfaceVisible || document.hidden) return;
  const q = ($("connFilter") && $("connFilter").value.trim().toLowerCase()) || "";
  const all = state.connections || [];
  const conns = (q ? all.filter((c) => connectionSearchText(c).includes(q)) : all).slice(0, 300);
  $("connSummary").textContent = `${conns.length}/${all.length} active connections`;
  const html = conns.length ? conns.map((c) => {
    const meta = c.metadata || {};
    const processPath = connectionProcessPath(c);
    const host = meta.host || meta.destinationIP || "-";
    const chain = Array.isArray(c.chains) ? c.chains.join(" / ") : "-";
    const rule = [c.rule, c.rulePayload].filter(Boolean).join("/");
    return `
      <tr>
        <td title="${escapeHtml(host)}">${escapeHtml(host)}</td>
        <td title="${escapeHtml(rule)}">${escapeHtml(rule || "-")}</td>
        <td title="${escapeHtml(chain)}">${escapeHtml(chain)}</td>
        <td title="${escapeHtml(processPath)}">${escapeHtml(processPath ? processNameFromPath(processPath) : "-")}</td>
        <td class="num">${formatBytes(c.upload || 0)}</td>
        <td class="num">${formatBytes(c.download || 0)}</td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="6">暂无连接</td></tr>`;
  if (html !== state.lastConnectionsHtml) { $("connRows").innerHTML = html; state.lastConnectionsHtml = html; }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function startConnectionPolling() {
  stopConnectionPolling();
  const generation = state.connectionPollGeneration;
  const tick = async () => {
    await refreshConnections();
    if (generation !== state.connectionPollGeneration || !state.mainProcess || state.closing) return;
    const visible = state.surfaceVisible && state.currentView === "connections" && !document.hidden;
    state.connTimer = setTimeout(tick, visible ? 2000 : 15000);
  };
  tick().catch(err => log(`Connection poll failed: ${err.message || err}`));
}

function stopConnectionPolling() {
  state.connectionPollGeneration++;
  if (state.connTimer) clearTimeout(state.connTimer);
  state.connTimer = null; state.mainHealthFailures = 0;
  state.connections = []; state.lastConnectionsHtml = ""; renderConnections();
}

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll(".nav").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("active", el.id === `view-${view}`));
  if (view === "connections") refreshConnections();
  if (view === "logs") renderLogs();
  if (view === "proxy-nodes") renderProxyNodes();
}

function renderCustomRules() {
  const body = $("customRuleRows");
  if (!body) return;
  const rules = state.settings.customRules || [];
  body.innerHTML = rules.length ? rules.map((rule, index) => `
    <tr>
      <td>${escapeHtml(rule.type)}</td>
      <td title="${escapeHtml(rule.value)}">${escapeHtml(rule.value)}</td>
      <td>${escapeHtml(rule.outbound || "SMART")}</td>
      <td>${rule.position === "append" ? "后置" : "前置"}</td>
      <td><button class="danger" data-remove-rule="${index}">删除</button></td>
    </tr>
  `).join("") : `<tr><td colspan="5">暂无自定义规则</td></tr>`;
}

function addCustomRule() {
  const type = $("customRuleType").value;
  const value = $("customRuleValue").value.trim();
  const outbound = $("customRuleOutbound").value;
  const position = $("customRulePosition").value;
  if (!value) {
    log("Custom rule ignored: value is empty");
    return;
  }
  state.settings.customRules = state.settings.customRules || [];
  state.settings.customRules.push({ type, value, outbound, position });
  $("customRuleValue").value = "";
  renderCustomRules();
  saveSettings({ applyRuntime: true });
  log(`Custom rule added: ${type},${value},${outbound},${position}`);
}

function removeCustomRule(index) {
  state.settings.customRules = state.settings.customRules || [];
  state.settings.customRules.splice(index, 1);
  renderCustomRules();
  saveSettings({ applyRuntime: true });
}

async function handleSystemProxyToggle() {
  readSettingsFromForm();
  await persistSettingsFile();
  updateHomeProxyControls();
  if (!state.settings.systemProxyEnabled) return disableSystemProxy();
  return enableSystemProxy();
}

async function handleGlobalProxyToggle() {
  readSettingsFromForm();
  await persistSettingsFile();
  updateHomeProxyControls();
  log(`Route mode changed: ${state.settings.globalProxyEnabled ? "global" : "rule"}`);
  await applyRuntimeSettings();
}

async function bindEvents() {
  document.querySelectorAll(".nav").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
  $("pickConfigBtn").addEventListener("click", pickConfig);
  $("removeOfflineYamlBtn")?.addEventListener("click", () => removeOfflineYamlSource().catch(err => log(`Remove offline YAML failed: ${err.message || err}`)));
  $("streamQualityRounds")?.addEventListener("change", () => {
    state.settings.streamQualityRounds = $("streamQualityRounds").value === "3" ? 3 : 1;
    scheduleSettingsPersist("stream quality rounds");
    renderProxyNodes();
  });
  $("refreshSubBtn").addEventListener("click", () => refreshSubscription().catch((err) => log(`Refresh subscription failed: ${err.message || err}`)));
  $("pickCoreBtn").addEventListener("click", pickCore);
  $("homeSubscriptionUrl").addEventListener("input", () => syncSubscriptionInputs("homeSubscriptionUrl"));
  $("subscriptionUrl").addEventListener("input", () => syncSubscriptionInputs("subscriptionUrl"));
  $("homeSubscriptionName").addEventListener("input", () => syncSubscriptionInputs("homeSubscriptionName"));
  $("subscriptionName").addEventListener("input", () => syncSubscriptionInputs("subscriptionName"));
  $("homeSubscriptionSelect").addEventListener("change", (event) => {
    activateSubscription(event.target.value).catch((err) => {
      log(`Switch subscription failed: ${err.message || err}`);
      renderSubscriptionControls();
    });
  });
  $("subscriptionSelect").addEventListener("change", (event) => {
    activateSubscription(event.target.value).catch((err) => {
      log(`Switch subscription failed: ${err.message || err}`);
      renderSubscriptionControls();
    });
  });
  $("addSubscriptionBtn").addEventListener("click", beginAddSubscription);
  $("saveSubscriptionBtn").addEventListener("click", () => saveSubscriptionProfile()
    .catch((err) => log(`Save subscription failed: ${err.message || err}`)));
  $("deleteSubscriptionBtn").addEventListener("click", () => deleteActiveSubscription()
    .catch((err) => log(`Delete subscription failed: ${err.message || err}`)));
  $("systemProxyEnabled").addEventListener("change", () => handleSystemProxyToggle().catch((err) => log(`System proxy toggle failed: ${err.message || err}`)));
  $("globalProxyEnabled").addEventListener("change", () => handleGlobalProxyToggle().catch((err) => log(`Global proxy toggle failed: ${err.message || err}`)));
  if ($("applySystemNetworkOptimizeBtn")) $("applySystemNetworkOptimizeBtn").addEventListener("click", () => applySystemNetworkOptimize().catch((err) => log(`System network optimization failed: ${err.message || err}`)));
  if ($("refreshSystemNetworkOptimizeStatusBtn")) $("refreshSystemNetworkOptimizeStatusBtn").addEventListener("click", () => refreshSystemNetworkOptimizeStatus({ logResult: true }).catch((err) => log(`System network optimization status failed: ${err.message || err}`)));
  $("checkCoreBtn").addEventListener("click", () => checkCoreVersions().catch((err) => log(`Check core versions failed: ${err.message || err}`)));
  $("downloadSingBoxBtn").addEventListener("click", () => downloadCoreLatest()
    .catch((err) => log(`Download sing-box failed: ${err.message || err}`)));
  $("streamQualityEndpoint")?.addEventListener("change", () => {
    try { state.settings.streamQualityEndpoint = StreamQuality.endpoint($("streamQualityEndpoint").value.trim()); }
    catch (error) { log(`Invalid Stream Quality endpoint: ${error.message}`); $("streamQualityEndpoint").value = state.settings.streamQualityEndpoint || STREAM_QUALITY_ENDPOINT; return; }
    scheduleSettingsPersist("stream quality endpoint");
  });
  $("testNetworkBtn")?.addEventListener("click", () => testNetworkNodes().catch(showNetworkError));
  $("nodeSearch")?.addEventListener("input", renderProxyNodes);
  $("nodeFilter")?.addEventListener("change", renderProxyNodes);
  $("nodeGroups").addEventListener("keydown", event => {
    if (["Enter", " "].includes(event.key) && event.target.matches("[data-select-node]")) { event.preventDefault(); event.target.click(); }
  });
  $("saveSettingsBtn").addEventListener("click", () => saveSettings({ applyRuntime: true }));
  if ($("continuousWssAutoSwitchEnabled")) {
    $("continuousWssAutoSwitchEnabled").addEventListener("change", () => {
      state.settings.continuousWssAutoSwitchEnabled = $("continuousWssAutoSwitchEnabled").checked;
      persistSettingsFile().catch((err) => log(`Persist continuous toggle failed: ${err.message || err}`));
      syncContinuousCompetition("toggle");
      log(`Continuous competition ${state.settings.continuousWssAutoSwitchEnabled ? "enabled" : "disabled"} by toggle`);
    });
  }
  if ($("continuousProbeIntervalMinutes")) {
    // 防止滚动页面时滚轮悬停误改数值
    $("continuousProbeIntervalMinutes").addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
    $("continuousProbeIntervalMinutes").addEventListener("change", () => {
      const value = Math.max(0, Math.min(1440, Math.trunc(Number($("continuousProbeIntervalMinutes").value) || 0)));
      $("continuousProbeIntervalMinutes").value = value;
      state.settings.continuousProbeIntervalMinutes = value;
      persistSettingsFile().catch((err) => log(`Persist probe interval failed: ${err.message || err}`));
      log(`Continuous probe interval set to ${value} min`);
    });
  }
  $("toggleCoreBtn").addEventListener("click", async () => {
    try {
      if (state.mainProcess) await stopMainCore();
      else await startMainCore();
    }
    catch (err) {
      log(`Core toggle failed: ${err.message || err}`);
      state.mainProcess = null;
      state.mainCoreReady = false;
      setStatus();
    }
  });
  $("nodeGroups").addEventListener("click", (event) => {
    const networkButton = event.target.closest("[data-network-probe-key]");
    if (networkButton) { event.stopPropagation(); testNetworkNodes({ key: networkButton.dataset.networkProbeKey }).catch(showNetworkError); return; }
    const probeButton = event.target.closest("[data-codex-probe-key]");
    if (probeButton) {
      event.stopPropagation();
      testCodexNode(probeButton.dataset.codexProbeKey)
        .catch((err) => {
          log(`Upload probe failed: ${err.message || err}`);
          if ($("nodeScoreSummary")) $("nodeScoreSummary").textContent = `链路测试失败：${err.message || err}`;
        });
      return;
    }
    const toggle = event.target.closest("[data-toggle-group]");
    if (toggle) {
      const groupId = toggle.dataset.toggleGroup;
      if (state.nodeGroupCollapsed.has(groupId)) state.nodeGroupCollapsed.delete(groupId);
      else state.nodeGroupCollapsed.add(groupId);
      renderProxyNodes();
      return;
    }
    const groupButton = event.target.closest("[data-test-group]");
    if (groupButton) {
      testNetworkNodes({ group: groupButton.dataset.testGroup }).catch(showNetworkError);
      return;
    }
    const button = event.target.closest("[data-select-node]");
    if (!button) return;
    selectCatalogNode(button.dataset.nodeKey, { manual: true })
      .then(renderProxyNodes)
      .catch((err) => log(`Manual select failed: ${err.message || err}`));
  });
  $("phoneQualityBtn").addEventListener("click", () => togglePhoneQualityController().catch(err => log(`Phone controller: ${err.message || err}`)));
  $("copyPhonePairCode").addEventListener("click", () => Neutralino.clipboard.writeText($("phonePairCode").value).catch(err => log(`Pairing code copy failed: ${err.message || err}`)));
  $("testAllCodexBtn").addEventListener("click", () => testAllCodexNodes()
    .catch((err) => {
      log(`Codex bulk probe failed: ${err.message || err}`);
      if ($("nodeScoreSummary")) $("nodeScoreSummary").textContent = `Codex 全测失败：${err.message || err}`;
    }));
  $("refreshConnBtn").addEventListener("click", refreshConnections);
  $("connFilter").addEventListener("input", renderConnections);
  $("logFilter").addEventListener("input", renderLogs);
  $("copyLogsBtn").addEventListener("click", copyCurrentLogs);
  $("addCustomRuleBtn").addEventListener("click", addCustomRule);
  $("customRuleRows").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-rule]");
    if (!button) return;
    removeCustomRule(Number(button.dataset.removeRule));
  });
  $("clearLogsBtn").addEventListener("click", () => {
    state.logs = [];
    renderLogs();
  });
  if ($("enableSysProxyBtn")) $("enableSysProxyBtn").addEventListener("click", () => {
    saveSettings();
    enableSystemProxy().catch((err) => log(`Enable proxy failed: ${err.message || err}`));
  });
  if ($("disableSysProxyBtn")) $("disableSysProxyBtn").addEventListener("click", () => disableSystemProxy());
  $("stopAllBtn").addEventListener("click", stopAll);
  if ($("quitAppBtn")) $("quitAppBtn").addEventListener("click", closeAppFast);
}

// 退出前注销托盘图标：Windows 通知区不会自动回收已退出进程的图标，
// 残留的“僵尸图标”点击无任何反应，是托盘点不开的常见根因。
async function removeTrayIcon() {
  if (NL_MODE !== "window" || !state.trayReady) return;
  try {
    await Neutralino.os.setTray({ icon: "", menuItems: [] });
    state.trayReady = false;
    log("Tray icon removed on exit");
  }
  catch (err) {
    log(`Tray icon removal failed: ${err.message || err}`);
  }
}

async function setTray() {
  if (NL_MODE !== "window") return false;
  let lastError = null;
  for (let attempt = 1; attempt <= TRAY_SETUP_RETRIES; attempt++) {
    try {
      await Neutralino.os.setTray({
        icon: "/resources/icons/trayIcon.png",
        menuItems: [
          { id: "SHOW", text: "打开主界面" },
          { id: "RELOAD", text: "重载界面（不断代理）" },
          { id: "SEP", text: "-" },
          { id: "QUIT", text: "退出程序" }
        ]
      });
      state.trayReady = true;
      log(`Tray ready on attempt ${attempt}`);
      return true;
    }
    catch (err) {
      lastError = err;
      if (attempt < TRAY_SETUP_RETRIES) await sleep(TRAY_SETUP_RETRY_MS);
    }
  }
  state.trayReady = false;
  throw lastError || new Error("tray setup failed");
}

async function showMainWindow(reason = "user") {
  if (NL_MODE !== "window" || state.closing) return false;
  if (!state.uiReady) return await requestMainWindowShow(reason);
  const surface = document.querySelector(".app");
  if (!surface || document.readyState === "loading") throw new Error("UI surface is not ready");
  void surface.offsetHeight;
  try {
    const pos = await Neutralino.window.getPosition();
    if (pos && Number(pos.x) < -20000) await Neutralino.window.move(200, 120);
  }
  catch (_err) { /* 位置读取失败不阻塞显示 */ }
  await Neutralino.window.show();
  state.surfaceVisible = true;
  renderConnections(); scheduleLogRender();
  if (typeof Neutralino.window.unminimize === "function") await Neutralino.window.unminimize();
  await Neutralino.window.focus();
  // WebView2 从隐藏转显示时合成器可能不重绘（纯白窗口）；尺寸微扰强制重新合成
  try {
    const size = await Neutralino.window.getSize();
    if (size && size.width > 0) {
      await Neutralino.window.setSize({ width: size.width + 1, height: size.height });
      await sleep(30);
      await Neutralino.window.setSize({ width: size.width, height: size.height });
    }
  }
  catch (_err) { /* 重绘微扰失败不影响窗口显示 */ }
  log(`Window restored: ${reason}`);
  return true;
}

async function requestMainWindowShow(reason = "user") {
  if (state.uiReady) return await showMainWindow(reason);
  if (reason === "tray-icon") {
    log("Window show ignored before UI ready: tray-icon");
    return true;
  }
  state.pendingWindowShowReason = reason;
  log(`Window show deferred until UI ready: ${reason}`);
  return true;
}

function queueLifecycleAction(label, action) {
  const run = async () => {
    try {
      return await action();
    }
    catch (err) {
      log(`${label} failed: ${err.message || err}`);
      return false;
    }
  };
  const next = state.lifecycleQueue.then(run, run);
  state.lifecycleQueue = next.catch(() => false);
  return next;
}

async function onTrayMenuItemClicked(event) {
  const id = event && event.detail && event.detail.id;
  // 显示窗口是纯窗口操作,绝不排 lifecycle 队列(队列被慢操作占用时点击会卡住)
  if (id === "SHOW") return await requestMainWindowShow("tray-menu").catch((err) => { log(`Tray show failed: ${err.message || err}`); return false; });
  if (id === "RELOAD") return await reloadAppSurface("tray-menu");
  if (id === "QUIT") return await closeAppFast();
  return false;
}

// 轻量重启：只重载 webview 里的 JS/UI，sing-box 子进程完全不动。
// 重载后 boot() 会走 attachExistingMainCore() 附着到仍在运行的内核，
// 代理链路与现有连接不中断；--load-dir-res 让磁盘上的新代码直接生效。
async function reloadAppSurface(reason = "user", options = {}) {
  try {
    log(`Reloading UI surface (core untouched): ${reason}`);
    // 停掉本上下文的定时器与竞赛，避免重载瞬间还有请求在飞
    stopContinuousCompetition("surface-reload");
    if (state.nodeGuardTimer) {
      clearInterval(state.nodeGuardTimer);
      state.nodeGuardTimer = null;
    }
    await requestCodexProbeCancel();
    await state.phoneProbeController?.stop();
    await saveSettingsNow().catch(err => log(`Save before surface reload failed: ${err.message || err}`));
    await flushLogBuffer().catch(err => console.error("Log flush before reload failed", err));
    await sleep(120);
    // 带唯一参数跳转，连同 HTML 一起绕开缓存；脚本自身由 index.html 的
    // 动态注入器加时间戳，确保重载后跑的是磁盘上的最新代码。
    const hidden = options.hidden === true || !state.surfaceVisible;
    window.location.replace(window.location.pathname + "?r=" + Date.now() + "&hidden=" + (hidden ? "1" : "0"));
    return true;
  }
  catch (err) {
    log(`Surface reload failed: ${err.message || err}`);
    return false;
  }
}

async function onTrayIconOpenRequested() {
  return await requestMainWindowShow("tray-icon").catch((err) => { log(`Tray icon show failed: ${err.message || err}`); return false; });
}

async function settleWithin(label, promise, timeoutMs) {
  let timer = null;
  try {
    await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
    return true;
  }
  catch (err) {
    log(`${label} failed: ${err.message || err}`);
    return false;
  }
  finally {
    if (timer) clearTimeout(timer);
  }
}

async function requestApplicationExit() {
  let completed = false;
  const gracefulExit = Promise.resolve()
    .then(() => Neutralino.app.exit(0))
    .then(() => { completed = true; })
    .catch((err) => log(`Graceful app exit failed: ${err.message || err}`));
  await Promise.race([gracefulExit, sleep(APP_EXIT_GRACE_MS)]);
  if (!completed) {
    const pid = Number(window.NL_PID || state.instanceIdentity && state.instanceIdentity.pid || 0);
    if (pid > 0) {
      Neutralino.os.execCommand(`taskkill /PID ${pid} /T /F`).catch(() => {});
      await sleep(100);
    }
    if (Neutralino.app && typeof Neutralino.app.killProcess === "function") {
      await Neutralino.app.killProcess().catch(() => {});
    }
  }
  return true;
}

function stopInstanceSignalWatcher() {
  if (state.instanceSignalTimer) clearInterval(state.instanceSignalTimer);
  state.instanceSignalTimer = null;
  state.instanceSignalBusy = false;
}

async function releaseInstanceOwnership() {
  stopInstanceSignalWatcher();
  const lock = await readInstanceJson(state.paths.instanceLock);
  if (lock && state.instanceIdentity && String(lock.pid) === String(state.instanceIdentity.pid)) {
    await removeFileIfExists(state.paths.instanceLock);
  }
  await removeFileIfExists(state.paths.instanceSignal);
  await removeFileIfExists(state.paths.instanceAck);
}

async function runExitSequence() {
  stopContinuousCompetition("app-exit");
  await removeTrayIcon();
  await Neutralino.window.hide().catch((err) => log(`Hide on exit failed: ${err.message || err}`));
  try {
    // 三项互不依赖,并行收尾;停核心失败再做端口兜底
    const [, , stopped] = await Promise.all([
      settleWithin("Save settings on exit", saveSettingsNow(), EXIT_SAVE_TIMEOUT_MS),
      settleWithin("Auto start update on exit", applyAutoStartSetting(), EXIT_SAVE_TIMEOUT_MS),
      settleWithin("Stop proxy on exit", stopAll(), EXIT_STOP_TIMEOUT_MS)
    ]);
    if (!stopped) {
      await settleWithin(
        "Force stop proxy ports",
        killCorePorts([state.settings.mainPort, state.settings.mainControllerPort], "Exit fallback"),
        EXIT_SAVE_TIMEOUT_MS
      );
    }
  }
  finally {
    await flushLogBuffer().catch(err => console.error("Final log flush failed", err));
    await releaseInstanceOwnership().catch((err) => log(`Release instance failed: ${err.message || err}`));
      try {
        await requestApplicationExit();
      }
    catch (err) {
      state.closing = false;
      state.exitPromise = null;
      await showMainWindow("exit-failed").catch(() => {});
      throw err;
    }
  }
  return true;
}

async function closeAppFast() {
  if (state.exitPromise) return await state.exitPromise;
  state.closing = true;
  await state.phoneProbeController?.stop().catch(err => log(`Phone controller stop failed: ${err.message || err}`));
  state.exitPromise = runExitSequence();
  return await state.exitPromise;
}

async function onWindowClose() {
  if (state.closing) return;
  state.surfaceVisible = false;
  await Neutralino.window.hide().catch(() => {});
  settleWithin("Save settings on hide", saveSettingsNow(), EXIT_SAVE_TIMEOUT_MS);
}

// silent 启动采用屏外创建(见 launcher.vbs);boot 时把窗口移回原位
async function restoreWindowPositionAfterOffscreenLaunch() {
  if (NL_MODE !== "window") return;
  try {
    const restorePath = await Neutralino.filesystem.getJoinedPath(state.paths.work, "window-restore.json");
    const text = await readTextIfExists(restorePath);
    if (!text) return;
    await removeFileIfExists(restorePath);
    const parsed = JSON.parse(text);
    const x = Math.trunc(Number(parsed.x));
    const y = Math.trunc(Number(parsed.y));
    if (Number.isFinite(x) && Number.isFinite(y) && x > -20000 && y > -20000) {
      await Neutralino.window.move(x, y);
    }
    else {
      await Neutralino.window.move(200, 120);
    }
    log("Window moved back after offscreen silent launch");
  }
  catch (err) {
    log(`Offscreen window restore failed: ${err.message || err}`);
  }
}

function handleBootFailure(err) {
  state.uiReady = false;
  state.settingsLoaded = false;
  if (state.settingsPersistTimer) clearTimeout(state.settingsPersistTimer);
  state.settingsPersistTimer = null;
  stopCoreLogStream();
  log(`Boot failed: ${err.message || err}; settings writes blocked, existing core untouched`);
}

async function boot() {
  const silentStartup = isSilentStartup();
  const hiddenReload = new URLSearchParams(window.location.search || "").get("hidden") === "1";
  const verifyWindowReady = isWindowReadyVerificationMode();
  if (NL_MODE === "window") await Neutralino.window.hide().catch(() => {});
  await initPaths();
  // 清理旧屏外机制可能残留的坐标(现已改用首帧闪现方案)
  await restoreWindowPositionAfterOffscreenLaunch();
  if (!await ensureSingleInstanceOrExit()) return;
  await startInstanceSignalWatcher();
  if (verifyWindowReady) await requestMainWindowShow("instance-command");
  await seedBundledPrivateConfig();
  await loadSettings();
  if (!verifyWindowReady) await refreshSubscriptionNodeCatalog();
  renderProxyNodes();
  await bindEvents();
  if (!verifyWindowReady) await setTray().catch((err) => log(`Tray setup failed: ${err.message || err}`));
  const attached = await attachExistingMainCore().catch((err) => {
    log(`Existing core attach failed: ${err.message || err}`);
    return false;
  });
  if (state.handoffFromPid && !attached) {
    log("UI handoff failed: existing core unavailable; will not start or restart any core");
    await flushLogBuffer().catch(err => console.error("Handoff failure log flush failed", err));
    await Neutralino.app.exit(1); return;
  }
  setStatus();
  updateSystemNetworkOptimizeStatus();
  log("Ready");
  log(`Build ${APP_BUILD_ID}, data ${state.paths.data}`);
  state.uiReady = true;
  const pendingWindowShowReason = state.pendingWindowShowReason;
  state.pendingWindowShowReason = "";
  if (verifyWindowReady) {
    const surfaceReady = document.readyState !== "loading" && !!document.querySelector(".app")
      && !!document.getElementById("removeOfflineYamlBtn") && document.getElementById("streamQualityRounds")?.options.length === 2
      && typeof SmartProxyStreamQuality !== "undefined" && typeof StreamQuality !== "undefined"
      && !!document.getElementById("siteFailoverTargets") && !!document.getElementById("siteFailoverEnabled")
      && typeof SmartProxySiteFailover !== "undefined" && typeof SmartProxySiteFailover.createGuard === "function"
      && typeof SmartProxyNetwork !== "undefined" && typeof SmartProxyNetwork.runRound === "function"
      && !!document.getElementById("testNetworkBtn") && !!document.getElementById("coreVersionStatus")
      && !!document.getElementById("subscriptionRefreshDetails");
    let probeResourcesReady = false;
    try {
      const dualModelScript = await dualModelProbeScriptPath();
      const codexSubscriptionScript = await codexSubscriptionProbeScriptPath();
      const coreManagerScript = await bundledProbeScriptPath("core-manager.ps1", "Core updater");
      probeResourcesReady = await access(dualModelScript) && await access(codexSubscriptionScript) && await access(coreManagerScript);
    }
    catch (err) {
      log(`Probe resource verification failed: ${err.message || err}`);
    }
    const verificationPassed = pendingWindowShowReason === "instance-command"
      && surfaceReady
      && probeResourcesReady;
    if (verificationPassed) {
      log("Window readiness verification passed: deferred=true surface=true probeResources=true");
    }
    else {
      log(`Window readiness verification failed: deferred=${pendingWindowShowReason || "none"} surface=${surfaceReady} probeResources=${probeResourcesReady}`);
    }
    await Neutralino.filesystem.writeFile(await Neutralino.filesystem.getJoinedPath(state.paths.work, "ui-readiness.json"),
      JSON.stringify({ build: APP_BUILD_ID, surfaceReady, probeResourcesReady, verificationPassed, hidden: true }));
    await flushLogBuffer().catch(err => console.error("Readiness log flush failed", err));
    await Neutralino.window.hide().catch(() => {});
    await Neutralino.app.exit(verificationPassed ? 0 : 1);
    return;
  }
  else if (state.handoffFromPid) {
    // Installation is background-only. Do not use the legacy show/hide first-frame workaround.
    await Neutralino.window.hide();
    const probeScript = await dualModelProbeScriptPath();
    const nodeRuntime = await resolveProbeNodeRuntime();
    await syncSiteFailoverState("ui-handoff");
    const owner = await readInstanceJson(state.paths.instanceLock);
    if (Number(owner?.pid) !== state.handoffFromPid) throw new Error("UI handoff owner changed; refusing takeover");
    await Neutralino.filesystem.writeFile(state.paths.instanceLock, JSON.stringify({ ...state.instanceIdentity, at: Date.now() }));
    await Neutralino.filesystem.writeFile(await Neutralino.filesystem.getJoinedPath(state.paths.work, "ui-handoff-ready.json"),
      JSON.stringify({ pid: Number(state.instanceIdentity.pid), previousPid: state.handoffFromPid, build: APP_BUILD_ID,
        attached: true, node: state.currentNode, probeLanes: state.probePortByTag.size, probeScript, nodeRuntime,
        siteFailover: { enabled: state.settings.siteFailoverEnabled, logReady: state.siteFailoverLogReady,
          sites: state.settings.siteFailoverTargets, uiReady: !!document.getElementById("siteFailoverTargets") }, at: Date.now() }));
    log("UI handoff ready; core and node unchanged; installer may retire the old UI process only");
  }
  else if (hiddenReload) {
    await Neutralino.window.hide();
    log("UI reload ready (hidden); existing core retained");
  }
  else if (pendingWindowShowReason) {
    await showMainWindow(pendingWindowShowReason).catch((err) => log(`Deferred window show failed: ${err.message || err}`));
  }
  else if (silentStartup) {
    // 首帧闪现:WebView2 必须在屏内真实呈现过一次,之后的托盘唤醒才有内容
    // (隐藏或屏外创建的 webview 不产帧,直接唤醒是永久白屏)
    try {
      await Neutralino.window.show();
      // rAF 只在 webview 真实可见时运行:双拍回调触发 = 合成器已产出首帧
      let rafFired = false;
      await Promise.race([
        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => { rafFired = true; resolve(); }))),
        sleep(2000)
      ]);
      await sleep(250);
      log(`Silent stash diag: raf=${rafFired} visState=${document.visibilityState}`);
      // 只 hide,不 minimize:minimize 会把窗口尺寸固化成任务栏尺寸(159x27),
      // 之后 show 出来是个残缺小窗
      await Neutralino.window.hide();
      log("Silent startup stashed (show->hide)");
    }
    catch (err) {
      log(`Silent startup stash failed: ${err.message || err}`);
    }
  }
  else await showMainWindow("startup").catch((err) => log(`Startup show failed: ${err.message || err}`));
  applyAutoStartSetting().catch((err) => log(`Auto start update failed: ${err.message || err}`));
  refreshSystemNetworkOptimizeStatus({ silent: true }).catch((err) => log(`System network optimization status failed: ${err.message || err}`));
  try {
    await ensureSelectedCoreReady();
    if (shouldStartProxyOnBoot() && !attached) {
      await startMainCore();
      log("Silent startup proxy ready");
    }
  }
  catch (err) {
    state.mainProcess = null;
    state.mainCoreReady = false;
    setStatus();
    log(`Core startup failed: ${err.message || err}`);
  }
  if (state.mainCoreReady) scheduleContinuousCompetition(attached ? "attached-core" : "boot-ready");
  startNodeGuard();
  const bulkVerificationLimit = isolatedCodexBulkVerificationLimit();
  if (bulkVerificationLimit > 0 && state.mainCoreReady) {
    try {
      const summary = await testAllCodexNodes({ limit: bulkVerificationLimit });
      if (!summary || summary.successful < 1 || summary.verified < 1) {
        throw new Error(`应用内全测无成功节点：${JSON.stringify(summary || {})}`);
      }
      log(`Upload bulk entry verification passed: ${JSON.stringify(summary)}`);
    }
    catch (err) {
      log(`Upload bulk entry verification failed: ${err.message || err}`);
    }
  }
  const continuousVerificationLimit = isolatedContinuousVerificationLimit();
  if (continuousVerificationLimit > 0 && state.mainCoreReady) {
    try {
      state.continuousProbeDesired = true;
      state.continuousProbeBestMbps = 0;
      state.continuousProbeBestKey = "";
      const summary = await testAllCodexNodes({
        limit: continuousVerificationLimit,
        continuous: true,
        onResult: applyContinuousRecord
      });
      stopContinuousCompetition("verification-complete");
      if (!summary || summary.successful < 1 || state.continuousProbeBestMbps <= 0 || !state.continuousProbeBestKey) {
        throw new Error(`持续竞赛未产生新纪录：${JSON.stringify(summary || {})}`);
      }
      log(`Continuous upload verification passed: best=${state.continuousProbeBestMbps.toFixed(2)} key=${state.continuousProbeBestKey}`);
    }
    catch (err) {
      stopContinuousCompetition("verification-failed");
      log(`Continuous upload verification failed: ${err.message || err}`);
    }
  }
}

window.SmartProxyLifecycleTest = {
  state,
  setTray,
  showMainWindow,
  requestMainWindowShow,
  onTrayMenuItemClicked,
  onTrayIconOpenRequested,
  signalPrimaryInstance,
  closeAppFast
};

if (window.__SMART_PROXY_TEST__) {
  Object.assign(window.SmartProxyLifecycleTest, {
    deleteActiveSubscription,
    downloadSubscription,
    loadMergedCachedSubscriptionPoolForStartup,
    refreshSubscription,
    resolveSubscriptionConfigPath,
    activateSubscription,
    beginAddSubscription,
    renderProxyNodes,
    renderSubscriptionControls,
    saveSubscriptionProfile,
    refreshSubscriptionNodeCatalog,
    applyContinuousRecord,
    scheduleContinuousCompetition,
    stopContinuousCompetition,
    runCodexNetworkProbe,
    testCodexNode,
    testAllCodexNodes
  });
}

if (!window.__SMART_PROXY_TEST__) {
  Neutralino.init();
  Neutralino.events.on("spawnedProcess", onSpawnedProcess);
  Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
  Neutralino.events.on("trayIconClicked", onTrayIconOpenRequested);
  Neutralino.events.on("trayIconDoubleClicked", onTrayIconOpenRequested);
  Neutralino.events.on("trayIconDblClicked", onTrayIconOpenRequested);
  Neutralino.events.on("appClientConnect", onTrayIconOpenRequested);
  Neutralino.events.on("windowClose", onWindowClose);
  boot().catch(handleBootFailure);
}
