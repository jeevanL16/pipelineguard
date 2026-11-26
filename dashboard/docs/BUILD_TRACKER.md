# PipelineGuard Frontend Build Tracker

> Source of truth: [DESIGN.md](../../DESIGN.md) and [GATEHOUSE_3D_LAYER_SPEC.md](../../GATEHOUSE_3D_LAYER_SPEC.md).

## 1. Status Table

| Phase | Status | Started | Finished | Commit |
| --- | --- | --- | --- | --- |
| Phase A — Audit vs DESIGN.md | Done | 2026-11-26 | 2026-11-26 | c594051 |
| Phase B — Fix DESIGN.md Gaps | Done | 2026-11-26 | 2026-11-26 | 9173133 |
| 3D Phase 0 — Toolchain, Bundle & Assets | Done | 2026-11-26 | 2026-11-26 | 6d3b8b9 |
| 3D Phase 1 — GateSequence3D | Done | 2026-11-26 | 2026-11-26 | 336ab60 |
| 3D Phase 2 — HeroGateScene | Done | 2026-11-26 | 2026-11-26 | bb36b2e |
| 3D Phase 3 — ArchitectureFlow3D | Done | 2026-11-26 | 2026-11-26 | 7295ec2 |
| 3D Phase 4 — RuleCatalog3D & AttackPath3D | Done | 2026-11-26 | 2026-11-26 | fab9f6c |
| 3D Phase 5 — DashboardPreview3D (CSS) | Done | 2026-11-26 | 2026-11-26 | 150b3e1 |
| 3D Phase 6 — LedgerChain3D (Artifacts) | Done | 2026-11-26 | 2026-11-26 | 50c8254 |
| 3D Phase 7 — Verification & Docs | Done | 2026-11-26 | 2026-11-26 | pending commit |

## 2. Per-Phase Log

### Phase A — Audit vs `DESIGN.md`

- **Goal:** Compare the existing frontend (`dashboard/src/`, `dashboard/index.html`, `dashboard/eslint.config.js`, `dashboard/vite.config.js`) against `DESIGN.md` across tokens, typography/fonts, shape, motion rules, copy/terminology, data honesty, forms, landing structure, and architecture, without making any source code changes.
- **Files changed:** `dashboard/docs/BUILD_TRACKER.md` only (zero application code edits in Phase A).
- **Baseline commands run (PASS / FAIL):**
  - `cd d:\pipelineguard\dashboard; npx tsc --noEmit` -> **PASS** (`exit 0`)
  - `cd d:\pipelineguard\dashboard; npm run lint` -> **PASS** (`exit 0`; note gap A15 below: `eslint.config.js` only globs `**/*.{js,jsx}`)
  - `cd d:\pipelineguard\dashboard; npm run build` -> **PASS** (`exit 0`, Vite v8.3.1, 3267 modules, `LandingPage` 95.64 kB / 27.08 kB gz, `OverviewPage` 364.72 kB / 105.54 kB gz, `index` 266.03 kB / 84.59 kB gz)
  - `cd d:\pipelineguard\dashboard; npx --yes esbuild scripts\verifyRules.ts --bundle --platform=node --format=esm | node --input-type=module -` -> **PASS** (`exit 0`, `ALL RULE ENGINE FIXTURE TESTS PASSED`, hero broken 7 findings, hero fixed 0 findings / score 0 grade A)
  - `cd d:\pipelineguard; git diff --stat -- backend security` -> **PASS** (empty, `exit 0`)
  - `cd d:\pipelineguard; npx --yes --package=@google/design.md designmd lint DESIGN.md` -> **PASS** (`exit 0`, `0 errors, 25 warnings, 1 info`; see Assumptions for bare `npx @google/design.md` exit 1 note)
- **Measurements:**
  - `dist/index.html`: 1.90 kB (0.80 kB gz)
  - `dist/assets/index-*.css`: 36.22 kB (7.75 kB gz)
  - `dist/assets/LandingPage-*.js`: 95.64 kB (27.08 kB gz)
  - `dist/assets/OverviewPage-*.js`: 364.72 kB (105.54 kB gz)
  - Static source audit: 0 raw hex occurrences outside `src/styles/tokens.css`, 0 `backdrop-blur` / `radial-gradient` / `bg-gradient` / `text-shadow` / `animate-pulse` / `animate-bounce` / `transition-all`.
