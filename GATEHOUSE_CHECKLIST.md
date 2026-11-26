# PipelineGuard Gatehouse (v2) — Implementation Checklist

> Tracks frontend execution against [DESIGN.md](./DESIGN.md). Backend (`backend/`, `security/`) remains completely untouched; the frontend rule engine and API contracts mirror the real Python backend. Live verification summary saved in [LIVE_E2E_REPORT.md](./LIVE_E2E_REPORT.md).

## Handoff State

- **Current Objective:** Complete (Tasks 0.1 through 9 + Gatehouse 3D Spec Phases 0–7 verified end-to-end; backend `backend/`, `security/`, API contracts, DB, and `dashboard/src/services/api.ts` untouched).
- **Modified / Created Files:**
  - `GATEHOUSE_CHECKLIST.md`, `LIVE_E2E_REPORT.md` — Checklist & full live E2E browser verification report.
  - **Tokens, Theme, Motion & Brand (`Task 1` `[x]`):**
    - `dashboard/index.html`, `dashboard/public/favicon.svg`, `dashboard/public/favicon-critical.svg`
    - `dashboard/src/styles/tokens.css`, `dashboard/src/index.css`
    - `dashboard/src/motion/{motion.ts,MotionProvider.tsx}`, `dashboard/src/app/theme.tsx`, `dashboard/src/ui/BrandMark.tsx`
  - **Shared TypeScript Rule Engine (`Task 2` `[x]`):**
    - `dashboard/src/rules/{schemas,severity,registry,parser,analyzer,sampleWorkflows,index}.ts`, `scanner.worker.ts`
    - `dashboard/scripts/verifyRules.ts`
  - **Accessible UI Primitives (`Task 3` `[x]`):**
    - `dashboard/src/ui/{Badge,Button,Input,Seal,Panel,Overlay,Tabs,Toast,index}.tsx`
  - **App Shell, Router, Typed API & Command Palette (`Task 4` `[x]`):**
    - `dashboard/src/app/{queryClient.ts,router.tsx}`, `dashboard/src/services/api.ts`, `dashboard/src/main.jsx`
    - `dashboard/src/features/shell/{navConfig.ts,ThemeSwitch.tsx,CommandPalette.tsx,TopBar.tsx,DashboardShell.tsx}`
    - *(Retired legacy `src/App.jsx`, `src/App.css`, `src/components/*`, `src/hooks/useDashboardData.js`, `src/services/api.js`, `src/assets/*`.)*
  - **Findings Feature (`Task 5` `[x]`):**
    - `dashboard/src/features/findings/{queries.ts,utils.ts,FindingsPage.tsx}`
    - `dashboard/src/features/findings/components/{NeedsAttentionQueue,FindingsTable,FindingDrawer}.tsx`
  - **Overview, Pipelines & Connect Repository (`Task 6` `[x]`):**
    - `dashboard/src/features/overview/OverviewPage.tsx`
    - `dashboard/src/features/pipelines/{schemas.ts,queries.ts,PipelinesPage.tsx}`
    - `dashboard/src/features/pipelines/components/{ConnectRepositoryForm,ConnectRepositoryDialog}.tsx`
  - **Landing Page (`/`) (`Task 7` `[x]`):**
    - `dashboard/src/features/landing/LandingPage.tsx`
    - `dashboard/src/features/landing/components/{LandingNav,HeroScanDemo,IncidentTabsSection,PlaygroundSection,HowItWorksSection,RulesCatalogSection,DashboardPreviewSection,FaqSection}.tsx`
  - **Remaining Dashboard Pages (`Task 8` `[x]`):**
    - `dashboard/src/features/incidents/IncidentsPage.tsx`
    - `dashboard/src/features/workflows/WorkflowsPage.tsx`
    - `dashboard/src/features/secrets/SecretsPage.tsx`
    - `dashboard/src/features/artifacts/ArtifactsPage.tsx`
    - `dashboard/src/features/runs/RunsPage.tsx`
    - `dashboard/src/features/audit/AuditLogPage.tsx`
    - `dashboard/src/features/settings/SettingsPage.tsx`
