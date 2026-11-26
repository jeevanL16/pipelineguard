# PipelineGuard Gatehouse (v2) — Live End-to-End Browser & API Verification Report

- **Date:** 2026-11-25
- **Frontend Server:** Vite (`http://127.0.0.1:5173`) — Gatehouse (v2) UI ([dashboard/](file:///d:/pipelineguard/dashboard))
- **Backend Server:** FastAPI (`http://127.0.0.1:8000`) — Untouched (`backend/`, `security/`) backed by SQLite
- **Live GitHub Target Repository Tested:** `https://github.com/jeevanL16/eventgenie`
- **Test Method:** Live Chrome interactive browser walkthrough via `chrome_devtools` (`4d005a4b-5080-487c-a6ed-b7103692fb67`), complemented by `tsc --noEmit`, `eslint .`, `vite build`, and rule-engine fixture tests ([verifyRules.ts](file:///d:/pipelineguard/dashboard/scripts/verifyRules.ts)).

---

## Executive Summary

| Verification Area | Status | Notes |
|---|---|---|
| Typecheck (`tsc --noEmit`), Lint (`eslint .`), Build (`vite build`) | **PASS** | 0 TS errors, 0 ESLint errors/warnings, built in `1.74s` |
| Shared Rule Engine Fixture Tests | **PASS** | 24 rules (`PG-WF-001`–`023` + `900`), broken hero sample, zero-finding fixed hero, parse error & suppression |
| Landing Page (`/`) Interactive Flows & Light/Dark Themes | **PASS** | Hero scan, `"Show fix"` diff swap + real SHA-256 `Verified` Seal (`7d915c444e1b`), Incident Tabs, Playground, Rules Catalog, Hotspots, FAQ |
| Mobile `360×800` Responsive Check | **PASS** | Fixed nav button utility collision (`LandingNav.tsx`); zero clipping and zero horizontal overflow (`360px` header/main width) |
| Live Repository Connection (`jeevanL16/eventgenie`) | **PASS** | Detected `ci.yml` on `main` via GitHub API fallback, suggested `pipe-eventgenie`, saved (`HTTP 201`) to SQLite |
| Dashboard Console (`/app/*` across all 10 routes) | **PASS** | Overview queue/chart, Findings URL filters + `j`/`k`/`Enter` + Drawer + Optimistic updates, Workflows, Secrets, Artifacts SHA-256, Runs, Audit Log, Settings |
| Post-Fix Console Audit | **PASS** | Zero React errors/warnings after fixing `useOptimistic` `startTransition`, `aria-hidden` focus race, and mobile nav wrapper |

---

## Detailed Test Results

### 1. Public Landing Page (`http://127.0.0.1:5173/`)
- **Initial Load & Brand Integrity:**
  - Document title: `PipelineGuard — Workflow, Secret & Artifact Inspection`
  - Hero heading (`display-xl`, left-aligned): `"Catch risky workflow changes before they run."`
  - Gate mark SVG + sticky header navigation (`Rules`, `Playground`, `Docs`, `GitHub`, theme toggle, `Dashboard`, `Connect repository`) rendered cleanly.
- **Hero Scan Demo ([HeroScanDemo.tsx](file:///d:/pipelineguard/dashboard/src/features/landing/components/HeroScanDemo.tsx)):**
  - Always-dark `CodePanel` (`"Sample workflow: ci.yml"`, `.pg-force-dark`) stayed dark (`#0E181D`) in both Light and Dark themes.
  - Automated line scan finished at `7 findings · Risk 100/100` (`Scan complete: 7 findings, 2 critical, 4 high, 1 low.`):
    - `Critical PG-WF-006` (`L3, L12`): `pull_request_target` with head-ref checkout
    - `High PG-WF-005` (`L5`): `permissions: write-all`
    - `High PG-WF-019` (`L10` & `L13`): Actions not pinned to full 40-char commit SHAs
    - `Low PG-WF-020` (`L10`): `actions/checkout` without `persist-credentials: false`
    - `High PG-WF-021` (`L14`): Secret expression echoed in `run:`
    - `Critical PG-WF-001` (`L15`): Untrusted PR title interpolated in shell script
  - Clicking `PG-WF-001` focused and highlighted line `15`.
  - Clicking **`"Show fix"`** displayed the diff (`diff-removed` / `diff-added`), switched all 7 findings to `"Fixed"`, reached `0 findings` / `0 remaining`, computed the real SHA-256 via `crypto.subtle.digest`, and stamped the **`Verified`** Seal with 12-char digest `7d915c444e1b`. Clicking **Copy** swapped feedback to `"Full SHA-256 digest copied"`. **`"Run scan again"`** reset cleanly.
- **Theme Switcher:** Switching between `System`, `Light` (`--pg-canvas: #F4F7F6`), and `Dark` (`--pg-canvas: #0E181D`) updated CSS tokens cleanly while preserving dark hero code contrast.
- **Incident Tabs ([IncidentTabsSection.tsx](file:///d:/pipelineguard/dashboard/src/features/landing/components/IncidentTabsSection.tsx)):**
  - All 3 tabs verified: `"Mutable action tag"` (`PG-WF-019`), `"Secret written to logs"` (`PG-WF-021`), and `"Tampered artifact digest"` showing Built `9f2c41ab07de` vs Published `4d80e2c91a3f` with `"Mismatch blocked"`.
- **Interactive Playground ([PlaygroundSection.tsx](file:///d:/pipelineguard/dashboard/src/features/landing/components/PlaygroundSection.tsx)):**
  - `"Unpinned action"` → `PG-WF-019` (Line 12, `Risk 40/100 · Grade C`)
  - `"Secret in a log"` → `PG-WF-021` (Line 12, `Risk 40/100 · Grade C`)
  - `"Pull request title in a shell command"` → `PG-WF-006` (Line 3) + `PG-WF-001` (Line 15, `Risk 100/100 · Grade F`)
  - Syntax error input (`jobs:\n  build:\n    steps:\n    name: bad`) → displayed header `"Syntax error"` and alert `"Line 4: expected a list item. Check the indentation under steps:."`.
- **Rules Catalog, Dashboard Preview & FAQ:**
  - Rules catalog rendered 23 active workflow rules (`PG-WF-001`–`PG-WF-023`); `"Critical"` chip filtered cleanly to 5 critical rules (`PG-WF-001`, `PG-WF-002`, `PG-WF-006`, `PG-WF-011`, `PG-WF-023`).
  - Dashboard preview 3 hotspot tabs (`Needs attention queue`, `Evidence drawer`, `Audit log`) switched callouts on focus/click; FAQ `<details>` expanded cleanly.
- **Responsive `360×800` Check:** After wrapping `"Connect repository"` in `hidden sm:inline-flex`, `"PipelineGuard"` and `"Dashboard"` fit on `360px` width with zero clipping or horizontal scroll.

---

### 2. Live Repository Connection Demo (`https://github.com/jeevanL16/eventgenie`)
- **Validation:** Submitting empty URL displayed inline error `"Enter a repository URL to connect."` (`aria-invalid="true"`) while keeping `"Connect repository"` enabled (progressive UX).
- **Resolution & Workflow Inspection:** Entering `https://github.com/jeevanL16/eventgenie`:
  - Attempted `GET http://127.0.0.1:8000/api/repositories/resolve` (returned expected `404` fallback since backend routes were untouched).
  - Resolved public GitHub metadata (`200 OK` on repo, `.github/workflows?ref=main`, and `branches?per_page=10`), reporting:
    - **`Found 1 workflow in .github/workflows on main`** → `ci.yml`
    - Pre-filled Pipeline ID: **`pipe-eventgenie`**
    - Pre-selected Branch: **`main`**
- **Submission & Persistence:** Submitting executed `POST http://127.0.0.1:8000/api/pipelines` (`201 Created`), displayed `"Repository connected. First scan queued."` toast, closed modal cleanly, navigated to `/app/pipelines`, and displayed **`pipe-eventgenie`** (`Protected`, `https://github.com/jeevanL16/eventgenie`, `main`, `2026-11-25`) along with first-scan steps (`Queued`, `Reading workflows`, `Applying rules`, `Recorded`).

---

### 3. Dashboard Console (`/app/*`)
- **Overview (`/app`):**
  - Top bar showed static `"Connected"` indicator + `"Updated ..."` timestamp (no pulsing animations).
  - Sidebar groups rendered canonically (`Monitor`, `Guard`, `Pipelines`, `Records`, `Settings`) and expanded/collapsed cleanly (`232px` ↔ `56px` with full ARIA labels on icon links).
  - `"Needs attention"` displayed top open findings ordered severity-first then age; `"Open now"` showed stacked severity bar (`2 critical, 1 high`) and plain text stats (`Open: 3`, `Pipelines: 6`, `Runs: 4`, `Critical: 2`); `"Run risk, last 14 days"` plotted single-series curve (`Start 67/100 · Current 79/100`, `Gate threshold 70`).
- **Findings (`/app/findings`), Drawer & Keyboard Navigation:**
  - Filtering by `"Critical"` updated URL to `?severity=CRITICAL` (`2 findings`: `EVT-PG-002`, `EVT-PG-001`).
  - Keyboard `j` / `k` moved row focus and `Enter` opened `?finding=...` Evidence Drawer (`Escape` closed cleanly).
  - Evidence Drawer for `EVT-PG-001` showed `PG-WF-001 (CWE-78)`, `Risk 95/100`, flagged snippet, remediation diff, and status history.
  - Status dropdown transitions (`EVT-PG-001` `OPEN` → `RESOLVED` → `OPEN`) updated optimistic UI + sidebar count (`3` → `2` → `3`) and persisted via `PATCH /api/events/EVT-PG-001/status` with zero console errors.
- **Command Palette (`Ctrl+K`):** Opened `cmdk` dialog with `Recent`, `Findings`, `Pipelines` (including newly connected `pipe-eventgenie`), `Pages`, and `Actions`. Query filtering worked cleanly.
- **Incidents (`/app/incidents`):** Filtered to 3 active critical/high findings (`EVT-PG-002`, `EVT-PG-001`, `EVT-PG-003`).
- **Workflows (`/app/workflows`):** Rendered all 23 active backend rules with working severity and category filter chips (`Injection`, `Supply chain`, etc.).
- **Secrets (`/app/secrets`):** Listed secret finding `EVT-PG-002` + all 5 secret severity rules matching `security/secrets/severity.py`.
- **Artifacts (`/app/artifacts`):**
  - Default payload hash calculated in-browser: `879418378dda8c86e3c95d7e2d05f58fc3b69fccc055ad42e0cfb09e17466a9b` → **`MATCH · PASS`** with `Verified` Seal (`879418378dda`).
  - Mutating payload (`2.0` → `2.1`) produced `52c9a89d9a3923170a94b58ceb688765d7a8575242c330f809f142aa1096c8b7` → **`MISMATCH · BLOCK`**.
- **Runs (`/app/runs`) & Audit log (`/app/audit`):**
  - Runs displayed `run-101`–`run-104` with working column sorting.
  - Audit log displayed 5 records including live status transitions generated during verification (`#4 OPEN → RESOLVED`, `#5 RESOLVED → OPEN`).
- **Settings (`/app/settings`):**
  - `"Run connection test"` executed live requests in plain table rows:
    - `GET http://127.0.0.1:8000/api/health` → `200 OK (healthy)` (`28 ms`)
    - `GET http://127.0.0.1:8000/api/test` → `200 OK` (`19 ms`)

---

## Bugs Found During Live Browser Testing & Fixed

1. **`useOptimistic` outside transition in [FindingsTable.tsx](file:///d:/pipelineguard/dashboard/src/features/findings/components/FindingsTable.tsx):** Wrapped `applyOptimistic` + `onStatusChange` (and `"Undo"`) inside `startTransition(async () => ...)` for React 19 compliance; re-verified with zero console errors.
2. **Mobile `360px` header clipping in [LandingNav.tsx](file:///d:/pipelineguard/dashboard/src/features/landing/components/LandingNav.tsx):** `Button`'s `inline-grid` utility overrode `hidden` below `640px`. Wrapped `"Connect repository"` inside `<div className="hidden sm:inline-flex">` and re-verified clean non-clipped `360px` mobile header.
3. **Dialog background focus race (`aria-hidden` warning) in [Overlay.tsx](file:///d:/pipelineguard/dashboard/src/ui/Overlay.tsx) & [ConnectRepositoryForm.tsx](file:///d:/pipelineguard/dashboard/src/features/pipelines/components/ConnectRepositoryForm.tsx):** Moved focus synchronously into `#connect-repo-url` via Radix `onOpenAutoFocus` before Radix sets `aria-hidden` on background regions; re-verified with zero warnings.
4. **Collapsed sidebar link accessibility in [DashboardShell.tsx](file:///d:/pipelineguard/dashboard/src/features/shell/DashboardShell.tsx):** Added `aria-label` to sidebar `<NavLink>` items when collapsed (`56px`); re-verified every link's accessible name in the accessibility tree.
5. **Playground syntax error score badge in [PlaygroundSection.tsx](file:///d:/pipelineguard/dashboard/src/features/landing/components/PlaygroundSection.tsx):** Updated header status to display `"Syntax error"` instead of `"Risk 40/100 · Grade C"` when YAML parsing fails; re-verified live.

---

## Gatehouse 3D Layer Verification (`GATEHOUSE_3D_LAYER_SPEC.md` §9 & §11)

- **Verification Date:** 2026-11-26
- **Scripts:** [checkManifest3D.mjs](file:///d:/pipelineguard/dashboard/scripts/checkManifest3D.mjs), [verifyPhase7Full.mjs](file:///d:/pipelineguard/dashboard/scripts/verifyPhase7Full.mjs)
- **Vitest Suite (`npm test -- --run`):** `5` test files passed, `15/15` tests passed (`core.test.ts`, `sequenceData.test.ts`, `heroScanStore.test.ts`, `graph.test.ts`, `phase4Data.test.ts`).
- **Design Lint:** `npx --yes --package=@google/design.md designmd lint DESIGN.md` -> `0 errors` (`25 warnings`, `1 info`).

### Bundle Size & Isolation (`dist/.vite/manifest.json`)

| Metric | Measured Production Result | Spec Budget / Rule |
| --- | --- | --- |
| Manifest checked entries | `7` | All entries isolated (`isolationPassed: true`) |
| Landing static closure | `249.04 KiB` gz (`LandingPage` chunk `15.26 kB` gz; `index` `174.91 kB` gz) | No `three` or `@react-three` in static closure |
| Lazy `core` (`three` / R3F / Drei) chunk | `237.33 KiB` gz (`245.05 kB` Vite gz) | Route/viewport lazy only |
| Lazy scene chunks (6 scenes) | `GateSequence3D` `2.65`, `ArchitectureFlow3D` `2.29`, `HeroGateScene` `2.03`, `RuleCatalog3D` `1.91`, `AttackPath3D` `1.54`, `LedgerChain3D` `1.17` KiB gz | Total **248.92 KiB** gz combined lazy 3D (`<= 280 KB`) |
| `/app` + non-Artifacts routes (`dark` & `light`) | `0` requests for any 3D chunk, `0` console/page errors | `/app/*` never downloads landing 3D bundle |
| `/app/artifacts` lazy trigger | `0` 3D requests on initial load; `2` requests (`core` + `LedgerChain3D`) only after Web Crypto digest verification | Route-scoped opt-in on user digest |
| Production `?scene3d=force` guard | `0` canvases mounted when `failIfMajorPerformanceCaveat: true` applies | Production build ignores `force` |

### WebGL Draw Calls, Idle GPU Frames & Determinism (`VITE_E2E=1`)

| Scene | Draw Calls | Triangles | 5s Idle Delta (`clears` / `draws`) | Keyboard / Interaction Parity |
| --- | --- | --- | --- | --- |
| `HeroGateScene` (`/`) | `5` (`<= 12`) | `227` | `0` / `0` | `"Show fix"` (`Enter`): 7 staggered rows + real SHA-256 Seal |
| `GateSequence3D` (`#how-it-works`) | `9` (`<= 12`) | `345` | `0` / `0` | `"Show sequence again"` (`Enter`) replays stations |
| `ArchitectureFlow3D` (`#architecture`) | `4` (`<= 12`) | `648` | `0` / `0` | `"Trace a finding"` (`Enter`), `sr-only` list focus, `"Flat"` (`Space`) -> `0` canvases |
| `AttackPath3D` (`#incidents`) | `1` (`<= 12`) | `108` | `0` / `0` | `"With guard"` (`Enter`) halts packet + displays `PG-WF-019 blocked` |
| `RuleCatalog3D` (`#rules`) | `5` (`<= 12`) | `402` | `0` / `0` | `"Critical"` chip (`Enter`) filters to `5` rows; chip `001` highlights `PG-WF-001` |
| `LedgerArtifactScene3D` (`/app/artifacts`) | `1` (`<= 12`) | `48` | `0` / `0` | Real Web Crypto SHA-256 digest drives 4th block drop |

### Visual Regression, Fallbacks & Console Hygiene

- **Visual Regression (`?scene3d=force` + `prefers-reduced-motion: reduce`, DPR `1`):** Verified `dark_1440`, `light_1440`, `dark_768`, and `light_768` with `overflow: false`, `imgsOk: true` (all Preview `.webp` assets loaded), and `errorsCount: 0`; repeat-render comparison of `#architecture` and `#rules` produced pixel difference ratios of **`0`** (`<= 0.005`).
- **Accessibility & Environmental Fallbacks (2D Parity):** Verified `--disable-gpu --disable-webgl --disable-webgl2` (`0` canvases), `forcedColors: "active"` (`0` canvases), `prefers-contrast: more` (`0` canvases), `navigator.connection.saveData = true` (`0` canvases), `?scene3d=off` (`0` canvases), `prefers-reduced-motion: reduce` (static final pose), and `360x800` mobile across `/`, `/app`, `/app/findings`, `/app/artifacts`, `/app/pipelines` (`overflow: false`, `0` canvases, `0` console errors).