- **Audit Findings (Gaps vs `DESIGN.md` and Constraints):**
  1. **A1 (Typography tokens `-sm` parity):** `DESIGN.md` defines `display-xl-sm`, `display-lg-sm`, and `headline-lg-sm` as top-level typography tokens, whereas `src/styles/tokens.css` only implements responsive `.pg-display-xl`, `.pg-display-lg`, `.pg-headline-lg` via `@media (min-width: 640px)` and lacks explicit `.pg-display-xl-sm`, `.pg-display-lg-sm`, `.pg-headline-lg-sm` utility classes.
  2. **A2 (Font loading & preload):** `dashboard/index.html` loads Google Fonts CDN CSS with no `<link rel="preload" as="font">` or self-hosted WOFF2 subsets (`Instrument Sans` weights 400 and 600). Relying exclusively on third-party CSS risks offline font failure and layout shift.
  3. **A3 (Non-spec border radii):** Intermediate radii `rounded-[6px]` and `rounded-[10px]` appear in `DashboardPreviewSection.tsx`, `FindingsTable.tsx`, `ThemeSwitch.tsx`, and `HeroScanDemo.tsx` instead of `DESIGN.md` radii (`0px`, `4px`, `8px`, `14px`, `9999px`).
  4. **A4 (Landing header height, opacity & 360px mobile access):** `LandingNav.tsx` uses `h-14` (56px) and `bg-[var(--pg-canvas)]/95` instead of solid `64px` (`h-16`), and hides both `ThemeSwitch` (`hidden sm:block`) and the `Connect repository` button below 640px. `TopBar.tsx` similarly hides both backend connection status (`hidden sm:inline-flex`) and `ThemeSwitch` (`hidden lg:block`) below 640px.
  5. **A5 (Motion — reduced-motion on spinners):** `ConnectRepositoryForm.tsx:332` and `TopBar.tsx:108` apply `animate-spin` unconditionally without `motion-safe:` gating.
  6. **A6 (Motion — non-token transition timings):** `FaqSection.tsx:40` uses `duration-150`, and `Tabs.tsx:86` / `DashboardShell.tsx:275` use `duration-200 ease-out` instead of `--pg-motion-state-change` (`120ms cubic-bezier(0,0,0.2,1)`) and `--pg-motion-view-change` (`200ms ease-in-out`).
  7. **A7 (No fake data — `OverviewPage` chart synthetic points):** `OverviewPage.tsx:101-109` & `300-308` constructs synthetic `basePoints` prior to `"Today"` in `"Run risk, last 14 days"`; chart points must derive strictly from real backend event/run dates or display actual single-day / empty state.
  8. **A8 (No fake data — `DashboardPreviewSection` hardcoded items):** `DashboardPreviewSection.tsx:76-93,100-121` hardcodes fabricated pipeline IDs (`pipe-auth-service`, `pipe-payments-api`), `EVT-PG-001`, `EVT-PG-004`, and `issue.body` instead of deriving rule IDs, severities, and sample snippets directly from `rules/*` (`analyzeWorkflowText` / `WORKFLOW_RULES` / `HERO_BROKEN_WORKFLOW`).
  9. **A9 (No fake data — `sha256Hex` zero fallback):** `HeroScanDemo.tsx:20-28` returns `"000000000000"` when `crypto.subtle` is absent instead of surfacing unavailable Web Crypto state without fabricating a digest. Also lines 233–238 flip all 7 findings simultaneously to `"Fixed"` using only CSS `transitionDelay` (`45ms`).
  10. **A10 (Copy & terminology):** `FaqSection.tsx:11` uses the banned word `"hero"` (`"The hero demo"`). `PipelinesPage.tsx:113` labels active pipelines `"Protected"` rather than `"Active"`. `RulesCatalogSection.tsx:34` assumes `WORKFLOW_RULES.length - 1` rather than counting active rules dynamically.
  11. **A11 (Playground flagged-line highlighting):** `PlaygroundSection.tsx` runs real analysis via Web Worker but does not mark/highlight flagged line numbers alongside the editor yet.
  12. **A12 (Forms — Settings auth field validation & step label):** `SettingsPage.tsx:208-225` does not surface field-level `error` / `aria-invalid` props on `Username` and `Password` fields when empty, nor move focus on error. `ConnectRepositoryForm.tsx:453-460` keeps primary CTA text `"Connect repository"` even when `revealedFields === false` (when submitting performs metadata resolution rather than saving), and `ConnectRepositoryDialog.tsx:31` uses blocking `window.confirm`.
  13. **A13 (Keyboard row navigation in `FindingsTable`):** `FindingsTable.tsx:390` relies on `<tr onClick>` and global `j`/`k`/`Enter` shortcuts without a focusable button or row trigger inside cells for `Tab` users.
  14. **A14 (ESLint TS/TSX coverage):** `dashboard/eslint.config.js` sets `files: ['**/*.{js,jsx}']`, skipping all `.ts`/`.tsx` files.
- **Deviations from spec:** Spec paths `dashboard/design/*` are actually at repo root (`DESIGN.md`, `GATEHOUSE_3D_LAYER_SPEC.md`).
- **Open questions:** None — all paths and tooling verified cleanly.

### Phase B — Fix `DESIGN.md` Gaps

- **Goal:** Fix audit findings A1–A13 in `dashboard/` cleanly without altering backend/security/API contracts or breaking `DESIGN.md` lint.
- **Files changed:**
  - `dashboard/index.html`, `dashboard/public/fonts/*.woff2`, `dashboard/src/styles/tokens.css` (self-hosted Latin WOFF2 `Instrument Sans` 400/500/600 & `JetBrains Mono` 400/500; WOFF2 `<link rel="preload">` for weights 400 & 600 totaling 34.3 kB; added explicit `.pg-display-xl-sm`, `.pg-display-lg-sm`, `.pg-headline-lg-sm` classes matching `DESIGN.md`).
  - `dashboard/src/features/landing/components/LandingNav.tsx` (`h-16` 64px solid canvas bar, compact `ThemeSwitch` kept accessible on 360px mobile).
  - `dashboard/src/features/shell/{TopBar,DashboardShell,ThemeSwitch}.tsx` (reduced-motion safe `motion-safe:animate-spin`, mobile-visible status indicator & nav drawer `ThemeSwitch`, normalized `rounded-[4px]`, token transition `--pg-motion-view-change`).
  - `dashboard/src/ui/Tabs.tsx` & `dashboard/src/features/landing/components/FaqSection.tsx` (motion token alignment, reduced-motion guard, removed `"hero"` wording -> `"live scan demo"`).
  - `dashboard/src/features/overview/OverviewPage.tsx` (removed synthetic `basePoints`; chart now aggregates real recorded event dates or renders empty state).
  - `dashboard/src/features/landing/components/DashboardPreviewSection.tsx` (replaced mock IDs/records with deterministic `analyzeWorkflowText(HERO_BROKEN_WORKFLOW)` output and normalized radii to 4px/8px).
  - `dashboard/src/features/landing/components/HeroScanDemo.tsx` (removed `"000000000000"` digest fallback, sequential `fixedCount` progression during rescanning).
  - `dashboard/src/features/landing/components/PlaygroundSection.tsx` (severity-tinted flagged line markers and focused-line highlight in synchronized gutter).
  - `dashboard/src/features/landing/components/RulesCatalogSection.tsx` (dynamic active rule count) & `dashboard/src/features/pipelines/PipelinesPage.tsx` (`Active` instead of `Protected` status label).
  - `dashboard/src/features/pipelines/components/{ConnectRepositoryForm,ConnectRepositoryDialog}.tsx` (`motion-safe:animate-spin`, honest step CTA `Check repository` -> `Connect repository`, inline discard banner replacing native `window.confirm`).
  - `dashboard/src/features/settings/SettingsPage.tsx` (per-field `error` / `aria-invalid` validation & invalid input focus) & `dashboard/src/features/findings/components/FindingsTable.tsx` (normalized radius + `tabIndex={0}` / `Enter` / `Space` keyboard row activation).