- **Next Immediate Step:** Ready for final review (`PHASE7_PROD=0`, `PHASE7_E2E=0`, `MANIFEST=0`, `VITEST=15/15`, `TSC=0`, `LINT=0`, `DESIGN.md` lint `0 errors`).
- **Blockers / Notes:**
  - Backend (`backend/`, `security/`) verified clean and untouched (`git diff --stat -- backend security` empty).
  - SQLite now holds live-tested `pipe-eventgenie` (from `https://github.com/jeevanL16/eventgenie`) plus audit records from live `OPEN` -> `RESOLVED` -> `OPEN` status transition tests.

---

## Task Checklist

### Phase 0: Dependencies & Environment
- [x] **0.1** Install runtime & dev npm packages and configure `tsconfig.json`, `vite-env.d.ts`, `eslint.config.js`.

### Task 1: Design Tokens, Typography, Theme Switcher, Motion & Brand Assets
- [x] **1.1** Create `src/styles/tokens.css` (dark + light `--pg-*` variables, `.pg-force-dark`, typography scale, spacing, shapes, elevation shadows, high contrast, forced-colors, reduced motion, CSS `view()` gate line).
- [x] **1.2** Update `dashboard/index.html` (inline pre-paint `data-theme` resolver script, Instrument Sans & JetBrains Mono Latin fonts with `display=swap`, Gate SVG favicon).
- [x] **1.3** Create `src/app/theme.tsx` (System / Light / Dark toggle + View Transitions + static critical favicon helper).
- [x] **1.4** Create `src/ui/BrandMark.tsx`, `dashboard/public/favicon.svg`, `dashboard/public/favicon-critical.svg`.
- [x] **1.5** Create `src/motion/motion.ts` and `src/motion/MotionProvider.tsx` (`LazyMotion` async `domMax` + `strict`).

### Task 2: Single Shared Rule Engine & Sample Workflows (`src/rules/`)
- [x] **2.1** Create `src/rules/schemas.ts` & `src/rules/severity.ts`.
- [x] **2.2** Create `src/rules/registry.ts` (`PG-WF-001`..`PG-WF-023` + `PG-WF-900` matching backend `security/workflow/rules.py`).
- [x] **2.3** Create `src/rules/parser.ts` (line-tracking `js-yaml` parser + structural `steps:` indentation errors) & `src/rules/analyzer.ts` (client-side workflow detector + suppression + risk formula).
- [x] **2.4** Create `src/rules/sampleWorkflows.ts` & `src/rules/scanner.worker.ts` (Web Worker for >200-line YAML).
- [x] **2.5** Verify rule engine with `dashboard/scripts/verifyRules.ts` (`ALL RULE ENGINE FIXTURE TESTS PASSED`).

### Task 3: Shared Accessible UI Component Library (`src/ui/`)
- [x] **3.1** Build `Button.tsx`, `Chip.tsx`, `Kbd.tsx`.
- [x] **3.2** Build `Badge.tsx` (custom 12px SVG severity shapes) & `Seal.tsx` (12-char SHA-256 + full digest copy + stamp animation).
- [x] **3.3** Build `Field` & `Select` (`src/ui/Input.tsx`).
- [x] **3.4** Build `Panel`, `CodePanel` (`forceDark`, line numbers, WAAPI cursor scan animation, severity border/tint, diff lines), `Skeleton`, `EmptyState`, `ErrorPanel` (`src/ui/Panel.tsx`).
- [x] **3.5** Build `Dialog` & `Drawer` (`src/ui/Overlay.tsx`, Radix `onOpenAutoFocus` focus management).
- [x] **3.6** Build `Tabs` (sliding verdigris underline + Radix keyboard nav) & `Tooltip` (`src/ui/Tabs.tsx`).
- [x] **3.7** Build `ToastProvider` (`src/ui/Toast.tsx`).

