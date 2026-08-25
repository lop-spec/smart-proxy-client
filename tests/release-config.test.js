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
  assert.match(verifier, /NotoSansCJKsc-Regular\.otf/);
  assert.match(verifier, /process\.env\.CI/);
  assert.match(verifier, /headless-liveness/);
});