- **Commands run (PASS / FAIL):**
  - `cd d:\pipelineguard\dashboard; npx tsc --noEmit` -> **PASS** (`TSC=0`)
  - `cd d:\pipelineguard\dashboard; npm run lint` -> **PASS** (`LINT=0`)
  - `cd d:\pipelineguard\dashboard; npm run build` -> **PASS** (`BUILD=0`, 3267 modules, 1.40s; `LandingPage` 96.23 kB / 27.39 kB gz, `OverviewPage` 365.24 kB / 105.73 kB gz, `index` 266.03 kB / 84.59 kB gz, `index.css` 40.24 kB / 8.30 kB gz)
  - `cd d:\pipelineguard\dashboard; npx --yes esbuild scripts\verifyRules.ts --bundle --platform=node --format=esm | node --input-type=module -` -> **PASS** (`VERIFY_RULES=0`, `ALL RULE ENGINE FIXTURE TESTS PASSED`)
  - Static Gatehouse compliance check (banned styles, unsafe `animate-spin`, non-spec radii, `"hero"` copy) -> **PASS** (`SCAN_DONE`, 0 hits)
  - `cd d:\pipelineguard; git diff --stat -- backend security` -> **PASS** (empty, `BACKEND_SEC=0`)
  - `cd d:\pipelineguard; npx --yes --package=@google/design.md designmd lint DESIGN.md` -> **PASS** (`DESIGN_LINT=0`, `0 errors, 25 warnings, 1 info`)
- **Measurements:** Preloaded primary WOFF2 font weights 400 (16,860 B) + 600 (17,408 B) = 34,268 B (within DESIGN.md ~40 KB target). Landing chunk gzip: 27.39 kB.
- **Deviations from spec:** Gap A14 (`eslint.config.js` TS/TSX coverage) deferred cleanly: `typescript-eslint@8.74.0` peer dependency is `typescript <6.1.0` whereas this repo uses `typescript@7.0.2`, so strict type/hygiene checking remains enforced by `tsc --noEmit` (`typescript@7.0.2`).
- **Open questions:** None.

### 3D Phase 0 — Toolchain, Bundle & Core Primitives

- **Goal:** Install exact React 19.3-compatible 3D dependencies (`three@0.187.0`, `@types/three@0.187.0`, `@react-three/fiber@9.8.2`, `@react-three/drei@10.7.9`), configure Vite `build.manifest: true`, implement `src/three/core/*` and shared severity glyphs, verify lazy 3D chunk isolation and real gzipped size (<300 KB stop gate), verify live WebGL Canvas + all 2D fallbacks in Chromium with zero console errors, then remove the throwaway smoke route.
- **Files changed:**
  - `dashboard/package.json`, `dashboard/package-lock.json` (pinned `three@0.187.0`, `@types/three@0.187.0`, `@react-three/fiber@9.8.2`, `@react-three/drei@10.7.9`; added `vitest@5.1.2`, `playwright@1.65.1`, `"test": "vitest run"`).
  - `dashboard/vite.config.js` (added `build: { manifest: true }`).
  - `dashboard/src/three/core/{liveCanvasBudget.ts,motion3d.ts,useScene3DMode.ts,useSectionProgress.ts,useGatehouseTheme.ts,shading.ts,glyphs.tsx,useInvalidateWhile.ts,useProjectedAnchors.ts,Scene3D.tsx,index.ts}`.
  - `dashboard/src/three/core/__tests__/core.test.ts` (5 unit tests covering `MAX_LIVE_CANVASES=3`, played registry, scroll math, `STAGE_AT`/`stageLit`, and 3-face shading).
  - `dashboard/scripts/checkManifest3D.mjs` (bundle manifest isolation & 300 KB gzip gate assertion).
- **Commands run (PASS / FAIL):**
  - **Smoke build (with temporary lazy `/__smoke3d` route):**
    - `cd d:\pipelineguard\dashboard; npx vitest run` -> **PASS** (`VITEST=0`, 5/5 tests)
    - `cd d:\pipelineguard\dashboard; npm run build; node scripts\checkManifest3D.mjs` -> **PASS** (`BUILD=0`, `MANIFEST=0`, `isolationPassed: true` across 7 checked entries/routes)
    - `cd d:\pipelineguard\dashboard; $env:VITE_E2E="1"; npm run build; node scripts\verify3DSmoke.mjs` -> **PASS** (`SMOKE=0`):
      - `/` and `/app`: `threeRequestsCount: 0`, `errors: []`
      - `/__smoke3d?scene3d=force`: live `<canvas>` rendered (`672x280`, screenshot `2677 B`), `errors: []`
      - Fallbacks: `narrow360` (`canvasCount: 0`, fallback active, `errors: []`), `scene3dOff` (`0`), `reducedMotion` (`1` static canvas), `forcedColors` (`0`), `highContrast` (`0`), `webglDisabled` (`--disable-gpu --disable-webgl --disable-webgl2`: `0`), `saveData` (`0`).
  - **Post-cleanup final Phase 0 gates (throwaway `/__smoke3d` removed):**
    - `npx tsc --noEmit` -> **PASS** (`TSC=0`)
    - `npm run lint` -> **PASS** (`LINT=0`)
    - `npm test` -> **PASS** (`VITEST=0`, 5/5 tests)
    - `npm run build` -> **PASS** (`BUILD=0`, `LandingPage` `96.23 kB / 27.39 kB gz`, `0.00 kB` delta vs Phase B baseline)
    - `node scripts\checkManifest3D.mjs` -> **PASS** (`MANIFEST=0`, `isolationPassed: true`)
    - `verifyRules.ts` -> **PASS** (`VERIFY_RULES=0`, `ALL RULE ENGINE FIXTURE TESTS PASSED`)
    - `git diff --stat -- backend security` -> **PASS** (empty, `BACKEND_SEC=0`)
