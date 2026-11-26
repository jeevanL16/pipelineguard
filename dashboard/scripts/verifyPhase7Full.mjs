import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const PORT = 4182;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const MODE = process.argv[2] === "prod" ? "prod" : "e2e";
const SCREENSHOT_DIR =
  process.env.PG_SCREENSHOT_DIR ||
  path.resolve(
    "C:/Users/Jeevan/.gemini/antigravity/brain/a791d69b-6dcf-4c71-b3f3-bf098ce4cbaf/scratch/phase7-visual"
  );

function resolveChromiumExecutable() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const candidates = [
    path.join(localAppData, "ms-playwright", "chromium-1243", "chrome-win64", "chrome.exe"),
    path.join(
      localAppData,
      "ms-playwright",
      "chromium_headless_shell-1243",
      "chrome-headless-shell-win64",
      "chrome-headless-shell.exe"
    ),
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

function loadLazy3dFiles() {
  const manifestPath = new URL("../dist/.vite/manifest.json", import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return Object.entries(manifest)
    .filter(([k, v]) =>
      /core-|GateSequence3D|HeroGateScene|ArchitectureFlow3D|RuleCatalog3D|AttackPath3D|LedgerChain3D/i.test(
        `${k} ${v.file || ""}`
      )
    )
    .map(([, v]) => v.file)
    .filter(Boolean);
}

async function mockBackendApi(page) {
  await page.route("http://127.0.0.1:8000/api/**", async (route) => {
    const url = route.request().url();
    const json = (body) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (url.endsWith("/health")) {
      return json({ status: "healthy", service: "pipelineguard" });
    }
    if (url.endsWith("/test")) {
      return json({ message: "ok", backend: "fastapi" });
    }
    if (url.endsWith("/pipelines")) {
      return json([
        {
          id: 1,
          pipeline_id: "pipe-demo",
          name: "demo-repo",
          repository: "https://github.com/org/demo",
          branch: "main",
          status: "ACTIVE",
          created_at: "2026-11-26T10:00:00Z",
        },
      ]);
    }
    if (url.endsWith("/runs")) {
      return json([
        {
          id: 1,
          run_id: "run-101",
          pipeline_id: 1,
          branch: "main",
          status: "COMPLETED",
          started_at: "2026-11-26T10:01:00Z",
          completed_at: "2026-11-26T10:01:12Z",
          created_at: "2026-11-26T10:01:00Z",
        },
      ]);
    }
    if (url.endsWith("/events")) {
      return json([
        {
          id: 1,
          event_id: "EVT-PG-001",
          pipeline_id: "pipe-demo",
          source: "workflow",
          event_type: "PG-WF-001",
          severity: "CRITICAL",
          risk_score: 95,
          status: "OPEN",
          description: "Untrusted pull_request.title interpolated in run shell.",
          timestamp: "2026-11-26T10:01:05Z",
          created_at: "2026-11-26T10:01:05Z",
        },
        {
          id: 2,
          event_id: "EVT-PG-002",
          pipeline_id: "pipe-demo",
          source: "secrets",
          event_type: "private-key",
          severity: "HIGH",
          risk_score: 82,
          status: "OPEN",
          description: "Masked credential detected in workflow environment.",
          timestamp: "2026-11-26T10:01:06Z",
          created_at: "2026-11-26T10:01:06Z",
        },
      ]);
    }
    if (url.endsWith("/audit-logs")) {
      return json([
        {
          id: 1,
          event_id: "EVT-PG-001",
          previous_status: null,
          new_status: "OPEN",
          actor: "scanner",
          changed_at: "2026-11-26T10:01:06Z",
        },
      ]);
    }
    return json([]);
  });
}

function attachConsoleAndReqListeners(page, lazy3dFiles, errors, threeReqs) {
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e)}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  if (threeReqs) {
    page.on("request", (req) => {
      const url = req.url();
      if (
        lazy3dFiles.some((f) => url.includes(f)) ||
        /GateSequence|ArchitectureFlow|HeroGate|RuleCatalog3D|AttackPath3D|LedgerChain3D/i.test(url)
      ) {
        threeReqs.push(url);
      }
    });
  }
}

