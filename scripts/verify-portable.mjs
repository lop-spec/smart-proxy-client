import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(root, "dist", "smart-proxy-client");
const executable = join(bundle, "smart-proxy-client-win_x64.exe");
const data = readFileSync(executable);
if (data[0] !== 0x4d || data[1] !== 0x5a) throw new Error("Portable artifact is not a Windows PE executable");
if (statSync(executable).size < 50 * 1024 * 1024) throw new Error("Portable artifact is unexpectedly small; embedded dependencies are missing");

const hash = createHash("sha256").update(data).digest("hex");
writeFileSync(join(bundle, "SHA256SUMS.txt"), `${hash}  smart-proxy-client-win_x64.exe\n`);

const isolated = mkdtempSync(join(tmpdir(), "smart-proxy-release-"));
const isolatedExe = join(isolated, "smart-proxy-client-win_x64.exe");
copyFileSync(executable, isolatedExe);

const exitCode = await new Promise((resolveExit, reject) => {
  const child = spawn(isolatedExe, ["--isolated-test", "--verify-window-ready"], {
    cwd: isolated,
    windowsHide: true,
    stdio: "ignore"
  });
  const timer = setTimeout(() => {
    child.kill();
    reject(new Error("Portable executable readiness verification timed out"));
  }, 30_000);
  child.once("error", reject);
  child.once("exit", (code) => {
    clearTimeout(timer);
    resolveExit(code);
  });
});

rmSync(isolated, { recursive: true, force: true });
if (exitCode !== 0) throw new Error(`Portable executable readiness verification failed with exit code ${exitCode}`);
console.log(JSON.stringify({ executable, bytes: data.length, sha256: hash, runtimeExitCode: exitCode }, null, 2));