- **Measurements:**
  - Measured 3D lazy chunk (`SmokeProbe3D-*.js`, containing `three@0.187.0` + `@react-three/fiber@9.8.2` + `@react-three/drei@10.7.9` named exports + `core/*` + `glyphs` + smoke box): **251.88 kB** gzipped per Vite reporter (**243.98 KiB** gzipped / **925.64 KiB** raw via Node zlib) — well below the 280 KB target and 300 KB stop gate.
  - Landing chunk delta: `27.39 kB` gz before -> `27.39 kB` gz after (**+0.00 kB**).
- **Deviations from spec:**
  - Tested manual `rolldownOptions.output.codeSplitting.groups` (`three-runtime`); Rolldown merged a React runtime binding into `_three-runtime` causing `index.html` to import `_three-runtime` statically (`isolationPassed: false`). Following §0.4 item 5 ("A dynamic `import()` already isolates the chunk; add `codeSplitting.groups` only if the manifest check in 9.4 fails"), keeping automatic Rolldown code splitting produced `isolationPassed: true` cleanly with 243.98 KiB gzip. Will re-evaluate `groups` only if multi-scene chunking splits unfavorably in Phases 1–4.
  - Used `verify3DSmoke.mjs` API route stub (`http://127.0.0.1:8000/api/**`) during standalone frontend preview tests because FastAPI backend was not running during Phase 0 browser check; noted in log, backend untouched.
- **Open questions:** None — proceed to 3D Phase 1 (`GateSequence3D`).

### 3D Phase 1 — `GateSequence3D`

- **Goal:** Add the scroll-linked 4-station isometric `GateSequence3D` above the numbered DOM rail in `HowItWorksSection.tsx`, driven by parsed AST nodes, `sampleWorkflows.ts` paths, analyzer `CI_GATE_THRESHOLD`, and a canonicalized Web Crypto SHA-256 digest, with shared `LedgerChainGroup` for Station 4 and synchronous DOM badge lighting.
- **Files changed:**
  - `dashboard/src/rules/analyzer.ts` & `dashboard/src/features/overview/OverviewPage.tsx` (exported and shared `CI_GATE_THRESHOLD = 70`).
  - `dashboard/src/styles/tokens.css` (added `[data-scene3d="on"] .pg-gate-line` CSS timeline override so JS scroll progress never double-drives CSS animation).
  - `dashboard/src/three/core/useSectionProgress.ts` (inlined `clampUnit` to avoid pulling `three` via `motion3d.ts` into the landing chunk).
  - `dashboard/src/three/core/shading.ts` & `core/index.ts` (added single-draw-call 3-face shaded `UNIT_SHADED_BOX_GEOMETRY` via vertex colors).
  - `dashboard/src/three/scenes/LedgerChain3D.tsx` (reusable instanced ledger chain blocks).
  - `dashboard/src/three/scenes/GateSequence3D/{sequenceData.ts,index.tsx,__tests__/sequenceData.test.ts}`.
  - `dashboard/src/features/landing/components/HowItWorksSection.tsx` (280px lazy desktop band aligned to badge centers via `ResizeObserver` + `"Show sequence again"` replay button + equivalent desktop 2D fallback).
  - `dashboard/scripts/verifyPhaseScenes.mjs` (Playwright live WebGL + draw call + isolation verifier).
- **Commands run (PASS / FAIL):**
  - `cd d:\pipelineguard\dashboard; npx tsc --noEmit` -> **PASS** (`TSC=0`)
  - `cd d:\pipelineguard\dashboard; npm run lint` -> **PASS** (`LINT=0`)
  - `cd d:\pipelineguard\dashboard; npm test` -> **PASS** (`VITEST=0`, 8/8 tests across `core.test.ts` + `sequenceData.test.ts`)
  - `cd d:\pipelineguard\dashboard; npm run build; node scripts\checkManifest3D.mjs` -> **PASS** (`BUILD=0`, `MANIFEST=0`, `isolationPassed: true`)
  - `cd d:\pipelineguard\dashboard; node scripts\verifyPhaseScenes.mjs` (`VITE_E2E=1` preview) -> **PASS** (`PHASE_SCENES=0`):
    - `/app` routes (`/app`, `/app/findings`, `/app/pipelines`, `/app/runs`): `threeReqsCount: 0`, `errors: []`
    - `/ ?scene3d=force` `#how-it-works`: `canvasBox: 1152x280`, `calls: 9` (<= 12), `triangles: 345` (<= 20,000), `data-scene3d="on"`, `litCount: 4`, `errors: []`
    - `/?scene3d=off` desktop fallback: `canvasCount: 0`, displays real `Gate threshold: 70` and `100/100`, `errors: []`
    - Mobile 360px: `hasOverflow: false`, `canvasCount: 0`
  - `verifyRules.ts` -> **PASS** (`VERIFY_RULES=0`)
  - `git diff --stat -- backend security` -> **PASS** (empty, `BACKEND_SEC=0`)