async function installWebGLDrawProbe(context) {
  await context.addInitScript(() => {
    window.__pgWebglClears = 0;
    window.__pgWebglDraws = 0;
    const patchProto = (proto) => {
      if (!proto || proto.__pgPatched) return;
      proto.__pgPatched = true;
      const origClear = proto.clear;
      if (origClear) {
        proto.clear = function (...args) {
          window.__pgWebglClears = (window.__pgWebglClears || 0) + 1;
          return origClear.apply(this, args);
        };
      }
      for (const fn of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
        const orig = proto[fn];
        if (!orig) continue;
        proto[fn] = function (...args) {
          window.__pgWebglDraws = (window.__pgWebglDraws || 0) + 1;
          return orig.apply(this, args);
        };
      }
    };
    patchProto(window.WebGLRenderingContext?.prototype);
    patchProto(window.WebGL2RenderingContext?.prototype);
  });
}

async function assert5sIdleZeroFrames(page, label) {
  const before = await page.evaluate(() => ({
    clears: window.__pgWebglClears || 0,
    draws: window.__pgWebglDraws || 0,
  }));
  await page.waitForTimeout(5100);
  const after = await page.evaluate(() => ({
    clears: window.__pgWebglClears || 0,
    draws: window.__pgWebglDraws || 0,
  }));
  const deltaClears = after.clears - before.clears;
  const deltaDraws = after.draws - before.draws;
  if (deltaClears !== 0 || deltaDraws !== 0) {
    throw new Error(
      `Idle GPU frame violation (${label}): deltaClears=${deltaClears}, deltaDraws=${deltaDraws}`
    );
  }
  return { clearsBefore: before.clears, drawsBefore: before.draws, deltaClears, deltaDraws };
}

async function comparePngDiffRatio(page, bufA, bufB) {
  const b64A = bufA.toString("base64");
  const b64B = bufB.toString("base64");
  return page.evaluate(
    async ({ a, b }) => {
      const load = (b64) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = `data:image/png;base64,${b64}`;
        });
      const [imgA, imgB] = await Promise.all([load(a), load(b)]);
      if (imgA.width !== imgB.width || imgA.height !== imgB.height) return 1;
      const w = imgA.width;
      const h = imgA.height;
      const cA = document.createElement("canvas");
      cA.width = w;
      cA.height = h;
      const cB = document.createElement("canvas");
      cB.width = w;
      cB.height = h;
      const ctxA = cA.getContext("2d");
      const ctxB = cB.getContext("2d");
      ctxA.drawImage(imgA, 0, 0);
      ctxB.drawImage(imgB, 0, 0);
      const dA = ctxA.getImageData(0, 0, w, h).data;
      const dB = ctxB.getImageData(0, 0, w, h).data;
      let diffPixels = 0;
      const totalPixels = w * h;
      for (let i = 0; i < dA.length; i += 4) {
        const dr = Math.abs(dA[i] - dB[i]);
        const dg = Math.abs(dA[i + 1] - dB[i + 1]);
        const db = Math.abs(dA[i + 2] - dB[i + 2]);
        if (dr > 6 || dg > 6 || db > 6) diffPixels++;
      }
      return diffPixels / totalPixels;
    },
    { a: b64A, b: b64B }
  );
}

