import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const PORT = 4183;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.resolve(import.meta.dirname, "../public/images/preview");

function resolveChromiumExecutable() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const candidates = [
    path.join(localAppData, "ms-playwright", "chromium-1243", "chrome-win64", "chrome.exe"),
    path.join(localAppData, "ms-playwright", "chromium_headless_shell-1243", "chrome-headless-shell-win64", "chrome-headless-shell.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function startPreviewServer() {
  const child = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["vite", "preview", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"],
    {
      cwd: path.resolve(import.meta.dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    }
  );
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Preview server timeout")), 15000);
    const onData = (chunk) => {
      const text = chunk.toString();
      if (text.includes(String(PORT)) || text.includes("Local:")) {
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`Preview exited early: ${code}`));
    });
  });
}

// Seed deterministic API records derived directly from real analyzer rule IDs across 4 dates
const SEED_PIPELINES = [
  { id: 1, pipeline_id: "pipe-release-ci", name: "pipe-release-ci", repository: "https://github.com/org/release-ci", branch: "main", status: "ACTIVE", created_at: "2026-11-22T09:00:00Z" },
  { id: 2, pipeline_id: "pipe-deploy-prod", name: "pipe-deploy-prod", repository: "https://github.com/org/deploy-prod", branch: "main", status: "ACTIVE", created_at: "2026-11-24T10:00:00Z" },
];

const SEED_EVENTS = [
  { id: 1, event_id: "PG-WF-006", pipeline_id: "pipe-release-ci", source: "workflow", event_type: "PG-WF-006", severity: "CRITICAL", risk_score: 96, status: "OPEN", description: "Unsafe pull_request_target checkout executes untrusted PR code.", timestamp: "2026-11-23T11:00:00Z", created_at: "2026-11-23T11:00:00Z" },
  { id: 2, event_id: "PG-WF-001", pipeline_id: "pipe-release-ci", source: "workflow", event_type: "PG-WF-001", severity: "CRITICAL", risk_score: 92, status: "OPEN", description: "Untrusted pull_request.title interpolated inside run shell step.", timestamp: "2026-11-24T12:00:00Z", created_at: "2026-11-24T12:00:00Z" },
  { id: 3, event_id: "PG-WF-005", pipeline_id: "pipe-deploy-prod", source: "workflow", event_type: "PG-WF-005", severity: "HIGH", risk_score: 74, status: "OPEN", description: "Broad write-all workflow token permissions.", timestamp: "2026-11-25T14:00:00Z", created_at: "2026-11-25T14:00:00Z" },
  { id: 4, event_id: "PG-WF-019", pipeline_id: "pipe-deploy-prod", source: "workflow", event_type: "PG-WF-019", severity: "HIGH", risk_score: 52, status: "OPEN", description: "Mutable @v3 action reference requires 40-char commit SHA.", timestamp: "2026-11-26T08:00:00Z", created_at: "2026-11-26T08:00:00Z" },
];

const SEED_RUNS = [
  { id: 1, run_id: "run-104", pipeline_id: 1, branch: "main", status: "FAILED", started_at: "2026-11-25T14:00:00Z", completed_at: "2026-11-25T14:01:12Z", created_at: "2026-11-25T14:00:00Z" },
  { id: 2, run_id: "run-105", pipeline_id: 2, branch: "main", status: "COMPLETED", started_at: "2026-11-26T08:00:00Z", completed_at: "2026-11-26T08:00:44Z", created_at: "2026-11-26T08:00:00Z" },
];

async function pngBufferToWebp(page, pngBuf, scale) {
  const b64 = pngBuf.toString("base64");
  const webpDataUrl = await page.evaluate(
    async ({ b64Str, s }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64Str;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });
      const w = Math.max(1, Math.round(img.naturalWidth * s));
      const h = Math.max(1, Math.round(img.naturalHeight * s));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL("image/webp", 0.92);
    },
    { b64Str: b64, s: scale }
  );
  const comma = webpDataUrl.indexOf(",");
  return Buffer.from(webpDataUrl.slice(comma + 1), "base64");
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await startPreviewServer();
  const executablePath = resolveChromiumExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  const saved = [];

  try {
    for (const theme of ["dark", "light"]) {
      const context = await browser.newContext({
        viewport: { width: 1360, height: 960 },
        deviceScaleFactor: 2,
      });
      await context.addInitScript((t) => {
        localStorage.setItem("pg-theme", t);
      }, theme);
      const page = await context.newPage();

      await page.route("http://127.0.0.1:8000/api/**", async (route) => {
        const url = route.request().url();
        if (url.endsWith("/health")) {
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "healthy" }) });
        }
        if (url.endsWith("/pipelines")) {
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SEED_PIPELINES) });
        }
        if (url.endsWith("/events")) {
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SEED_EVENTS) });
        }
        if (url.endsWith("/runs")) {
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SEED_RUNS) });
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      });

      await page.goto(`${BASE_URL}/app`, { waitUntil: "networkidle" });
      await page.waitForSelector("text=Needs attention", { timeout: 10000 });
      await page.waitForSelector("text=Mean finding risk by date", { timeout: 10000 });
      await page.waitForTimeout(400);

      // Locate the 3 Overview layer elements directly inside <main>
      const main = page.locator("main");
      const panels = [
        { key: "needs-attention", locator: main.locator("> div > div.grid > div").nth(0) },
        { key: "open-now", locator: main.locator("> div > div.grid > div").nth(1) },
        { key: "run-risk", locator: main.locator("> div > div").nth(1) },
      ];

      for (const p of panels) {
        const png2x = await p.locator.screenshot({ type: "png" });
        const webp2x = await pngBufferToWebp(page, png2x, 1);
        const webp1x = await pngBufferToWebp(page, png2x, 0.5);

        const f1x = `${p.key}-${theme}-1x.webp`;
        const f2x = `${p.key}-${theme}-2x.webp`;
        fs.writeFileSync(path.join(OUT_DIR, f1x), webp1x);
        fs.writeFileSync(path.join(OUT_DIR, f2x), webp2x);
        saved.push({ f1x, bytes1x: webp1x.length, f2x, bytes2x: webp2x.length });
      }

      await context.close();
    }

    console.log("CAPTURED_PREVIEW_WEBP:", JSON.stringify(saved, null, 2));
  } finally {
    await browser.close();
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      server.kill("SIGTERM");
    }
  }
}

run().catch((err) => {
  console.error("CAPTURE_FAILED:", err);
  process.exit(1);
});