- **Measurements:**
  - `GateSequence3D-*.js`: `931.77 kB` (`247.24 kB` Vite gz / `239.45 KiB` Node zlib gz).
  - WebGL telemetry (`gl.info.render`): **9 draw calls**, **345 triangles**.
  - Landing static closure: `242.83 KiB` gz (`+2.45 KiB` over Phase 0 baseline from `useSectionProgress`, `useScene3DMode`, and fallback DOM strip; `three` / `@react-three` static imports = `0`).
- **Deviations from spec:** Switched slabs/bars from 6-material arrays to single-draw vertex-shaded `UNIT_SHADED_BOX_GEOMETRY` after observing 20 WebGL draw calls on initial run; keeps 3-face shading while dropping render calls to 9 (<= 12 budget).
- **Open questions:** None — proceed to 3D Phase 2 (`HeroGateScene`).

### 3D Phase 2 — `heroScanStore`, `HeroGateScene`, Stagger & Seal Fix

- **Goal:** Add `heroScanStore` (`useSyncExternalStore`) bridging `HeroScanDemo` -> `HeroGateScene` inside the fixed 240px `lg+` hero slot (`HeroGateSlot` mounted strictly after window `load` + `requestIdleCallback`/timeout fallback), fix simultaneous finding row flips using a true 50ms `fixedCount` stepper shared by DOM rows and 3D tiles, and verify non-zero real digest seal gating.
- **Files changed:**
  - `dashboard/src/three/state/{heroScanStore.ts,__tests__/heroScanStore.test.ts}`
  - `dashboard/src/three/scenes/HeroGateScene.tsx` (single `InstancedMesh` gate arch + N analyzer finding tiles + severity/check glyphs + digest badge overlay when fixed)
  - `dashboard/src/features/landing/components/{HeroGateSlot.tsx,HeroScanDemo.tsx}` & `dashboard/src/features/landing/LandingPage.tsx`
  - `dashboard/scripts/verifyPhaseScenes.mjs` (extended to test `HeroGateScene` mid-stagger & final fixed state + draw calls)
- **Commands run (PASS / FAIL):**
  - `npx tsc --noEmit` -> **PASS** (`TSC=0`)
  - `npm run lint` -> **PASS** (`LINT=0`)
  - `npm test` -> **PASS** (`VITEST=0`, 10/10 tests across 3 test suites)
  - `npm run build` + `node scripts\checkManifest3D.mjs` -> **PASS** (`BUILD=0`, `MANIFEST=0`, `isolationPassed: true`)
  - `node scripts\verifyPhaseScenes.mjs` -> **PASS** (`PHASE_SCENES=0`: `/app*` 0 3D requests, 0 errors; `heroMidFixedCount: 1`, `heroEndFixedCount: 7`, zero `000000000000`; `heroGate` 5 draw calls / 227 triangles; `gateSequence` 9 draw calls / 345 triangles)
  - `verifyRules.ts` -> **PASS** (`VERIFY_RULES=0`)
  - `git diff --stat -- backend security` -> **PASS** (empty, `BACKEND_SEC=0`)
- **Measurements:**
  - Combined lazy 3D chunks: `242.00 KiB` gz (`core`: 237.08 KiB, `GateSequence3D`: 2.89 KiB, `HeroGateScene`: 2.03 KiB).
  - `HeroGateScene` WebGL telemetry: **5 draw calls**, **227 triangles**.
  - Landing static closure: `243.88 KiB` gz (`+1.05 KiB` delta from `heroScanStore` + `HeroGateSlot`).
- **Deviations from spec:** None — all Phase 2 requirements met.
- **Open questions:** None — proceed to 3D Phase 3 (`ArchitectureFlow3D`).

### 3D Phase 3 — `ArchitectureFlow3D`, Section & Navigation

- **Goal:** Add the interactive 7-layer isometric `ArchitectureFlow3D` (`Sources -> Ingest -> Detect -> Score -> Events -> Store -> Surfaces`) driven by a single-source-of-truth `graph.ts`, add `ArchitectureSection` between How it works and Rules catalog plus an `"Architecture"` link in `LandingNav`, support viewport play-once + `"Show flow again"`, `"Trace a finding"`, `"Isometric / Flat"` hash toggle (`#architecture-flat`), hover/focus highlight via projected anchors + hidden accessible list, and enforce `graph.test.ts` invariants.
- **Files changed:**
  - `dashboard/src/three/scenes/ArchitectureFlow3D/{graph.ts,index.tsx,__tests__/graph.test.ts}`
  - `dashboard/src/features/landing/components/{ArchitectureSection.tsx,LandingNav.tsx}` & `dashboard/src/features/landing/LandingPage.tsx`
  - `dashboard/scripts/verifyPhaseScenes.mjs` (extended to verify ArchitectureFlow3D draw calls, Trace toggle, `#architecture-flat` hash toggle, hidden list focus, and dynamic manifest chunk isolation on `/app/*`).
- **Commands run (PASS / FAIL):**
  - `npx tsc --noEmit` -> **PASS** (`TSC=0`)
  - `npm run lint` -> **PASS** (`LINT=0`)
  - `npm test` -> **PASS** (`VITEST=0`, 13/13 tests across 4 test suites including `graph.test.ts` DAG & continuous trace validation)
  - `npm run build` + `node scripts\checkManifest3D.mjs` -> **PASS** (`BUILD=0`, `MANIFEST=0`, `isolationPassed: true`)
  - `node scripts\verifyPhaseScenes.mjs` -> **PASS** (`PHASE_SCENES=0`: `/app*` 0 3D requests, 0 console errors; `architectureFlow` 4 draw calls / 648 triangles; `archHiddenListWorks: true`; `archFlatHash: "#architecture-flat"`; `archFlatCanvasCount: 0`)
  - `verifyRules.ts` -> **PASS** (`VERIFY_RULES=0`)
  - `git diff --stat -- backend security` -> **PASS** (empty, `BACKEND_SEC=0`)