### Task 4: Router, Query Client, Auth & Dashboard Shell
- [x] **4.1** Create `src/app/queryClient.ts`, `src/app/router.tsx` (lazy routes for `/` Landing & `/app/*` Dashboard), `src/services/api.ts`, and wire `src/main.jsx`.
- [x] **4.2** Build `DashboardShell.tsx` & `navConfig.ts` (grouped collapsible sidebar `232px` / `56px` / `<640px` mobile drawer with `aria-label` on icon links).
- [x] **4.3** Build `TopBar.tsx` & `ThemeSwitch.tsx` (static Connected/Degraded after 2 failures, `Updated Xs ago`, 15s polling paused in background).
- [x] **4.4** Build `CommandPalette.tsx` (`cmdk` + Radix Dialog, Recent + Findings + Pipelines + Pages + Actions).

### Task 5: Findings Feature (`src/features/findings/`)
- [x] **5.1** Create `queries.ts` & `utils.ts` (per-feature TanStack Query + optimistic status mutation with rollback & audit log invalidation).
- [x] **5.2** Build `NeedsAttentionQueue.tsx` (ranked strictly severity first, then age) & URL-synced filter chips in `FindingsPage.tsx`.
- [x] **5.3** Build `FindingsTable.tsx` (`@tanstack/react-table/legacy`, sticky header, `aria-sort`, density toggle `28/36/44px`, `j`/`k`/`Enter` keyboard nav, `useOptimistic` + `startTransition`, 600ms `row-flash`, 6s Undo toast).
- [x] **5.4** Build `FindingDrawer.tsx` (URL-synced `?finding=...`, `CodePanel` evidence snippet, suggested fix diff, rule metadata, status history).
- [x] **5.5** Wire optimistic status change with `useOptimistic`, Undo toast, and static critical favicon sync.

### Task 6: Overview, Pipelines & Connect Repository Progressive Form
- [x] **6.1** Build `ConnectRepositoryForm.tsx` & `ConnectRepositoryDialog.tsx` (React 19 `<form action>` + `useActionState`, Zod schema, autofocus URL, `type="url"`, progressive resolve disclosure + GitHub fallback, blur-first + clear-on-fix validation, 1-error focus vs 2+-error top summary, dirty-close confirm, pending locked fields).
- [x] **6.2** Build `OverviewPage.tsx` (first-run onboarding panel when 0 pipelines; otherwise ranked Needs Attention queue, plain-text posture summary + stacked severity bar with shape+color labels, single-line Recharts Run Risk chart with threshold line & direct labels, no KPI cards/gradients).
- [x] **6.3** Build `PipelinesPage.tsx` (pipelines grid, Connect repository modal restoring focus to opener, first-scan checklist steps).

### Task 7: Gatehouse Landing Page (`/`)
- [x] **7.1** Build `LandingNav.tsx` (56px sticky header with clean `360px` mobile stacking).
- [x] **7.2** Build `HeroSection` & `HeroScanDemo.tsx` (always-dark `CodePanel`, WAAPI scan cursor `70ms/line`, staggered finding enter, single polite `aria-live` announcement, cross-highlighting, `"Show fix"` diff-swap + fast re-scan, real `crypto.subtle.digest` SHA-256 `"Verified"` Seal, `"Run scan again"`, reduced-motion immediate state).
- [x] **7.3** Build `IncidentTabsSection.tsx` (3 attack tabs including built vs published 12-char digests).
- [x] **7.4** Build `PlaygroundSection.tsx` (line-numbered YAML textarea, 300ms debounce, Web Worker for >200 lines, 3 sample buttons, line parse error reporting + `"Syntax error"` badge, browser-local copy, embedded Connect form).
- [x] **7.5** Build `HowItWorksSection.tsx` (scroll-driven `.pg-gate-line`), `RulesCatalogSection.tsx` (filterable rules table + View Transitions reorder), `DashboardPreviewSection.tsx` (3 focusable hotspots), `FaqSection.tsx` (`<details>`), and centered Final CTA Connect form.

### Task 8: Remaining Dashboard Pages
- [x] **8.1** Build `IncidentsPage.tsx`.
- [x] **8.2** Build `WorkflowsPage.tsx` (real 23 active workflow rules reference aligned with `src/rules/registry.ts`).
- [x] **8.3** Build `SecretsPage.tsx` (secret pattern rules aligned with `security/secrets/severity.py` + filtered secret findings).
- [x] **8.4** Build `ArtifactsPage.tsx` (interactive browser SHA-256 verifier via `crypto.subtle.digest` aligned with `artifact_verifier.py` + `Seal`).
- [x] **8.5** Build `RunsPage.tsx`, `AuditLogPage.tsx`, and `SettingsPage.tsx` (connection test table with Request / Status / Response time ms, theme selector, optional JWT sign-in form).

