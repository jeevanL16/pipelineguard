# PipelineGuard Gatehouse (v2): Frontend Architecture, Report & Improvement Guide

> **Stack:** React 19 + TypeScript + Vite 8.3 + Tailwind CSS v4 + TanStack Query v5 + TanStack Table v9 (`/legacy` adapter) + Radix UI (`dialog`, `tabs`, `tooltip`, `select`) + `cmdk` + Motion (`LazyMotion`) + Zod + `js-yaml`  
> **Directory:** `dashboard/src/`  
> **Design Spec:** [DESIGN.md](./DESIGN.md)  
> **Live Test Report:** [LIVE_E2E_REPORT.md](./LIVE_E2E_REPORT.md)

---

## 1. Current Architecture & Module Map

```text
dashboard/src/
├── main.jsx                          # Entrypoint mounting <AppRouter />
├── index.css                         # Tailwind v4 + DESIGN.md CSS tokens
├── styles/tokens.css                 # Semantic --pg-* dark/light tokens, .pg-force-dark, typography, view() gate line
├── motion/
│   ├── motion.ts                     # MOTION timing/easing constants + runViewTransition()
│   └── MotionProvider.tsx            # Async LazyMotion (domMax strict mode)
├── app/
│   ├── theme.tsx                     # System / Light / Dark switcher + static critical favicon sync
│   ├── queryClient.ts                # TanStack Query (15s polling, paused in hidden tabs)
│   └── router.tsx                    # Lazy code-split routes for / and /app/*
├── rules/                            # Shared pure TypeScript rule engine (zero UI imports)
│   ├── schemas.ts                    # Zod schemas (Rule, WorkflowFinding, AnalysisResult)
│   ├── severity.ts                   # Single mapping: severity -> color var, SVG shape, order, weight
│   ├── registry.ts                   # PG-WF-001..023 + PG-WF-900 aligned with security/workflow/rules.py
│   ├── parser.ts                     # js-yaml line-tracking parser + steps: structural error locator
│   ├── analyzer.ts                   # Detectors + # pipelineguard-ignore + risk/grade scoring
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
    ├── landing/                      # Public route / (isolated from Recharts/Query/Table bundles)
    │   ├── LandingPage.tsx
    │   └── components/               # LandingNav, HeroScanDemo, IncidentTabsSection, PlaygroundSection,
    │                                 # HowItWorksSection, RulesCatalogSection, DashboardPreviewSection, FaqSection
    ├── shell/                        # DashboardShell (232px/56px/mobile drawer), TopBar, CommandPalette, ThemeSwitch
    ├── overview/OverviewPage.tsx     # Needs Attention queue, Open Now bar, Run Risk line chart, First-run guide
    ├── findings/                     # FindingsPage, NeedsAttentionQueue, FindingsTable, FindingDrawer, queries, utils
    ├── incidents/IncidentsPage.tsx   # High/Critical active incident queue sharing drawer
    ├── workflows/WorkflowsPage.tsx   # 23 active workflow rules table + category/severity chips
    ├── secrets/SecretsPage.tsx       # Masked secret findings + security/secrets/severity.py rules
    ├── artifacts/ArtifactsPage.tsx   # Web Crypto SHA-256 verifier + session log
    ├── pipelines/                    # PipelinesPage + ConnectRepositoryForm (useActionState + Zod) + Dialog
    ├── runs/RunsPage.tsx             # Sortable execution history table
    ├── audit/AuditLogPage.tsx        # Sortable immutable audit trail linking back to Findings drawer
    └── settings/SettingsPage.tsx     # Live latency diagnostics table, ThemeSwitch, optional JWT login
```

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

### A. Visual & Landing Page Polish (Within Gatehouse Calm Aesthetic)
1. **Real Repository Workflow Preview inside Pipelines (`/app/pipelines`):** When GitHub public resolution detects `.github/workflows/*.yml`, fetch and optionally run the browser YAML rules engine directly against the repo's real `ci.yml` inside a preview tab instead of waiting for CI runner ingestion.
2. **Real Syntax Token Coloring inside `CodePanel`:** Currently `CodePanel` highlights line numbers, diff annotations, and severity ranges on monospace text cleanly. Lightweight keyword coloring for YAML keys (`on:`, `permissions:`, `uses:`, `run:`, `${{ ... }}`) using semantic muted/text/verdigris CSS vars would make code inspection significantly faster to scan visually.
3. **Captured Real Dashboard Screenshot in `DashboardPreviewSection.tsx`:** Per `DESIGN.md` Quality Gates, run Playwright CI screenshots of the real dashboard in both light & dark modes rather than a static JSX structural preview, overlaid with the 3 interactive keyboard-focusable hotspots.
4. **Smooth `diff-swap` Line Transition in `HeroScanDemo`:** Right now `"Show fix"` flips cleanly after `200ms`; adding a keyed per-line subtle height/opacity transition cleanly reveals removed vs added lines even more legibly.
5. **Hero Font Preloading & Self-Hosting (`<60 KB` Budget):** Currently Google Fonts (`Instrument Sans` + `JetBrains Mono`) are linked over CDN; self-hosting subsetted `.woff2` files locally guarantees zero external font latency and works completely offline.

### B. Remaining Technical / UX Gaps
1. **Overview `Run risk, last 14 days` Chart Anchor (`OverviewPage.tsx` lines 78–92):** Because backend `PipelineRun` rows (`backend/app/schemas/pipeline_run.py`) do not currently store a per-run `risk_score` column, the 5-point chart currently derives historical points (`mean - 12` .. `mean`) from the current findings' average risk score. Adding a real backend `/api/runs/risk-series` endpoint (or `risk_score` field on `PipelineRun`) will turn this chart into true historical telemetry.
2. **Evidence Drawer Code Context (`FindingDrawer.tsx` + `utils.ts`):** Backend `SecurityEvent` rows store a single `description` string rather than the exact line number or workflow file snapshot. Right now `FindingDrawer` renders `rule.example` from `registry.ts` paired with the finding's `source` and `pipeline_id`. Extending the backend finding ingestion payload with optional `file_path`, `line`, and `snippet` metadata would show the user's exact commit snippet inside the drawer.
3. **Interactive Accessibility (`axe-core`) & Snapshot CI Gate:** Add `@playwright/test` + `@axe-core/playwright` scripts under `dashboard/` to automate light/dark `360px` screenshots, contrast checks, and reduced-motion verification in CI.
4. **TypeScript ESLint Coverage (`eslint.config.js`):** Currently `tsc --noEmit` checks `.ts/.tsx` while ESLint runs over `.js/.jsx` files. Adding `typescript-eslint` extends React Hooks / unused variable linting across `.ts/.tsx` as well.