- **Measurements:**
  - Combined lazy 3D chunks: `244.52 KiB` gz (`core`: 237.31 KiB, `GateSequence3D`: 2.88 KiB, `HeroGateScene`: 2.03 KiB, `ArchitectureFlow3D`: 2.30 KiB).
  - `ArchitectureFlow3D` WebGL telemetry: **4 draw calls**, **648 triangles**.
  - Landing static closure: `246.82 KiB` gz.
- **Deviations from spec:** None — all Tier A bundle, draw-call, and accessibility gates passed, unlocking Tier B (Phase 4).
- **Open questions:** None — proceed to 3D Phase 4 (`RuleCatalog3D` and `AttackPath3D`).

### 3D Phase 4 — `RuleCatalog3D` & `AttackPath3D` (Tier B)

- **Goal:** Ship Tier B interactive 3D scenes cleanly under the 280 KB gzip budget: `RuleCatalog3D` above the catalog table (height proportional to severity weight, non-matching chips damping smoothly to 25% height and muted tone, row hover/focus/click synchronization) and `AttackPath3D` in `IncidentTabsSection` driven by extracted `incidentPaths.ts` with `"Without guard"` / `"With guard"` packet halt toggle at real rule control points.
- **Files changed:**
  - `dashboard/src/features/landing/components/{incidentPaths.ts,IncidentTabsSection.tsx,RulesCatalogSection.tsx}`
  - `dashboard/src/three/scenes/{RuleCatalog3D.tsx,AttackPath3D.tsx,__tests__/phase4Data.test.ts}`
  - `dashboard/scripts/verifyPhaseScenes.mjs` (added Phase 4 interactive verification for filter-chip damping, block hover -> table row highlight, and `"With guard"` `PG-WF-019 blocked` state).
- **Commands run (PASS / FAIL):**
  - `npx tsc --noEmit` -> **PASS** (`TSC=0`)
  - `npm run lint` -> **PASS** (`LINT=0`)
  - `npm test` -> **PASS** (`VITEST=0`, 15/15 tests across 5 test files)
  - `npm run build` + `node scripts\checkManifest3D.mjs` -> **PASS** (`BUILD=0`, `MANIFEST=0`, `isolationPassed: true`)
  - `node scripts\verifyPhaseScenes.mjs` -> **PASS** (`PHASE_SCENES=0`: `/app*` 0 3D requests, 0 console errors; `ruleCatalog`: 5 draw calls / 402 triangles; `attackPath`: 1 draw call / 108 triangles; `ruleCatalogCritRows: 5`; `ruleCatalogHighlightSync: "true"`; `incidentWithGuardLabel: true`)
  - `verifyRules.ts` -> **PASS** (`VERIFY_RULES=0`)
  - `git diff --stat -- backend security` -> **PASS** (empty, `BACKEND_SEC=0`)
- **Measurements:**
  - Combined lazy 3D chunks across ALL 5 scenes: **247.97 KiB** gz (`core`: 237.31 KiB, `GateSequence3D`: 2.88 KiB, `ArchitectureFlow3D`: 2.30 KiB, `HeroGateScene`: 2.03 KiB, `RuleCatalog3D`: 1.91 KiB, `AttackPath3D`: 1.54 KiB) — within the 280 KB target.
  - WebGL telemetry: `heroGate` 5 calls / 227 tris; `gateSequence` 10 calls / 357 tris; `architectureFlow` 4 calls / 648 tris; `ruleCatalog` 5 calls / 402 tris; `attackPath` 1 call / 108 tris.
  - Landing static closure: `248.36 KiB` gz.
- **Deviations from spec:** None — Tier B budget and interactive synchronization verified.
- **Open questions:** None — proceed to 3D Phase 5 (`DashboardPreview3D`).

### 3D Phase 5 — `DashboardPreview3D` (CSS 3D, Zero WebGL)

- **Goal:** Upgrade `DashboardPreviewSection.tsx` with three real Playwright-captured light and dark WebP overview layers (`Needs attention`, `Open now`, `Mean finding risk by date`) with `1x`/`2x` `srcset`, scroll-linked CSS 3D `perspective` + `translateZ` inside `@supports (animation-timeline: view())`, flat reduced-motion/narrow/unsupported fallback, zero WebGL, zero `backdrop-filter`, and zero permanent `will-change`.
- **Files changed:**
  - `dashboard/scripts/capturePreviewScreenshots.mjs` (Playwright capture script generating 12 crisp WebP assets from real `/app` Overview views under dark and light themes).
  - `dashboard/public/images/preview/{needs-attention,open-now,run-risk}-{dark,light}-{1x,2x}.webp`.
  - `dashboard/src/styles/tokens.css` (CSS `@supports (animation-timeline: view())` rules for `.pg-preview-3d-stage`, `.pg-preview-3d-grid`, `.pg-preview-layer-1`, `.pg-preview-layer-2`).
  - `dashboard/src/features/landing/components/DashboardPreviewSection.tsx` & `dashboard/scripts/verifyPhaseScenes.mjs`.
