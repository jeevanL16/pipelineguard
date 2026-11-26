# PipelineGuard Frontend Build Tracker

> Source of truth: [DESIGN.md](../../DESIGN.md) and [GATEHOUSE_3D_LAYER_SPEC.md](../../GATEHOUSE_3D_LAYER_SPEC.md).

## 1. Status Table

| Phase | Status | Started | Finished | Commit |
| --- | --- | --- | --- | --- |
| Phase A — Audit vs DESIGN.md | Done | 2026-11-26 | 2026-11-26 | pending commit |
| Phase B — Fix DESIGN.md Gaps | Not started | — | — | — |
| 3D Phase 0 — Toolchain, Bundle & Assets | Not started | — | — | — |
| 3D Phase 1 — Core Canvas & Theme | Not started | — | — | — |
| 3D Phase 2 — HeroGateScene | Not started | — | — | — |
| 3D Phase 3 — Architecture & Rules 3D | Not started | — | — | — |
| 3D Phase 4 — AttackPath3D | Not started | — | — | — |
| 3D Phase 5 — DashboardPreview & Ledger | Not started | — | — | — |
| 3D Phase 6 — Motion, A11y & Perf Audit | Not started | — | — | — |
| 3D Phase 7 — Verification & Cleanup | Not started | — | — | — |

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

## 5. Blockers and Next Action

- **Blockers:** None.
- **Next action:** Commit Phase A (`phase A: audit frontend against DESIGN.md`) and begin **Phase B** fixing Audit Findings A1–A14 cleanly in `dashboard/` while keeping `backend/`, `security/`, and `services/api.ts` untouched.
