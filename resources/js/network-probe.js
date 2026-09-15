/* Account-free HTTPS reachability; uses existing sing-box outbounds, never a selector PUT. */
(function (root) {
  "use strict";
  async function runRound(entries, options) {
    const results = new Map(), unique = [...new Map(entries.map(e => [e.key, e])).values()];
    let cursor = 0, completed = 0, peak = 0, active = 0;
    const measure = async (entry, control = false) => {
      active++; peak = Math.max(peak, active);
      let value;
      try {
        const delay = await options.probe(entry, options.signal);
        value = Number.isFinite(delay) && delay >= 0
          ? { status: "done", delayMs: Math.max(1, delay), measuredAt: Date.now() }
          : { status: "error", failureScope: "measurement", error: "控制器未返回有效延迟" };
      } catch (error) {
        value = { status: options.signal?.aborted ? "cancelled" : "error", failureScope: options.signal?.aborted ? "cancelled" : error.scope || "node", error: String(error.message || error).slice(0, 400) };
      } finally { active--; }
      results.set(entry.key, value);
      if (!control) completed++;
      options.onProgress?.({ completed, total: unique.length, entry, value, phase: control ? "control" : "scan" });
      return value;
    };
    await Promise.all(Array.from({ length: Math.min(4, unique.length) }, async () => {
      while (cursor < unique.length && !options.signal?.aborted) await measure(unique[cursor++]);
    }));
    const failed = unique.filter(e => results.get(e.key)?.failureScope === "node");
    if (!options.signal?.aborted && failed.length >= Math.max(3, Math.ceil(unique.length * 0.8))) {
      options.log?.("Network test: mass target failures; serial control recheck, not an all-nodes-dead verdict");
      let recovered = 0;
      for (const entry of failed.slice(0, 3)) {
        if (options.signal?.aborted) break;
        // Controls have separate progress, never inflate the node count.
        const value = await measure(entry, true);
        if (value.status === "done") recovered++;
      }
      if (!recovered && !options.signal?.aborted) {
        for (const entry of failed) {
          const original = results.get(entry.key);
          results.set(entry.key, { ...original, failureScope: "round", error: "测试目标或网络环境异常；不判定全部节点失效。原始错误：" + original.error });
        }
        options.log?.("Network test: serial control did not recover; previous successes retained");
      }
    }
    for (const entry of unique) if (!results.has(entry.key)) results.set(entry.key, { status: "cancelled", failureScope: "cancelled", error: "未测量，已停止" });
    return { results, peak, cancelled: !!options.signal?.aborted };
  }
  function merge(previous, next) {
    if (next.status === "done") return { ...next, lastSuccess: { delayMs: next.delayMs, measuredAt: next.measuredAt } };
    return { ...next, measuredAt: Date.now(), lastSuccess: previous?.lastSuccess || (previous?.status === "done" ? { delayMs: previous.delayMs, measuredAt: previous.measuredAt } : undefined) };
  }
  const api = { runRound, merge };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartProxyNetwork = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