- **Commands run (PASS / FAIL):**
  - `node scripts\capturePreviewScreenshots.mjs` -> **PASS** (`CAPTURE=0`, 12 WebP files written)
  - `npx tsc --noEmit` -> **PASS** (`TSC=0`)
  - `npm run lint` -> **PASS** (`LINT=0`)
  - `npm test` -> **PASS** (`VITEST=0`, 15/15 tests)
  - `npm run build` + `node scripts\checkManifest3D.mjs` -> **PASS** (`BUILD=0`, `MANIFEST=0`, `isolationPassed: true`)
  - `node scripts\verifyPhaseScenes.mjs` -> **PASS** (`PHASE_SCENES=0`, `previewImgsLoaded: true`, 0 console errors)
  - `verifyRules.ts` -> **PASS** (`VERIFY_RULES=0`)
  - `git diff --stat -- backend security` -> **PASS** (empty, `BACKEND_SEC=0`)
- **Measurements:**
  - 12 captured WebP images (1x: 12.2–24.5 kB each; 2x: 29.7–61.2 kB each).
  - Combined lazy 3D chunks unchanged at **247.97 KiB** gz (zero WebGL added by Phase 5).
- **Deviations from spec:** None.
- **Open questions:** None — proceed to 3D Phase 6 (`LedgerChain3D` on `ArtifactsPage`).

### 3D Phase 6 — `LedgerChain3D` (`ArtifactsPage`)

- **Goal:** Reuse `LedgerChain3D` as a lazy route-scoped chunk (`LedgerArtifactScene3D`) inside `ArtifactsPage`, mounted only after the user computes or pastes a real SHA digest via Web Crypto (`crypto.subtle`), with an accessible 2D 4-block digest ledger strip when in `"fallback"` mode, while keeping `/app`, `/app/findings`, `/app/pipelines`, and `/app/runs` isolated from loading any Three/R3F chunk.
- **Files changed:**
  - `dashboard/src/three/scenes/LedgerChain3D.tsx`
  - `dashboard/src/features/artifacts/ArtifactsPage.tsx`
  - `dashboard/scripts/checkManifest3D.mjs`
  - `dashboard/scripts/verifyPhaseScenes.mjs`
- **Commands run (PASS / FAIL):**
  - `npx tsc --noEmit` -> **PASS** (`TSC=0`)
  - `npm run lint` -> **PASS** (`LINT=0`)
  - `npm test -- --run` -> **PASS** (`VITEST=0`, 5 test files, 15/15 tests passed)
  - `npm run build` (production, non-E2E) + `node scripts/checkManifest3D.mjs` -> **PASS** (`BUILD=0`, `MANIFEST=0`, `isolationPassed: true` across 7 checked entries)
  - `node scripts/verifyPhaseScenes.mjs` (Playwright over `VITE_E2E=1` build) -> **PASS** (`PHASE_SCENES=0`, `appIsolation.threeReqsCount=0`, `/app/artifacts?scene3d=force` rendered `artifactsLedger` with 0 console errors)
  - `verifyRules.ts` -> **PASS** (`RULES=0`)
  - `git diff --stat -- backend security` -> **PASS** (empty, `BSEC=0`)
- **Measurements:**
  - `artifactsLedger` (`LedgerArtifactScene3D`): **1 draw call**, **48 tris** (`<= 12` draw call budget).
  - Production gzip chunk totals (`checkManifest3D.mjs`): `core` `237.33 KiB`, `GateSequence3D` `2.65 KiB`, `ArchitectureFlow3D` `2.29 KiB`, `HeroGateScene` `2.03 KiB`, `RuleCatalog3D` `1.91 KiB`, `AttackPath3D` `1.54 KiB`, `LedgerChain3D` `1.17 KiB` -> **248.92 KiB** combined lazy 3D total (< 280 KB target).
- **Deviations from spec:** None.
- **Open questions:** None — proceed to 3D Phase 7 (Full Verification & Documentation).

### 3D Phase 7 — Full Verification, Idle-Frame Proof, Visual Regression & Docs

- **Goal:** Complete `GATEHOUSE_3D_LAYER_SPEC.md` §§9–11 end-to-end verification (5-second zero-idle GPU frame check, deterministic `?scene3d=static` visual comparison across dark/light `1440` & `768`, keyboard operability, fallback matrix, production `force` ignore check, `/app/*` isolation + zero console errors in both themes) and update `GATEHOUSE_CHECKLIST.md`, `FRONTEND_ARCHITECTURE_REPORT.md`, `LIVE_E2E_REPORT.md`, `README.md`, and `BUILD_TRACKER.md`.
- **Files changed:**
  - `dashboard/scripts/verifyPhase7Full.mjs` (new full §9 verification suite)
  - `GATEHOUSE_CHECKLIST.md`
  - `FRONTEND_ARCHITECTURE_REPORT.md`
  - `LIVE_E2E_REPORT.md`
  - `README.md`
  - `dashboard/docs/BUILD_TRACKER.md`
- **Commands run (PASS / FAIL):**
  - `node scripts/verifyPhase7Full.mjs prod` -> **PASS** (`PHASE7_PROD=0`: `prodForceIgnored` `canvasCount: 0`; `prod_dark` & `prod_light` across `/` and all 10 `/app/*` routes: `landingErrorsCount: 0`, `appErrorsCount: 0`, `appThreeReqsCount: 0`)
  - `$env:VITE_E2E="1"; npm run build; ... node scripts/verifyPhase7Full.mjs e2e` -> **PASS** (`PHASE7_E2E=0`)
  - Post-edit full gates (executed in final Phase 7 verification batch; see final gate results below) -> **PASS** (`TSC=0`, `LINT=0`, `VITEST=0`, `BUILD=0`, `MANIFEST=0`, `RULES=0`, `DESIGN_LINT=0`, `BSEC=0`, `PHASE7_PROD=0`)
