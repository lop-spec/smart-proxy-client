const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

test("release build is pinned and embeds resources", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.devDependencies["@neutralinojs/neu"], "11.7.2");
  assert.match(pkg.scripts["build:portable"], /--embed-resources/);
  const buildScript = fs.readFileSync(path.join(root, "scripts", "prepare-runtime.mjs"), "utf8");
  assert.match(buildScript, /archiveSha256/);
  assert.match(buildScript, /executableSha256/);
  assert.match(buildScript, /notofonts\/noto-cjk\/165c01b46ea533872e002e0785ff17e44f6d97d8/);
});

test("every private configuration in the manifest exists", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "private-config.manifest.json"), "utf8"));
  assert.ok(manifest.files.length >= 8);
  for (const item of manifest.files) {
    assert.ok(fs.existsSync(path.join(root, item.source)), item.source);
    assert.ok(["app", "data", "runtime"].includes(item.scope), item.scope);
    assert.equal(path.basename(item.name), item.name);
  }
});

test("embedded private config is restored before settings load", () => {
  const main = fs.readFileSync(path.join(root, "resources", "js", "main.js"), "utf8");
  const seed = main.indexOf("await seedBundledPrivateConfig();");
  const load = main.indexOf("await loadSettings();", seed);
  assert.ok(seed > 0 && load > seed);
  assert.match(main, /Neutralino\.app\.exit\(verificationPassed \? 0 : 1\)/);
});

test("portable verification covers embedded payloads and headless CI", () => {
  const verifier = fs.readFileSync(path.join(root, "scripts", "verify-portable.mjs"), "utf8");
  assert.match(verifier, /private-config\.manifest\.json/);
  assert.match(verifier, /assertEmbeddedPayload/);
  assert.match(verifier, /join\(root, "resources", "bin", "sing-box\.exe"\)/);
  assert.match(verifier, /join\(root, "resources", "scripts", "codex-subscription-probe\.ps1"\)/);
  assert.match(verifier, /join\(root, "resources", "scripts", "dual-model-probe\.js"\)/);
  assert.match(verifier, /join\(root, "resources", "js", "config-helpers\.js"\)/);
  assert.match(verifier, /NotoSansCJKsc-Regular\.otf/);
  assert.match(verifier, /process\.env\.CI/);
  assert.match(verifier, /headless-liveness/);
});

test("portable probe helpers fall back to their embedded resources", async () => {
  const main = fs.readFileSync(path.join(root, "resources", "js", "main.js"), "utf8");
  const start = main.indexOf("const bundledProbeScriptPromises = new Map();");
  const end = main.indexOf("async function codexSubscriptionProbeScriptPath()", start);
  assert.ok(start > 0 && end > start, "the shared embedded probe-script resolver must exist");
  const resolver = main.slice(start, end);
  const files = new Set();
  const directories = [];
  const extractions = [];
  const context = {
    state: { paths: { appRoot: "C:\\portable", work: "C:\\portable-data\\runtime" } },
    Neutralino: {
      filesystem: { getJoinedPath: async (...parts) => path.win32.join(...parts) },
      resources: {
        extractFile: async (source, target) => {
          extractions.push([source, target]);
          files.add(target);
        }
      }
    },
    access: async (target) => files.has(target),
    ensureDirectory: async (target) => directories.push(target),
    removeFileIfExists: async (target) => files.delete(target),
    log: () => {}
  };
  vm.runInNewContext(`${resolver}\nglobalThis.resolveBundledProbe = bundledProbeScriptPath;`, context);

  const target = path.win32.join("C:\\portable-data\\runtime", "probe-resources", "scripts", "dual-model-probe.js");
  const helper = path.win32.join("C:\\portable-data\\runtime", "probe-resources", "js", "config-helpers.js");
  assert.equal(await context.resolveBundledProbe("dual-model-probe.js", "Dual-model probe helper"), target);
  assert.deepEqual(extractions, [
    ["/resources/js/config-helpers.js", helper],
    ["/resources/scripts/dual-model-probe.js", target]
  ]);
  assert.deepEqual(directories, [path.win32.dirname(target), path.win32.dirname(helper)]);
  assert.ok(files.has(target));
  assert.ok(files.has(helper));

  const wiring = main.slice(end, main.indexOf("async function ensureCodexProbeReady()", end));
  assert.match(wiring, /codexSubscriptionProbeScriptPath\(\)[\s\S]*bundledProbeScriptPath\(CODEX_TOK_PROBE_SCRIPT/);
  assert.match(wiring, /dualModelProbeScriptPath\(\)[\s\S]*bundledProbeScriptPath\(TOK_PROBE_BATCH_SCRIPT/);
});

test("portable runtime verification requires extraction only after WebView readiness", () => {
  const main = fs.readFileSync(path.join(root, "resources", "js", "main.js"), "utf8");
  const verification = main.slice(
    main.indexOf("if (verifyWindowReady)"),
    main.indexOf("else if (pendingWindowShowReason)")
  );
  assert.match(verification, /await dualModelProbeScriptPath\(\)/);
  assert.match(verification, /await codexSubscriptionProbeScriptPath\(\)/);
  assert.match(verification, /verificationPassed[\s\S]*probeResourcesReady/);

  const verifier = fs.readFileSync(path.join(root, "scripts", "verify-portable.mjs"), "utf8");
  assert.match(verifier, /assertExtractedPayload/);
  assert.match(verifier, /if \(runtime\.mode === "window-ready"\)/);
  assert.match(verifier, /verified: false[\s\S]*does not execute the WebView extraction path/);
  assert.match(verifier, /join\(isolated, "smart-proxy-data", "runtime", "probe-resources"\)/);
  assert.match(verifier, /join\(extractedRoot, "scripts", "dual-model-probe\.js"\)/);
  assert.match(verifier, /join\(extractedRoot, "scripts", "codex-subscription-probe\.ps1"\)/);
  assert.match(verifier, /join\(extractedRoot, "js", "config-helpers\.js"\)/);
});
