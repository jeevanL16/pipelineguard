# PipelineGuard Gatehouse (v2): Frontend Architecture, Report & Improvement Guide

> **Stack:** React 19 + TypeScript 7 + Vite 8.3 + Tailwind CSS v4 + Three.js (`three` / `@react-three/fiber` / `@react-three/drei`, lazy isolated) + TanStack Query v5 + TanStack Table v9 (`/legacy` adapter) + Radix UI (`dialog`, `tabs`, `tooltip`, `select`) + `cmdk` + Motion (`LazyMotion`) + Zod + `js-yaml`  
> **Directory:** `dashboard/src/`  
> **Specs:** [DESIGN.md](./DESIGN.md) · [GATEHOUSE_3D_LAYER_SPEC.md](./GATEHOUSE_3D_LAYER_SPEC.md)  
> **Live Test & Verification Reports:** [LIVE_E2E_REPORT.md](./LIVE_E2E_REPORT.md) · [BUILD_TRACKER](./dashboard/docs/BUILD_TRACKER.md)

---

## 1. Current Architecture & Module Map

```text
dashboard/src/
├── main.jsx                          # Entrypoint mounting <AppRouter />
├── index.css                         # Tailwind v4 + DESIGN.md CSS tokens
├── styles/tokens.css                 # Semantic --pg-* dark/light tokens, .pg-force-dark, self-hosted fonts, CSS 3D preview & view() gate line
├── motion/
│   ├── motion.ts                     # MOTION timing/easing constants + runViewTransition()
│   └── MotionProvider.tsx            # Async LazyMotion (domMax strict mode)
├── three/                            # Isolated Gatehouse isometric WebGL & state layer (lazy chunks, frameloop="demand")
│   ├── core/                         # Scene3D, useScene3DMode, liveCanvasBudget (<=3), useGatehouseTheme,
│   │                                 # useSectionProgress, useInvalidateWhile, useProjectedAnchors, motion3d, shading, glyphs
│   ├── state/heroScanStore.ts        # Shared HeroScanDemo <-> HeroGateScene state (staggered fixedCount + digest)
│   └── scenes/                       # HeroGateScene, GateSequence3D, ArchitectureFlow3D (graph.ts),
│                                     # RuleCatalog3D, AttackPath3D (incidentPaths.ts), LedgerChain3D (ArtifactsPage)
├── app/
│   ├── theme.tsx                     # System / Light / Dark switcher + static critical favicon sync
│   ├── queryClient.ts                # TanStack Query (15s polling, paused in hidden tabs)
│   └── router.tsx                    # Lazy code-split routes for / and /app/*
├── rules/                            # Shared pure TypeScript rule engine (zero UI imports)
│   ├── schemas.ts                    # Zod schemas (Rule, WorkflowFinding, AnalysisResult)
│   ├── severity.ts                   # Single mapping: severity -> color var, SVG shape, order, weight
│   ├── registry.ts                   # PG-WF-001..023 + PG-WF-900 aligned with security/workflow/rules.py
│   ├── parser.ts                     # js-yaml line-tracking parser + steps: structural error locator
│   ├── analyzer.ts                   # Detectors + # pipelineguard-ignore + risk/grade scoring + CI_GATE_THRESHOLD (70)
│   ├── sampleWorkflows.ts            # Hero broken/fixed YAML, 3 Playground samples, Secret rules
│   └── scanner.worker.ts             # Web Worker for >200-line workflow YAML
├── ui/                               # Reusable accessible Gatehouse UI primitives (Radix-backed)
│   ├── BrandMark.tsx                 # 24px Gate mark SVG + Instrument Sans 600 wordmark
│   ├── Badge.tsx                     # Triple-encoded severity badge (custom 12px SVG shapes + tint + label)
│   ├── Button.tsx                    # Width-preserving Button, aria-pressed Chip, Kbd
│   ├── Input.tsx                     # Accessible Field (aria-invalid, aria-describedby) + Radix Select
│   ├── Seal.tsx                      # Bordered SHA-256 Verified seal (12-char digest + full copy button)
│   ├── Panel.tsx                     # Panel, CodePanel (WAAPI scan cursor), Skeleton (static), EmptyState, ErrorPanel
│   ├── Overlay.tsx                   # Dialog & square-edge Drawer (Radix Dialog focus trap + dirty confirm)
│   ├── Tabs.tsx                      # Radix Tabs (measured sliding 2px verdigris underline) + Tooltip
│   └── Toast.tsx                     # Animated Toast viewport with 6s Undo action
├── services/api.ts                   # Typed REST client (latency ms, X-Request-Id, repo resolve fallback)
└── features/
    ├── landing/                      # Public route / (isolated from Recharts/Query/Table; lazy-loads Three scenes idle/near)
    │   ├── LandingPage.tsx
    │   └── components/               # LandingNav, HeroScanDemo, HeroGateSlot, ArchitectureSection, IncidentTabsSection,
    │                                 # PlaygroundSection, HowItWorksSection, RulesCatalogSection, DashboardPreviewSection, FaqSection
    ├── shell/                        # DashboardShell (232px/56px/mobile drawer), TopBar, CommandPalette, ThemeSwitch
    ├── overview/OverviewPage.tsx     # Needs Attention queue, Open Now bar, Run Risk line chart, First-run guide
    ├── findings/                     # FindingsPage, NeedsAttentionQueue, FindingsTable, FindingDrawer, queries, utils
    ├── incidents/IncidentsPage.tsx   # High/Critical active incident queue sharing drawer
    ├── workflows/WorkflowsPage.tsx   # 23 active workflow rules table + category/severity chips
    ├── secrets/SecretsPage.tsx       # Masked secret findings + security/secrets/severity.py rules
    ├── artifacts/ArtifactsPage.tsx   # Web Crypto SHA-256 verifier + session log + lazy LedgerArtifactScene3D
    ├── pipelines/                    # PipelinesPage + ConnectRepositoryForm (useActionState + Zod) + Dialog
    ├── runs/RunsPage.tsx             # Sortable execution history table
    ├── audit/AuditLogPage.tsx        # Sortable immutable audit trail linking back to Findings drawer
    └── settings/SettingsPage.tsx     # Live latency diagnostics table, ThemeSwitch, optional JWT login
```