- **Measurements:**
  - **5s idle WebGL frame delta (`deltaClears` / `deltaDraws`):** `HeroGateScene` `0` / `0` (after 57 clears / 332 draws), landing lower scenes `0` / `0` (after 512 clears / 2367 draws), `LedgerArtifactScene3D` `0` / `0` (after 19 clears / 19 draws).
  - **Draw calls & triangles across all 6 scenes:** `heroGate` 5 calls / 227 tris, `gateSequence` 9 calls / 345 tris, `architectureFlow` 4 calls / 648 tris, `attackPath` 1 call / 108 tris, `ruleCatalog` 5 calls / 402 tris, `ledgerArtifact` 1 call / 48 tris.
  - **Deterministic visual regression (`?scene3d=force` + `prefers-reduced-motion: reduce`, DPR `1`):** `dark_1440`, `light_1440`, `dark_768`, `light_768` (`overflow: false`, `imgsOk: true`, `errorsCount: 0`; repeat `#architecture` & `#rules` diff ratio = `0`).
  - **Fallbacks & 360px mobile:** `--disable-gpu`, `forcedColors: "active"`, `prefers-contrast: more`, `saveData: true`, `?scene3d=off` -> all `0` canvases, `0` errors; `360x800` across `/`, `/app`, `/app/findings`, `/app/artifacts`, `/app/pipelines` -> `overflow: false`, `0` canvases.
  - **Bundle sizes (production):** `248.92 KiB` gz combined lazy 3D chunks (`core` `237.33 KiB` gz, 6 scene chunks `1.17–2.65 KiB` gz), `isolationPassed: true`.
- **Deviations from spec:** None.
- **Open questions:** None — all Phases (A, B, and 3D Phases 0–7) are Done.

## 3. Assumptions

| Assumption / Spec Mismatch | Verification Method | Result |
| --- | --- | --- |
| Spec path `dashboard/design/DESIGN.md` & `dashboard/design/GATEHOUSE_3D_LAYER_SPEC.md` | Checked `Test-Path dashboard\design\*` vs repo root | Paths in `dashboard/design/` do not exist; actual specs live at `d:\pipelineguard\DESIGN.md` and `d:\pipelineguard\GATEHOUSE_3D_LAYER_SPEC.md`. |
| 3D spec §4.5 imports `../../styles/motion` and `heroScanStore` | Inspected `dashboard/src/` file tree | Actual motion helper lives at `dashboard/src/motion/motion.ts`; 3D stores will live under `dashboard/src/three/state/`. |
| Rule engine export symbols for UI & 3D | Verified `src/rules/{analyzer,registry,sampleWorkflows,severity}.ts` & ran `verifyRules.ts` | Exports `analyzeWorkflowText`, `calculateRisk`, `WORKFLOW_RULES` (24 entries: 23 active + `PG-WF-900`), `lookupRule`, `HERO_BROKEN_WORKFLOW`, `HERO_FIXED_WORKFLOW`, `PLAYGROUND_SAMPLES`, `SECRET_PATTERN_RULES`, `SEVERITY_META`. |
| React & Three.js peer dependency compatibility | Ran `npm ls react` and `npm view` for 3D packages | Installed `react@19.3.0`; `three@0.187.0`, `@react-three/fiber@9.8.2` (`react >=19 <19.4`), `@react-three/drei@10.7.9` (`react ^19`) are mutually compatible. |
| `@google/design.md` CLI lint invocation | Inspected npm cache `package.json` (`bin`) and ran `npx` variants | Package `@google/design.md@0.4.0` defines bin names `design.md` and `designmd`. Bare `npx @google/design.md lint ...` exits `1` on Windows/npx; `npx --yes --package=@google/design.md designmd lint DESIGN.md` runs clean (`exit 0`, `0 errors`). |
| Test / headless browser runners (`vitest`, Playwright) | Checked `npm ls` and browser paths | `vitest` and `playwright` are not yet in `dashboard/package.json`; local Chrome, Edge, and `%LOCALAPPDATA%\ms-playwright` are present on host. |

## 4. Decisions

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-11-26 | Use repo-root `DESIGN.md` and `GATEHOUSE_3D_LAYER_SPEC.md` in place without duplicating files under `dashboard/design/`. | Avoid duplicate drifting specs; paths verified on disk. |
| 2026-11-26 | Use `npx --yes --package=@google/design.md designmd lint DESIGN.md` (and verify bare `@google/design.md` output remains unchanged) to run the v0.4.0 Design linter cleanly. | Verified package bin mapping (`designmd`) avoids npx bin-name mismatch on Windows. |
| 2026-11-26 | Classify Phase A findings A1–A14 strictly against `DESIGN.md` and hard constraints so Phase B touches only genuine `DESIGN.md` / correctness gaps before 3D Phase 0. | Matches requested three-stage execution order (A -> B -> 3D 0..7). |
| 2026-11-26 | Copy `@fontsource/instrument-sans` & `@fontsource/jetbrains-mono` Latin `.woff2` subsets into `dashboard/public/fonts/` and preload weights 400 & 600 cleanly via `/fonts/...`. | Ensures 100% offline deterministic font delivery with zero external Google Fonts dependency and matching preload URLs (<35 kB for 400+600). |
| 2026-11-26 | Keep `eslint.config.js` scoped to JS/JSX rather than forcing `--legacy-peer-deps` on `typescript-eslint@8.74.0` against `typescript@7.0.2`. | Clean npm resolution and native TypeScript 7 validation via `npx tsc --noEmit`. |

## 5. Blockers and Next Action

- **Blockers:** None.
- **Next action:** Complete — all requested phases (Phase A, Phase B, and Gatehouse 3D Layer Spec Phases 0–7) are finished and verified with zero console errors, zero idle GPU frames, isolated lazy bundles (< 280 KB gz), and zero changes to `backend/` or `security/`.
