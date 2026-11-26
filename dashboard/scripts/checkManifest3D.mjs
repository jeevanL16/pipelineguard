import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const distDir = path.resolve(import.meta.dirname, "../dist");
const manifestPath = path.join(distDir, ".vite/manifest.json");

if (!fs.existsSync(manifestPath)) {
  console.error("FAIL: Missing build manifest at", manifestPath);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function collectClosure(startKey, seen = new Set()) {
  if (!startKey || seen.has(startKey)) return seen;
  seen.add(startKey);
  const entry = manifest[startKey];
  if (!entry) return seen;
  for (const imp of entry.imports || []) {
    collectClosure(imp, seen);
  }
  return seen;
}

const entryKeys = Object.keys(manifest).filter((k) => manifest[k].isEntry);
const landingKeys = Object.keys(manifest).filter(
  (k) => k.includes("LandingPage") && !k.includes("three")
);
const appPageKeys = Object.keys(manifest).filter(
  (k) =>
    (k.includes("DashboardShell") ||
      k.includes("OverviewPage") ||
      k.includes("FindingsPage") ||
      k.includes("PipelinesPage") ||
      k.includes("RunsPage")) &&
    !k.includes("ArtifactsPage")
);

const is3DChunk = (key, entry) => {
  const file = entry?.file || "";
  return (
    /three|SmokeProbe|GateSequence|ArchitectureFlow|HeroGate|RuleCatalog3D|AttackPath3D|LedgerChain/i.test(
      key + " " + file
    )
  );
};

let failed = false;

for (const key of [...entryKeys, ...landingKeys, ...appPageKeys]) {
  const closure = collectClosure(key);
  for (const depKey of closure) {
    const depEntry = manifest[depKey];
    if (is3DChunk(depKey, depEntry)) {
      console.error(`FAIL: Static closure of ${key} pulls 3D chunk ${depKey} (${depEntry?.file})`);
      failed = true;
    }
  }
}

const assetsDir = path.join(distDir, "assets");
const jsFiles = fs.existsSync(assetsDir)
  ? fs.readdirSync(assetsDir).filter((f) => f.endsWith(".js"))
  : [];

let totalLazy3dRaw = 0;
let totalLazy3dGz = 0;
const lazy3dDetails = [];

for (const file of jsFiles) {
  const full = path.join(assetsDir, file);
  const buf = fs.readFileSync(full);
  const gz = zlib.gzipSync(buf).length;
  const landingStatic = entryKeys
    .concat(landingKeys)
    .some((k) => [...collectClosure(k)].some((dk) => manifest[dk]?.file === `assets/${file}`));

  const looks3d =
    /three-runtime|SmokeProbe|GateSequence|ArchitectureFlow|HeroGate|RuleCatalog3D|AttackPath3D|LedgerChain/i.test(
      file
    ) ||
    (!landingStatic && /__webgl_context|WebGLRenderer|OrbitControls|ShapeGeometry/.test(buf.toString("utf8")));

  if (looks3d) {
    totalLazy3dRaw += buf.length;
    totalLazy3dGz += gz;
    lazy3dDetails.push({ file, rawKb: +(buf.length / 1024).toFixed(2), gzKb: +(gz / 1024).toFixed(2) });
  }
}

const landingClosureFiles = new Set();
for (const k of [...entryKeys, ...landingKeys]) {
  for (const dk of collectClosure(k)) {
    if (manifest[dk]?.file) landingClosureFiles.add(manifest[dk].file);
  }
}

let landingClosureGz = 0;
for (const rel of landingClosureFiles) {
  const full = path.join(distDir, rel);
  if (fs.existsSync(full)) {
    landingClosureGz += zlib.gzipSync(fs.readFileSync(full)).length;
  }
}

console.log(JSON.stringify({
  manifestCheckedEntries: entryKeys.length + landingKeys.length + appPageKeys.length,
  isolationPassed: !failed,
  landingStaticClosureGzKb: +(landingClosureGz / 1024).toFixed(2),
  lazy3dChunks: lazy3dDetails,
  totalLazy3dRawKb: +(totalLazy3dRaw / 1024).toFixed(2),
  totalLazy3dGzKb: +(totalLazy3dGz / 1024).toFixed(2),
}, null, 2));

if (failed) process.exit(1);
if (totalLazy3dGz / 1024 > 300) {
  console.error("STOP GATE TRIGGERED: Total lazy 3D gzipped exceeds 300 KB!");
  process.exit(2);
}
