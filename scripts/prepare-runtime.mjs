import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const artifacts = {
  neutralino: {
    url: "https://github.com/neutralinojs/neutralinojs/releases/download/v6.8.0/neutralinojs-v6.8.0.zip",
    archiveSha256: "4e467627cb12d215d658469484bf59ec2be762b3e242f8d7b2e286be355d698f"
  },
  singBox: {
    url: "https://github.com/SagerNet/sing-box/releases/download/v1.13.13/sing-box-1.13.13-windows-amd64.zip",
    archiveSha256: "aea1fa983134a2e2d0600581d1178e98bd6bb93ae12ad8c333eaacae68a1694c",
    executableSha256: "af59a77a8171dd74b0b560ce34439a85b44cb82d87acfd8b6d2c4c933ad0397d"
  },
  font: {
    url: "https://raw.githubusercontent.com/notofonts/noto-cjk/165c01b46ea533872e002e0785ff17e44f6d97d8/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf",
    archiveSha256: "2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b"
  }
};

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

async function downloadVerified({ url, archiveSha256 }) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const actual = sha256(bytes);
      if (actual !== archiveSha256) {
        throw new Error(`Archive checksum mismatch for ${url}: ${actual}`);
      }
      return bytes;
    }
    catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1_000));
    }
  }
  throw lastError;
}

function zipEntryByBasename(zip, filename) {
  const normalized = filename.toLowerCase();
  const entry = zip.getEntries().find((candidate) => {
    const parts = candidate.entryName.replace(/\\/g, "/").split("/");
    return !candidate.isDirectory && parts.at(-1).toLowerCase() === normalized;
  });
  if (!entry) throw new Error(`Missing ${filename} in downloaded archive`);
  return entry;
}

async function prepareNeutralino() {
  const target = join(root, "bin", "neutralino-win_x64.exe");
  if (existsSync(target)) return;
  const localRuntime = join(root, "smart-proxy-client-win_x64.exe");
  if (existsSync(localRuntime)) {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(localRuntime, target);
    return;
  }
  const zip = new AdmZip(await downloadVerified(artifacts.neutralino));
  mkdirSync(dirname(target), { recursive: true });
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.replace(/\\/g, "/").split("/").at(-1);
    if (!/^neutralino-(?:win|linux|mac)_/i.test(name)) continue;
    writeFileSync(join(root, "bin", name), entry.getData());
  }
  if (!existsSync(target)) throw new Error("Neutralino Windows runtime was not restored");
}

async function prepareSingBox() {
  const target = join(root, "resources", "bin", "sing-box.exe");
  if (existsSync(target) && sha256(readFileSync(target)) === artifacts.singBox.executableSha256) return;
  const zip = new AdmZip(await downloadVerified(artifacts.singBox));
  const data = zipEntryByBasename(zip, "sing-box.exe").getData();
  const actual = sha256(data);
  if (actual !== artifacts.singBox.executableSha256) {
    throw new Error(`sing-box executable checksum mismatch: ${actual}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
}

async function prepareFont() {
  const target = join(root, "resources", "fonts", "NotoSansCJKsc-Regular.otf");
  if (existsSync(target) && sha256(readFileSync(target)) === artifacts.font.archiveSha256) return;
  const data = await downloadVerified(artifacts.font);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
}

function preparePrivateConfig() {
  const manifestPath = join(root, "private-config.manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const outputRoot = join(root, "resources", "private-config");
  rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(join(outputRoot, "files"), { recursive: true });
  for (const item of manifest.files || []) {
    const source = resolve(root, item.source);
    if (!source.startsWith(root + "\\") || !existsSync(source)) {
      throw new Error(`Private configuration is missing or outside the project: ${item.source}`);
    }
    const destination = join(outputRoot, "files", item.source);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
  copyFileSync(manifestPath, join(outputRoot, "manifest.json"));
}

await Promise.all([prepareNeutralino(), prepareSingBox(), prepareFont()]);
preparePrivateConfig();
console.log("Pinned runtimes and private configuration are ready.");