### 1b. Gatehouse 3D Layer Architecture (`GATEHOUSE_3D_LAYER_SPEC.md`)
- **Matte Orthographic Geometry:** Zero scene lights, zero shadows, zero glow/glass/bloom; `MeshBasicMaterial` with vertex-shaded `UNIT_SHADED_BOX_GEOMETRY` renders top/left/front shaded slabs in **1–9 draw calls** and **48–648 triangles** per scene.
- **Demand Rendering (`frameloop="demand"`):** Scenes step via `useInvalidateWhile()` only while transitioning and settle cleanly to **0 GPU draw calls / 0 clears over 5s idle**, enforced alongside a global max-3 live canvas pool (`liveCanvasBudget.ts`).
- **Bundle Isolation:** `LandingPage` lazy chunk (`15.26 kB` gz) and initial app shell stay isolated from Three/R3F (`landingStaticClosureGzKb: 249.04 KiB`); combined lazy 3D chunks measure **`248.92 KiB` gz** (below the 280 KB target). Dashboard routes `/app`, `/app/findings`, `/app/pipelines`, and `/app/runs` make zero requests for any Three/R3F chunk; `/app/artifacts` lazy-loads `LedgerChain3D` only after Web Crypto digest verification.
- **Strict Fallback Parity:** Every scene degrades cleanly to an identical-information 2D DOM view under `--disable-gpu` / missing WebGL2, `forced-colors`, `prefers-contrast: more`, `prefers-reduced-motion`, `<768px`, `navigator.connection.saveData`, or `?scene3d=off`.

---

## 2. How Visuals & Animations Work Right Now

- **Calm Non-AI Design System:** Replaces the old cyber-dark glassmorphic palette (`backdrop-blur`, gradients, glow shadows, pulsing radar dots) with two quiet tonal surfaces (`--pg-canvas` `#0E181D` dark / `#F4F7F6` light; `--pg-panel` `#142329` / `#FFFFFF`; `--pg-raised` `#1B2F36` / `#E8EEEC`) separated by `1px` `--pg-line` rules.
- **Triple-Encoded Status Signals:** Severity never relies on color alone — every badge renders a distinct 12px custom SVG geometry (`CRITICAL` filled diamond, `HIGH` triangle, `MEDIUM` square, `LOW` circle, `INFO` bar, `PASS` check) paired with high-contrast tints.
- **Purposeful Motion Inventory:**
  - **Hero scan cursor (`70ms/line`):** WAAPI (`el.animate`) vertical scan bar highlights risky lines sequentially on load and re-scans only once; clicking a finding focuses and highlights its line range.
  - **Fix diff-swap & SHA-256 seal (`pg-seal-stamp`):** `"Show fix"` flashes removed lines, transitions to pinned YAML, runs a fast pass, computes a real browser SHA-256 via `crypto.subtle.digest`, and scales-in (`1.06 → 1`) the **Verified** seal.
  - **Tabs sliding underline:** Measures active tab `offsetLeft` / `offsetWidth` and glides a `2px` verdigris bar smoothly on click or arrow keys.
  - **Scroll-driven How-It-Works line (`.pg-gate-line`):** CSS `animation-timeline: view()` inside `@supports` with `prefers-reduced-motion` immediate fallback.
  - **View Transitions API (`runViewTransition`):** Smooth theme switching and filter row reordering on supporting browsers.
  - **Dashboard Overlays (`LazyMotion` async `domMax`):** Dialog, Drawer, and Toasts animate softly via `motion/react` while keeping initial landing chunks small (`LandingPage` chunk `~26.5 kB` gzipped).