async function runProdChecks(browser, lazy3dFiles) {
  const report = { mode: "prod" };
  const appRoutes = [
    "/app",
    "/app/findings",
    "/app/incidents",
    "/app/workflows",
    "/app/secrets",
    "/app/artifacts",
    "/app/pipelines",
    "/app/runs",
    "/app/audit",
    "/app/settings",
  ];

  // 1. Production must ignore ?scene3d=force when WebGL reports failIfMajorPerformanceCaveat: true
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => {
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, attrs) {
        if ((type === "webgl2" || type === "webgl") && attrs?.failIfMajorPerformanceCaveat) {
          return null;
        }
        return origGetContext.call(this, type, attrs);
      };
    });
    const page = await ctx.newPage();
    await mockBackendApi(page);
    const errors = [];
    attachConsoleAndReqListeners(page, lazy3dFiles, errors, null);
    await page.goto(`${BASE_URL}/?scene3d=force`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1900);
    const canvasCount = await page.locator("canvas").count();
    report.prodForceIgnored = { canvasCount, errors };
    if (canvasCount !== 0 || errors.length > 0) {
      throw new Error(`Prod force-ignore check failed: ${JSON.stringify(report.prodForceIgnored)}`);
    }
    await ctx.close();
  }

  // 2. All /app/* routes + Landing / across Dark and Light: zero console errors & 3D bundle isolation
  for (const theme of ["dark", "light"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((t) => {
      localStorage.setItem("pg-theme", t);
    }, theme);
    const page = await ctx.newPage();
    await mockBackendApi(page);
    const errors = [];
    const threeReqs = [];
    attachConsoleAndReqListeners(page, lazy3dFiles, errors, threeReqs);

    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const landingErrors = [...errors];
    errors.length = 0;
    threeReqs.length = 0;

    for (const r of appRoutes) {
      await page.goto(`${BASE_URL}${r}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(200);
    }

    report[`prod_${theme}`] = {
      landingErrorsCount: landingErrors.length,
      appErrorsCount: errors.length,
      appThreeReqsCount: threeReqs.length,
    };
    if (landingErrors.length > 0 || errors.length > 0 || threeReqs.length > 0) {
      throw new Error(
        `Prod ${theme} check failed: ${JSON.stringify({ landingErrors, errors, threeReqs })}`
      );
    }
    await ctx.close();
  }

  console.log("PHASE7_PROD_OK:", JSON.stringify(report, null, 2));
}

async function runE2eChecks(browser, executablePath, lazy3dFiles) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const report = { mode: "e2e" };

  // 1. Desktop 1440 WebGL + 5s Idle Checks + Keyboard Operability + /app/artifacts lazy ledger
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await installWebGLDrawProbe(ctx);
    const page = await ctx.newPage();
    await mockBackendApi(page);
    const errors = [];
    attachConsoleAndReqListeners(page, lazy3dFiles, errors, null);

    await page.goto(`${BASE_URL}/?scene3d=force`, { waitUntil: "networkidle" });
    await page.waitForSelector('section [role="group"][aria-label*="Isometric gate model"] canvas', {
      timeout: 10000,
    });
    await page.waitForTimeout(2000);

    // Idle check #1: Hero settled for 5s
    const heroIdle = await assert5sIdleZeroFrames(page, "HeroGateScene");

    // Keyboard operability: Show fix via focus + Enter
    const showFixBtn = page.getByRole("button", { name: "Show fix" });
    await showFixBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1800);
    const heroFixed = await page.locator('li[data-finding-fixed="true"]').count();
    const bodyText = await page.locator("body").innerText();
    if (heroFixed !== 7 || bodyText.includes("000000000000")) {
      throw new Error(`Keyboard Hero Show fix failed: fixed=${heroFixed}`);
    }

    // HowItWorks: scroll + keyboard replay
    await page.locator("#how-it-works").scrollIntoViewIfNeeded();
    await page.waitForSelector("#how-it-works canvas", { timeout: 10000 });
    await page.waitForTimeout(700);
    const replayBtn = page.getByRole("button", { name: "Show sequence again" });
    await replayBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1700);

    // Architecture: keyboard "Trace a finding", hidden sr-only list focus, keyboard "Flat"/"Isometric"
    await page.locator("#architecture").scrollIntoViewIfNeeded();
    await page.waitForSelector("#architecture canvas", { timeout: 10000 });
    await page.waitForTimeout(700);
    const traceBtn = page.getByRole("button", { name: "Trace a finding" });
    await traceBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(450);
    await page
      .locator('#architecture ul[aria-label="Architecture pipeline stages"] button')
      .nth(2)
      .focus();
    await page.waitForTimeout(150);
    const archListInspectorText = await page.locator("#architecture").innerText();

    const flatBtn = page.getByRole("button", { name: /^flat$/i });
    await flatBtn.focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);
    const flatCanvasCount = await page.locator("#architecture canvas").count();
    const isoBtn = page.getByRole("button", { name: /^isometric$/i });
    await isoBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector("#architecture canvas", { timeout: 10000 });
    await page.waitForTimeout(450);

    // IncidentTabs: keyboard "With guard"
    await page.locator("#incidents").scrollIntoViewIfNeeded();
    await page.waitForSelector("#incidents canvas", { timeout: 10000 });
    await page.waitForTimeout(550);
    const withGuardBtn = page.getByRole("button", { name: "With guard" });
    await withGuardBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const withGuardText = await page.locator("#incidents").innerText();

    // RulesCatalog: keyboard Critical filter + chip focus highlights table row
    await page.locator("#rules").scrollIntoViewIfNeeded();
    await page.waitForSelector("#rules canvas", { timeout: 10000 });
    await page.waitForTimeout(600);
    const critChip = page.locator('#rules [role="group"] button', { hasText: "Critical" });
    await critChip.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const critCount = await page.locator("#rules tbody tr").count();
    await page.locator("#rules button").filter({ hasText: /^001$/ }).first().focus();
    await page.waitForTimeout(150);
    const ruleHighlight = await page
      .locator('#rules tbody tr[data-rule-id="PG-WF-001"]')
      .getAttribute("data-highlighted");

    // Idle check #2: settled lower landing sections for 5s
    await page.waitForTimeout(1000);
    const lowerIdle = await assert5sIdleZeroFrames(page, "LandingLowerScenes");

    // DashboardPreview3D screenshots & images check
    const previewHeading = page.getByRole("heading", { name: "Built for daily triage" });
    await previewHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const allImgsOk = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"));
      return imgs.every((img) => img.complete && img.naturalWidth > 0);
    });

    const stats = await page.evaluate(() => window.__PG_3D_STATS || null);

    report.webglAndIdle = {
      heroIdle,
      lowerIdle,
      heroFixed,
      archHiddenListWorks: archListInspectorText.length > 0,
      flatCanvasCount,
      incidentBlocked: withGuardText.includes("PG-WF-019 blocked"),
      critCount,
      ruleHighlight,
      allImgsOk,
      stats,
      errors,
    };

    if (
      flatCanvasCount !== 0 ||
      !report.webglAndIdle.incidentBlocked ||
      ruleHighlight !== "true" ||
      !allImgsOk ||
      errors.length > 0
    ) {
      throw new Error(`E2E WebGL/Idle assertions failed: ${JSON.stringify(report.webglAndIdle)}`);
    }
    await ctx.close();
  }

  // 1b. Fresh-context /app/artifacts lazy LedgerChain3D (0 3D requests pre-digest) + 5s idle check
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await installWebGLDrawProbe(ctx);
    const page = await ctx.newPage();
    await mockBackendApi(page);
    const errors = [];
    const artThreeReqs = [];
    attachConsoleAndReqListeners(page, lazy3dFiles, errors, artThreeReqs);
    await page.goto(`${BASE_URL}/app/artifacts?scene3d=force`, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    const preDigestThreeCount = artThreeReqs.length;
    await page.getByRole("button", { name: "Compute hash from input" }).click();
    await page.getByRole("button", { name: "Verify digest" }).click();
    await page.waitForSelector('main [role="group"][aria-label*="Artifact digest chain"] canvas', {
      timeout: 10000,
    });
    await page.waitForTimeout(1100);
    const artifactIdle = await assert5sIdleZeroFrames(page, "LedgerArtifactScene3D");
    const ledgerStats = await page.evaluate(() => window.__PG_3D_STATS?.ledgerArtifact || null);
    report.artifactsLedger = {
      preDigestThreeCount,
      postDigestThreeCount: artThreeReqs.length,
      artifactIdle,
      ledgerStats,
      errors,
    };
    if (preDigestThreeCount !== 0 || artThreeReqs.length === 0 || !ledgerStats || errors.length > 0) {
      throw new Error(`Artifacts lazy LedgerChain3D failed: ${JSON.stringify(report.artifactsLedger)}`);
    }
    await ctx.close();
  }

  // 2. Deterministic Static Pose Visual Regression (Dark/Light x 1440/768, DPR 1)
  const visualMatrix = [
    { theme: "dark", width: 1440, height: 900 },
    { theme: "light", width: 1440, height: 900 },
    { theme: "dark", width: 768, height: 1024 },
    { theme: "light", width: 768, height: 1024 },
  ];
  report.visualRegression = {};
  let baselineArchBuf = null;
  let baselineRulesBuf = null;

  for (const cfg of visualMatrix) {
    const key = `${cfg.theme}_${cfg.width}`;
    const ctx = await browser.newContext({
      viewport: { width: cfg.width, height: cfg.height },
      deviceScaleFactor: 1,
    });
    await ctx.addInitScript((t) => {
      localStorage.setItem("pg-theme", t);
    }, cfg.theme);
    const page = await ctx.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockBackendApi(page);
    const errors = [];
    attachConsoleAndReqListeners(page, lazy3dFiles, errors, null);

    await page.goto(`${BASE_URL}/?scene3d=force`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    const heroShot = await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `landing-${key}-hero.png`),
    });
    await page.locator("#architecture").scrollIntoViewIfNeeded();
    await page.waitForSelector("#architecture canvas", { timeout: 10000 });
    await page.waitForTimeout(300);
    const archBuf = await page.locator("#architecture").screenshot({
      path: path.join(SCREENSHOT_DIR, `landing-${key}-arch.png`),
    });
    await page.locator("#rules").scrollIntoViewIfNeeded();
    await page.waitForSelector("#rules canvas", { timeout: 10000 });
    await page.waitForTimeout(300);
    const rulesBuf = await page.locator("#rules").screenshot({
      path: path.join(SCREENSHOT_DIR, `landing-${key}-rules.png`),
    });

    if (cfg.theme === "dark" && cfg.width === 1440) {
      baselineArchBuf = archBuf;
      baselineRulesBuf = rulesBuf;
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    const imgsOk = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img")).every((img) => img.complete && img.naturalWidth > 0)
    );
    report.visualRegression[key] = {
      heroBytes: heroShot.length,
      archBytes: archBuf.length,
      rulesBytes: rulesBuf.length,
      overflow,
      imgsOk,
      errorsCount: errors.length,
    };
    if (overflow || !imgsOk || errors.length > 0) {
      throw new Error(`Visual regression check failed for ${key}: ${JSON.stringify(errors)}`);
    }
    await ctx.close();
  }

  // Repeat-render determinism check for Dark 1440 static pose
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => {
      localStorage.setItem("pg-theme", "dark");
    });
    const page = await ctx.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockBackendApi(page);
    await page.goto(`${BASE_URL}/?scene3d=force`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.locator("#architecture").scrollIntoViewIfNeeded();
    await page.waitForSelector("#architecture canvas", { timeout: 10000 });
    await page.waitForTimeout(300);
    const repeatArch = await page.locator("#architecture").screenshot();
    await page.locator("#rules").scrollIntoViewIfNeeded();
    await page.waitForSelector("#rules canvas", { timeout: 10000 });
    await page.waitForTimeout(300);
    const repeatRules = await page.locator("#rules").screenshot();

    const archDiff = await comparePngDiffRatio(page, baselineArchBuf, repeatArch);
    const rulesDiff = await comparePngDiffRatio(page, baselineRulesBuf, repeatRules);
    report.staticDeterminism = { archDiff, rulesDiff };
    if (archDiff > 0.005 || rulesDiff > 0.005) {
      throw new Error(`Static pose non-deterministic: ${JSON.stringify(report.staticDeterminism)}`);
    }
    await ctx.close();
  }

  // 3. Fallback Matrix (9.3): --disable-gpu, forced-colors, prefers-contrast: more, reduced-motion, saveData, 360px
  {
    const noGpuBrowser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ["--disable-gpu", "--disable-webgl", "--disable-webgl2"],
    });
    try {
      const ctx = await noGpuBrowser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await mockBackendApi(page);
      const errors = [];
      attachConsoleAndReqListeners(page, lazy3dFiles, errors, null);
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
      await page.locator("#how-it-works").scrollIntoViewIfNeeded();
      await page.locator("#architecture").scrollIntoViewIfNeeded();
      await page.locator("#incidents").scrollIntoViewIfNeeded();
      await page.locator("#rules").scrollIntoViewIfNeeded();
      const canvasCount = await page.locator("canvas").count();
      const body = await page.locator("body").innerText();
      report.fallbackDisableGpu = {
        canvasCount,
        hasThreshold: body.includes("Gate threshold: 70"),
        hasRules: body.includes("PG-WF-001"),
        errors,
      };
      if (canvasCount !== 0 || !body.includes("Gate threshold: 70") || errors.length > 0) {
        throw new Error(`--disable-gpu fallback failed: ${JSON.stringify(report.fallbackDisableGpu)}`);
      }
      await ctx.close();
    } finally {
      await noGpuBrowser.close();
    }
  }

  const fallbackModes = [
    { name: "forcedColors", opts: { forcedColors: "active" }, media: { forcedColors: "active" }, requireZeroCanvas: true },
    { name: "contrastMore", opts: {}, media: { contrast: "more" }, requireZeroCanvas: true },
    { name: "reducedMotionStaticOrFallback", opts: {}, media: { reducedMotion: "reduce" }, requireZeroCanvas: false },
    { name: "saveData", opts: {}, saveData: true, requireZeroCanvas: true },
    { name: "queryOff", opts: {}, url: `${BASE_URL}/?scene3d=off`, requireZeroCanvas: true },
  ];
  report.fallbackModes = {};
  for (const fm of fallbackModes) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...fm.opts });
    if (fm.saveData) {
      await ctx.addInitScript(() => {
        Object.defineProperty(navigator, "connection", {
          configurable: true,
          value: { saveData: true },
        });
      });
    }
    const page = await ctx.newPage();
    if (fm.media) await page.emulateMedia(fm.media);
    await mockBackendApi(page);
    const errors = [];
    attachConsoleAndReqListeners(page, lazy3dFiles, errors, null);
    await page.goto(fm.url || `${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.locator("#how-it-works").scrollIntoViewIfNeeded();
    await page.locator("#rules").scrollIntoViewIfNeeded();
    const canvasCount = await page.locator("canvas").count();
    const howItWorksMode = await page.locator("#how-it-works").getAttribute("data-scene3d");
    const body = await page.locator("body").innerText();
    report.fallbackModes[fm.name] = {
      canvasCount,
      howItWorksMode,
      hasThreshold: body.includes("Gate threshold: 70"),
      errorsCount: errors.length,
    };
    if (
      (fm.requireZeroCanvas && canvasCount !== 0) ||
      (!fm.requireZeroCanvas && howItWorksMode === "webgl") ||
      !body.includes("Gate threshold: 70") ||
      errors.length > 0
    ) {
      throw new Error(
        `Fallback/degrade mode ${fm.name} failed: ${JSON.stringify({ mode: report.fallbackModes[fm.name], errors })}`
      );
    }
    await ctx.close();
  }

  // 4. 360px Mobile Overflow Check across / and /app routes
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const page = await ctx.newPage();
    await mockBackendApi(page);
    const errors = [];
    attachConsoleAndReqListeners(page, lazy3dFiles, errors, null);
    const mobileRoutes = ["/", "/app", "/app/findings", "/app/artifacts", "/app/pipelines"];
    report.mobile360 = {};
    for (const r of mobileRoutes) {
      await page.goto(`${BASE_URL}${r}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      const canvasCount = await page.locator("canvas").count();
      report.mobile360[r] = { overflow, canvasCount };
      if (overflow || canvasCount !== 0) {
        throw new Error(`360px overflow or canvas on ${r}: ${JSON.stringify(report.mobile360[r])}`);
      }
    }
    if (errors.length > 0) throw new Error(`360px console errors: ${errors.join("; ")}`);
    await ctx.close();
  }

  console.log("PHASE7_E2E_OK:", JSON.stringify(report, null, 2));
}

async function main() {
  const server = await startPreviewServer();
  const executablePath = resolveChromiumExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
  });
  const lazy3dFiles = loadLazy3dFiles();

  try {
    if (MODE === "prod") {
      await runProdChecks(browser, lazy3dFiles);
    } else {
      await runE2eChecks(browser, executablePath, lazy3dFiles);
    }
  } finally {
    await browser.close();
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      server.kill("SIGTERM");
    }
  }
}

main().catch((err) => {
  console.error(`PHASE7_${MODE.toUpperCase()}_FAILED:`, err);
  process.exit(1);
});
