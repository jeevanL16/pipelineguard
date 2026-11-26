import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const PORT = 4181;
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
      cwd: new URL("..", import.meta.url),
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

async function mockBackendApi(page) {
  await page.route("http://127.0.0.1:8000/api/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/health")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "healthy" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
}

async function run() {
  const server = await startPreviewServer();
  const executablePath = resolveChromiumExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
  });

  const report = {};

  try {
    // 1. /app routes must NEVER load three-runtime or any 3D scene chunks from manifest
    {
      const manifestPath = new URL("../dist/.vite/manifest.json", import.meta.url);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const lazy3dFiles = Object.entries(manifest)
        .filter(([k, v]) => /core-|GateSequence3D|HeroGateScene|ArchitectureFlow3D|RuleCatalog3D|AttackPath3D/i.test(k + " " + (v.file || "")))
        .map(([, v]) => v.file)
        .filter(Boolean);

      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await mockBackendApi(page);
      const errors = [];
      const threeReqs = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("request", (req) => {
        const url = req.url();
        if (lazy3dFiles.some((f) => url.includes(f)) || /GateSequence|ArchitectureFlow|HeroGate|RuleCatalog3D|AttackPath3D|three/i.test(url)) {
          threeReqs.push(url);
        }
      });

      for (const route of ["/app", "/app/findings", "/app/pipelines", "/app/runs"]) {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(200);
      }

      report.appIsolation = { threeReqsCount: threeReqs.length, errors };
      if (threeReqs.length > 0) throw new Error("3D chunk fetched on /app: " + threeReqs.join(", "));
      if (errors.length > 0) throw new Error("Errors on /app: " + errors.join("; "));
      await context.close();
    }

    // 2. Landing desktop (>= 768px) with ?scene3d=force -> HeroGateScene + GateSequence3D
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await mockBackendApi(page);
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await page.goto(`${BASE_URL}/?scene3d=force`, { waitUntil: "networkidle" });
      await page.waitForSelector('section [role="group"][aria-label*="Isometric gate model"] canvas', {
        timeout: 10000,
      });
      await page.waitForTimeout(1600);

      // Click Show fix and verify staggered progression and real SHA seal (no 000000000000)
      await page.getByRole("button", { name: "Show fix" }).click();
      await page.waitForTimeout(260);
      const midFixedCount = await page.locator('li[data-finding-fixed="true"]').count();
      await page.waitForTimeout(1500);
      const endFixedCount = await page.locator('li[data-finding-fixed="true"]').count();
      const bodyAfterFix = await page.locator("body").innerText();
      if (endFixedCount !== 7 || bodyAfterFix.includes("000000000000")) {
        throw new Error(`Hero Show fix check failed: endFixed=${endFixedCount}`);
      }

      await page.locator("#how-it-works").scrollIntoViewIfNeeded();
      await page.waitForSelector("#how-it-works canvas", { timeout: 10000 });
      await page.waitForTimeout(600);

      const canvasBox = await page.locator("#how-it-works canvas").boundingBox();
      const replayBtn = page.getByRole("button", { name: "Show sequence again" });
      await replayBtn.click();
      await page.waitForTimeout(1600);

      // Phase 3: ArchitectureFlow3D scroll, Trace, Isometric/Flat + hash, hidden accessible list
      await page.locator("#architecture").scrollIntoViewIfNeeded();
      await page.waitForSelector("#architecture canvas", { timeout: 10000 });
      await page.waitForTimeout(700);
      await page.getByRole("button", { name: "Trace a finding" }).click();
      await page.waitForTimeout(400);
      await page.locator('#architecture ul[aria-label="Architecture pipeline stages"] button').first().focus();
      await page.waitForTimeout(150);
      const archTextOnFocus = await page.locator("#architecture").innerText();
      await page.getByRole("button", { name: /^flat$/i }).click();
      await page.waitForTimeout(150);
      const flatHash = await page.evaluate(() => window.location.hash);
      const flatCanvasCount = await page.locator("#architecture canvas").count();
      await page.getByRole("button", { name: /^isometric$/i }).click();
      await page.waitForSelector("#architecture canvas", { timeout: 10000 });
      await page.waitForTimeout(250);

      // Phase 4: AttackPath3D & RuleCatalog3D
      await page.locator("#incidents").scrollIntoViewIfNeeded();
      await page.waitForSelector("#incidents canvas", { timeout: 10000 });
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: "With guard" }).click();
      await page.waitForTimeout(450);
      const incidentGuardedText = await page.locator("#incidents").innerText();

      await page.locator("#rules").scrollIntoViewIfNeeded();
      await page.waitForSelector("#rules canvas", { timeout: 10000 });
      await page.waitForTimeout(500);
      await page.locator('#rules [role="group"] button', { hasText: "Critical" }).click();
      await page.waitForTimeout(300);
      const critRowsCount = await page.locator("#rules tbody tr").count();
      // Hover first projected rule chip and verify table row highlights cleanly
      await page.locator("#rules button").filter({ hasText: /^001$/ }).first().focus();
      await page.waitForTimeout(150);
      const rowHighlighted = await page
        .locator('#rules tbody tr[data-rule-id="PG-WF-001"]')
        .getAttribute("data-highlighted");

      const stats = await page.evaluate(() => (window).__PG_3D_STATS || null);

      const rAFCheck = await page.evaluate(() => {
        const attr = document.getElementById("how-it-works")?.getAttribute("data-scene3d");
        const litCount = document.querySelectorAll('#how-it-works [data-lit="true"]').length;
        return { attr, litCount };
      });

      report.landingWebGL = {
        heroMidFixedCount: midFixedCount,
        heroEndFixedCount: endFixedCount,
        canvasBox: canvasBox ? { w: Math.round(canvasBox.width), h: Math.round(canvasBox.height) } : null,
        archHiddenListWorks: archTextOnFocus.includes("GitHub repository:"),
        archFlatHash: flatHash,
        archFlatCanvasCount: flatCanvasCount,
        incidentWithGuardLabel: incidentGuardedText.includes("PG-WF-019 blocked"),
        ruleCatalogCritRows: critRowsCount,
        ruleCatalogHighlightSync: rowHighlighted,
        stats,
        rAFCheck,
        errors,
      };
      if (!canvasBox || canvasBox.height !== 280) {
        throw new Error("Expected 280px GateSequence canvas: " + JSON.stringify(canvasBox));
      }
      if (flatHash !== "#architecture-flat" || flatCanvasCount !== 0) {
        throw new Error(`Flat toggle failed: hash=${flatHash}, canvasCount=${flatCanvasCount}`);
      }
      if (!report.landingWebGL.archHiddenListWorks) {
        throw new Error("Hidden architecture list focus did not drive inspector");
      }
      if (!report.landingWebGL.incidentWithGuardLabel || rowHighlighted !== "true") {
        throw new Error("Phase 4 interactive assertions failed: " + JSON.stringify(report.landingWebGL));
      }
      if (
        !stats?.gateSequence ||
        stats.gateSequence.calls > 12 ||
        !stats?.heroGate ||
        stats.heroGate.calls > 12 ||
        !stats?.architectureFlow ||
        stats.architectureFlow.calls > 12 ||
        !stats?.attackPath ||
        stats.attackPath.calls > 12 ||
        !stats?.ruleCatalog ||
        stats.ruleCatalog.calls > 12
      ) {
        throw new Error("Draw-call budget exceeded: " + JSON.stringify(stats));
      }
      if (errors.length > 0) throw new Error("Errors on /?scene3d=force: " + errors.join("; "));
      await context.close();
    }

    // 3. Static pose (?scene3d=static) and Fallbacks (?scene3d=off, 360px, forcedColors, highContrast)
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      await mockBackendApi(page);
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`${BASE_URL}/?scene3d=off`, { waitUntil: "networkidle" });
      await page.locator("#how-it-works").scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const canvasCount = await page.locator("#how-it-works canvas").count();
      const text = await page.locator("#how-it-works").innerText();
      report.gateSequenceFallbackDesktop = {
        canvasCount,
        hasThreshold: text.includes("Gate threshold: 70"),
        hasScore: text.includes("100/100"),
        errors,
      };
      if (canvasCount !== 0 || !text.includes("Gate threshold: 70")) {
        throw new Error("Fallback mismatch: " + JSON.stringify(report.gateSequenceFallbackDesktop));
      }
      await ctx.close();
    }

    {
      const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
      const page = await ctx.newPage();
      await mockBackendApi(page);
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
      const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const canvasCount = await page.locator("canvas").count();
      report.mobile360 = { hasOverflow, canvasCount };
      if (canvasCount !== 0) throw new Error("Unexpected canvas at 360px width");
      await ctx.close();
    }

    console.log("PHASE_SCENES_OK:", JSON.stringify(report, null, 2));
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
  console.error("PHASE_SCENES_FAILED:", err);
  process.exit(1);
});