### Task 9: Final Verification & Quality Gates
- [x] **9.1** Copy & Token Hygiene Audit (self-hosted Latin `.woff2` fonts in `dashboard/public/fonts/`, zero stray hex values in components, `npx --yes --package=@google/design.md designmd lint DESIGN.md` = `0 errors`).
- [x] **9.2** Verify `tsc --noEmit`, `npm run lint`, `npm test -- --run` (15/15 Vitest unit tests), `npm run build` (`vite build`), `node scripts/checkManifest3D.mjs` (`248.92 KiB` combined lazy 3D gz, `isolationPassed: true`), and `verifyRules.ts`.
- [x] **9.3** Live end-to-end Chrome verification across Landing (`/`), Light/Dark themes, `360×800` responsive viewport, live connection of `https://github.com/jeevanL16/eventgenie`, all `/app/*` routes, Command Palette, keyboard navigation, Drawer, status transitions, and zero console errors after final edits.
- [x] **9.4** Write [LIVE_E2E_REPORT.md](./LIVE_E2E_REPORT.md) and finalize [GATEHOUSE_CHECKLIST.md](./GATEHOUSE_CHECKLIST.md).

### Task 10: Gatehouse 3D Layer (`GATEHOUSE_3D_LAYER_SPEC.md` Phases 0–7)
- [x] **10.0 (Phase 0)** Install `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `vitest`, `playwright`; enable `build.manifest: true`; implement `src/three/core/*` (`Scene3D`, `useScene3DMode`, `liveCanvasBudget`, `useGatehouseTheme`, `useSectionProgress`, `useInvalidateWhile`, `useProjectedAnchors`, `motion3d`, `shading`, `glyphs`) and bundle isolation checker `dashboard/scripts/checkManifest3D.mjs`.
- [x] **10.1 (Phase 1)** Implement `GateSequence3D` (`src/three/scenes/GateSequence3D/`) in `HowItWorksSection.tsx` with single-draw vertex-shaded slabs, exported `CI_GATE_THRESHOLD = 70`, and DOM station fallback parity.
- [x] **10.2 (Phase 2)** Implement `heroScanStore` + `HeroGateScene` synced to `HeroScanDemo` (`50ms` per-row `"Show fix"` stagger, real `crypto.subtle` digest Seal with zero `000000000000` placeholder).
- [x] **10.3 (Phase 3)** Implement `ArchitectureFlow3D` (`graph.ts`, `ArchitectureSection.tsx`, `"Trace a finding"`, `"Isometric"` / `"Flat"` toggle, `sr-only` focusable stage list) + Vitest graph tests.
- [x] **10.4 (Phase 4)** Implement `RuleCatalog3D` (`RulesCatalogSection.tsx`) and `AttackPath3D` (`incidentPaths.ts`, `IncidentTabsSection.tsx`, `"Without guard"` / `"With guard"` toggle).
- [x] **10.5 (Phase 5)** Implement `DashboardPreview3D` (CSS `perspective: 1200px` + `view()` scroll-driven cards with 12 Playwright-captured light/dark 1x/2x `.webp` screenshots under `dashboard/public/images/preview/`).
- [x] **10.6 (Phase 6)** Reuse `LedgerChain3D` as lazy route-scoped `LedgerArtifactScene3D` on `ArtifactsPage` driven by the user's real Web Crypto digest, keeping `/app`, `/app/findings`, `/app/pipelines`, and `/app/runs` free of Three.js chunks.
- [x] **10.7 (Phase 7)** Pass full §9 Playwright verification (`verifyPhase7Full.mjs` `prod` + `e2e`: 5s idle GPU frame check = `0` frames, static pose determinism diff `0`, keyboard operability, fallbacks, zero console errors across `/` and `/app/*`) and update all project reports & `dashboard/docs/BUILD_TRACKER.md`.