---

## 3. Verified Fixes & Edge Cases Closed

During live Chrome E2E verification (`LIVE_E2E_REPORT.md`) and code review, the following concrete bugs were identified and fixed:
1. **`useOptimistic` transition error in `FindingsTable.tsx`:** Wrapped `applyOptimistic` + backend mutation (and 6s Undo) inside React 19 `startTransition` — zero console errors remain.
2. **Mobile `360px` header wordmark clipping (`LandingNav.tsx`):** Wrapped header `"Connect repository"` inside `<div className="hidden sm:inline-flex">` so Tailwind utility precedence no longer overrides `hidden` over `Button`'s `inline-grid`.
3. **Radix `aria-hidden` focus race (`Overlay.tsx` + `ConnectRepositoryForm.tsx`):** Replaced `setTimeout(..., 40)` with synchronous `onOpenAutoFocus` targeting `#connect-repo-url`.
4. **Collapsed sidebar link names (`DashboardShell.tsx`):** Added `aria-label` when sidebar collapses to the `56px` icon rail.
5. **Playground parse-error badge (`PlaygroundSection.tsx`):** Displays `"Syntax error"` instead of `"Risk 40/100 · Grade C"` when YAML parsing fails, and supports clicking a finding to jump straight to that line in the editor.
6. **Cross-route hash scrolling (`LandingPage.tsx`):** Added `location.hash` `useEffect` so `/app/workflows` → `/#playground` scrolls cleanly to `#playground`.
7. **Oldest open finding calculation (`OverviewPage.tsx`):** Computed true oldest age across all open severities using `Math.min(...)` instead of taking `openEvents[openEvents.length - 1]`.

---

## 4. What Can Be Improved Next (Visual Polish, Animations & Remaining Tech Debt)

### A. Completed Visual & Landing Polish (Phases B–7)
1. **Self-Hosted Preloaded Fonts (`dashboard/public/fonts/`):** Copied Latin `@fontsource/instrument-sans` and `@fontsource/jetbrains-mono` `.woff2` subsets locally (`34,268 B` for preloaded 400+600 subsets) eliminating external Google Fonts CDN dependency.
2. **Playwright-Captured CSS-3D Preview Layers (`DashboardPreviewSection.tsx`):** Captured 12 `.webp` screenshots (light/dark, 1x/2x) from the live `/app` Overview routes paired with CSS `perspective: 1200px`, `preserve-3d`, and `@supports (animation-timeline: view())` depth separation plus 3 interactive DOM hotspot buttons.
3. **Orthographic Matte 3D Architecture & Ledger Scenes (`src/three/scenes/`):** Implemented `HeroGateScene` (synced via `heroScanStore`), `GateSequence3D`, `ArchitectureFlow3D`, `RuleCatalog3D`, `AttackPath3D`, and lazy route-scoped `LedgerArtifactScene3D`, all obeying zero-glow/zero-idle-GPU rules.
4. **Smooth `diff-swap` & Staggered `"Show fix"` Sequence:** `HeroScanDemo` now steps `fixedCount` top-to-bottom at `50ms` per row in sync with `HeroGateScene` and stamps `Seal` exclusively when `crypto.subtle` yields a real SHA-256 digest.

### B. Remaining Optional Polish & Backend Enhancements
1. **Real Repository Workflow Preview inside Pipelines (`/app/pipelines`):** When GitHub public resolution detects `.github/workflows/*.yml`, fetch and optionally run the browser YAML rules engine directly against the repo's real `ci.yml` inside a preview tab instead of waiting for CI runner ingestion.
2. **Overview `Run risk, last 14 days` Chart Anchor (`OverviewPage.tsx`):** Because backend `PipelineRun` rows (`backend/app/schemas/pipeline_run.py`) do not currently store a per-run `risk_score` column, the 5-point chart currently derives historical points from the current findings' average risk score. Adding a real backend `/api/runs/risk-series` endpoint (or `risk_score` field on `PipelineRun`) will turn this chart into true historical telemetry.
3. **Evidence Drawer Code Context (`FindingDrawer.tsx` + `utils.ts`):** Backend `SecurityEvent` rows store a single `description` string rather than exact file/line snapshots. Extending backend ingestion payloads with optional `file_path`, `line`, and `snippet` metadata would surface the commit's exact YAML lines inside the drawer.
4. **TypeScript ESLint Coverage (`eslint.config.js`):** Currently `npx tsc --noEmit` enforces strict checking on `.ts/.tsx` while ESLint covers `.js/.jsx` files. Adding `typescript-eslint` extends ESLint rules across `.ts/.tsx` once TypeScript 7 peer ranges stabilize.
