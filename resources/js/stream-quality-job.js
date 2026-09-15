/* Neutralino lifecycle adapter; protocol and network execution live in lop-spec/stream-quality. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartProxyStreamQuality = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const quote = value => '"' + String(value).replace(/"/g, '\\"') + '"';
  async function execute(options, hooks) {
    const { ns, workDir, nodePath, scriptPath, job } = options;
    const jobPath = await ns.filesystem.getJoinedPath(workDir, `stream-quality-job-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    await ns.filesystem.writeFile(jobPath, JSON.stringify(job));
    try {
      return await new Promise((resolve, reject) => {
        let buffer = "", stderr = "", result, settled = false, watchdog, forced;
        const early = [], owner = { proc: null };
        hooks.onJob(owner);
        const finish = async error => {
          if (settled) return; settled = true; clearTimeout(watchdog); clearTimeout(forced);
          await ns.events.off("spawnedProcess", onEvent).catch(e => hooks.log(`Probe listener cleanup failed: ${e.message || e}`));
          hooks.onJob(null);
          if (error) reject(error); else resolve(result);
        };
        const consume = line => {
          let event; try { event = JSON.parse(line); } catch { if (line.trim()) hooks.log("Probe ignored non-JSON output"); return; }
          if (event.type === "result") result = event;
          hooks.onEvent(event);
        };
        const handle = detail => {
          const action = String(detail.action || detail.event || "");
          if (action === "stdOut") {
            buffer += String(detail.data || "");
            if (buffer.length > 8 * 1024 * 1024) { void terminate("Probe output exceeded 8 MiB bound"); return; }
            let i; while ((i = buffer.indexOf("\n")) >= 0) { consume(buffer.slice(0, i)); buffer = buffer.slice(i + 1); }
          } else if (action === "stdErr") stderr = (stderr + String(detail.data || "")).slice(-1000);
          else if (action === "exit") {
            if (buffer.trim()) consume(buffer);
            void finish(result?.ok === true && Number(detail.data || 0) === 0 ? null : Error(result?.error || stderr || "Probe exited without a valid result"));
          }
        };
        const onEvent = event => {
          const detail = event?.detail || {};
          if (!owner.proc) { if (early.length < 64) early.push(detail); return; }
          if (detail.id === owner.proc.id) handle(detail);
        };
        const terminate = async message => {
          hooks.log(message + "; cancelling owned helper, daily core untouched");
          if (owner.proc) await ns.os.updateSpawnedProcess(owner.proc.id, "stdIn", '{"action":"cancel"}\n').catch(e => hooks.log(`Cancel delivery failed: ${e.message || e}`));
          forced = setTimeout(async () => {
            if (settled) return;
            // /T is restricted to this newly spawned worker and its isolated child.
            if (Number(owner.proc?.pid) > 0) {
              const killed = await ns.os.execCommand(`taskkill.exe /PID ${Number(owner.proc.pid)} /T /F`);
              if (killed.exitCode) hooks.log(`Owned helper tree termination failed: exit ${killed.exitCode}`);
            } else hooks.log("Owned helper PID unavailable; no unrelated process will be killed");
            await finish(Error(message));
          }, 3000);
        };
        (async () => {
          await ns.events.on("spawnedProcess", onEvent);
          if (hooks.isCancelled()) { await finish(Error("cancelled before helper start")); return; }
          owner.proc = await ns.os.spawnProcess([quote(nodePath), quote(scriptPath), "--job", quote(jobPath)].join(" "), { cwd: workDir });
          early.filter(detail => detail.id === owner.proc.id).forEach(handle);
          if (hooks.isCancelled()) await ns.os.updateSpawnedProcess(owner.proc.id, "stdIn", '{"action":"cancel"}\n');
          if (!settled) watchdog = setTimeout(() => void terminate("Probe supervisor deadline exceeded"), Math.max(120000, job.nodes.length * job.rounds * 91000 + 20000));
        })().catch(error => { if (owner.proc) void terminate(error.message); else void finish(error); });
      });
    } finally {
      await ns.filesystem.remove(jobPath).catch(error => hooks.log(`Private job cleanup failed: ${error.message || error}`));
    }
  }
  async function serve(options, hooks) {
    const { ns, workDir, nodePath, scriptPath, job } = options;
    const jobPath = await ns.filesystem.getJoinedPath(workDir, `stream-quality-controller-${Date.now()}.json`);
    await ns.filesystem.writeFile(jobPath, JSON.stringify(job));
    let proc, buffer = "", done = false, ready = false, deadline, resolveReady, rejectReady, closeResolve;
    const early = [], closed = new Promise(resolve => { closeResolve = resolve; });
    const pending = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const cleanup = async () => {
      if (done) return; done = true; clearTimeout(deadline);
      await ns.events.off("spawnedProcess", onEvent).catch(e => hooks.log(`Controller listener cleanup failed: ${e.message || e}`));
      await ns.filesystem.remove(jobPath).catch(e => hooks.log(`Controller private job cleanup failed: ${e.message || e}`));
      hooks.onClose(); closeResolve(); if (!ready) rejectReady(Error("手机控制执行层未能启动，请检查端口 8799 与 Node 运行时"));
    };
    const stop = async () => {
      if (done) return;
      if (proc) await ns.os.updateSpawnedProcess(proc.id, "stdIn", '{"action":"shutdown"}\n').catch(e => hooks.log(`Controller stop delivery failed: ${e.message || e}`));
      let timer; await Promise.race([closed, new Promise(resolve => { timer = setTimeout(resolve, 5000); })]); clearTimeout(timer);
      if (!done && Number(proc?.pid) > 0) {
        hooks.log("Controller stop deadline exceeded; terminating only its owned process tree");
        const r = await ns.os.execCommand(`taskkill.exe /PID ${Number(proc.pid)} /T /F`);
        if (r.exitCode) hooks.log(`Controller termination failed: exit ${r.exitCode}`);
        await cleanup();
      }
    };
    const handle = detail => {
      if (detail.action === "stdOut") {
        buffer += String(detail.data || "");
        if (buffer.length > 8 * 1024 * 1024) { hooks.log("Controller output exceeded bound"); void stop(); return; }
        let i; while ((i = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, i); buffer = buffer.slice(i + 1);
          let e; try { e = JSON.parse(line); } catch { hooks.log("Controller ignored invalid event"); continue; }
          if (e.type === "controller-ready") { ready = true; clearTimeout(deadline); resolveReady({ proc, port: e.port, token: e.token, executionHost: e.executionHost, stop }); }
          else hooks.onEvent(e);
        }
      } else if (detail.action === "stdErr") hooks.log(`Controller: ${String(detail.data || "").slice(0, 500)}`);
      else if (detail.action === "exit") void cleanup();
    };
    const onEvent = event => { const d = event?.detail || {}; if (!proc) { if (early.length < 64) early.push(d); } else if (d.id === proc.id) handle(d); };
    try {
      await ns.events.on("spawnedProcess", onEvent);
      proc = await ns.os.spawnProcess([quote(nodePath), quote(scriptPath), "--job", quote(jobPath), "--port", String(options.port ?? 8799)].join(" "), { cwd: workDir });
      early.filter(d => d.id === proc.id).forEach(handle);
      if (!ready && !done) deadline = setTimeout(() => { hooks.log("Controller readiness deadline exceeded"); void stop(); }, 12000);
    } catch (error) { hooks.log(`Controller start failed: ${error.message || error}`); await cleanup(); }
    return pending;
  }
  return { execute, serve };
});
