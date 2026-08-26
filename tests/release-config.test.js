const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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

test("portable probe helpers fall back to their embedded resources", () => {
  const main = fs.readFileSync(path.join(root, "resources", "js", "main.js"), "utf8");
  const start = main.indexOf("async function bundledProbeScriptPath(");
  const end = main.indexOf("async function ensureCodexProbeReady()", start);
  assert.ok(start > 0 && end > start, "the shared embedded probe-script resolver must exist");
  const resolver = main.slice(start, end);
  assert.match(resolver, /Neutralino\.resources\.extractFile\(`\/resources\/scripts\/\$\{fileName\}`/);
  assert.match(resolver, /Neutralino\.resources\.extractFile\("\/resources\/js\/config-helpers\.js"/);
  assert.match(resolver, /state\.paths\.work/);
  assert.match(resolver, /getJoinedPath\(resourceRoot, "scripts"\)/);
  assert.match(resolver, /getJoinedPath\(resourceRoot, "js"\)/);
  assert.match(resolver, /removeFileIfExists\(target\)/, "an app update must replace stale extracted helpers");
  assert.match(resolver, /codexSubscriptionProbeScriptPath\(\)[\s\S]*bundledProbeScriptPath\(CODEX_TOK_PROBE_SCRIPT/);
  assert.match(resolver, /dualModelProbeScriptPath\(\)[\s\S]*bundledProbeScriptPath\(TOK_PROBE_BATCH_SCRIPT/);
});

test("portable runtime verification exercises probe-resource extraction", () => {
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
  assert.match(verifier, /join\(isolated, "smart-proxy-data", "runtime", "probe-resources"\)/);
  assert.match(verifier, /join\(extractedRoot, "scripts", "dual-model-probe\.js"\)/);
  assert.match(verifier, /join\(extractedRoot, "scripts", "codex-subscription-probe\.ps1"\)/);
  assert.match(verifier, /join\(extractedRoot, "js", "config-helpers\.js"\)/);
});
