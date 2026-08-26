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

function sha256(payload) {
  return createHash("sha256").update(payload).digest("hex");
}

function assertEmbeddedPayload(label, source) {
  const payload = readFileSync(source);
  if (payload.length === 0 || data.indexOf(payload) < 0) {
    throw new Error(`Portable artifact does not contain the complete ${label} payload`);
  }
  return { label, bytes: payload.length, sha256: sha256(payload) };
}

function assertExtractedPayload(label, source, target) {
  const expected = readFileSync(source);
  const actual = readFileSync(target);
  if (actual.length === 0 || sha256(actual) !== sha256(expected)) {
    throw new Error(`Portable runtime did not extract the complete ${label} payload`);
  }
  return { label, bytes: actual.length, sha256: sha256(actual) };
}

const privateManifest = JSON.parse(readFileSync(join(root, "private-config.manifest.json"), "utf8"));
const embeddedPayloads = [
  assertEmbeddedPayload("sing-box runtime", join(root, "resources", "bin", "sing-box.exe")),
  assertEmbeddedPayload("Codex subscription probe helper", join(root, "resources", "scripts", "codex-subscription-probe.ps1")),
  assertEmbeddedPayload("dual-model probe helper", join(root, "resources", "scripts", "dual-model-probe.js")),
  assertEmbeddedPayload("probe config helper", join(root, "resources", "js", "config-helpers.js")),
  assertEmbeddedPayload("NotoSansCJKsc-Regular.otf", join(root, "resources", "fonts", "NotoSansCJKsc-Regular.otf")),
  ...privateManifest.files.map((item) => assertEmbeddedPayload(`private config ${item.source}`, join(root, item.source)))
];

const hash = sha256(data);
writeFileSync(join(bundle, "SHA256SUMS.txt"), `${hash}  smart-proxy-client-win_x64.exe\n`);

const isolated = mkdtempSync(join(tmpdir(), "smart-proxy-release-"));
const isolatedExe = join(isolated, "smart-proxy-client-win_x64.exe");
copyFileSync(executable, isolatedExe);

async function verifyRuntime() {
  const headlessCI = Boolean(process.env.CI);
  const deadlineMs = headlessCI ? 12_000 : 30_000;
  return await new Promise((resolveExit, reject) => {
    const startedAt = Date.now();
    const child = spawn(isolatedExe, ["--isolated-test", "--verify-window-ready"], {
      cwd: isolated,
      windowsHide: true,
      stdio: "ignore"
    });
    let acceptedHeadlessLiveness = false;
    let strictTimeout = false;
    const timer = setTimeout(() => {
      if (headlessCI) acceptedHeadlessLiveness = true;
      else strictTimeout = true;
      child.kill();
    }, deadlineMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      const aliveMs = Date.now() - startedAt;
      if (acceptedHeadlessLiveness) {
        resolveExit({ mode: "headless-liveness", exitCode: code, signal, aliveMs });
      }
      else if (strictTimeout) {
        reject(new Error("Portable executable readiness verification timed out"));
      }
      else if (code === 0) {
        resolveExit({ mode: "window-ready", exitCode: code, signal, aliveMs });
      }
      else {
        reject(new Error(`Portable executable readiness verification failed with exit code ${code}`));
      }
    });
  });
}

let runtime;
let probeResourceExtraction;
try {
  runtime = await verifyRuntime();
  const extractedRoot = join(isolated, "smart-proxy-data", "runtime", "probe-resources");
  if (runtime.mode === "window-ready") {
    probeResourceExtraction = {
      verified: true,
      payloads: [
        assertExtractedPayload(
          "Codex subscription probe helper",
          join(root, "resources", "scripts", "codex-subscription-probe.ps1"),
          join(extractedRoot, "scripts", "codex-subscription-probe.ps1")
        ),
        assertExtractedPayload(
          "dual-model probe helper",
          join(root, "resources", "scripts", "dual-model-probe.js"),
          join(extractedRoot, "scripts", "dual-model-probe.js")
        ),
        assertExtractedPayload(
          "probe config helper",
          join(root, "resources", "js", "config-helpers.js"),
          join(extractedRoot, "js", "config-helpers.js")
        )
      ]
    };
  }
  else {
    probeResourceExtraction = {
      verified: false,
      reason: `${runtime.mode} does not execute the WebView extraction path`
    };
  }
}
finally {
  rmSync(isolated, { recursive: true, force: true });
}

console.log(JSON.stringify({
  executable,
  bytes: data.length,
  sha256: hash,
  embeddedPayloads,
  probeResourceExtraction,
  runtime
}, null, 2));
