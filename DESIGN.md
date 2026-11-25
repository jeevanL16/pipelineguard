---
version: alpha
name: PipelineGuard Gatehouse
description: Design system for the PipelineGuard landing page and dashboard. Evidence-first, calm, dense where analysts work and quiet everywhere else. The product is the visual; nothing is decoration.
---

# PipelineGuard design system: Gatehouse (v2)

Last reviewed 2026-11-25. Built on the v1 Gatehouse concept and the current frontend catalog, then extended after checking the DESIGN.md spec, current browser support and current form-UX research (see Sources).

## Overview

**Concept.** A pipeline is a sequence of gates. PipelineGuard is the inspector at each gate: it reads the workflow, checks the secrets, verifies the artifact and writes down what it decided. The interface behaves like an inspection record, not a sci-fi control room. Its working vocabulary is lines of YAML, findings, fixes, digests and a signed-off record.

**What "non-AI" means here.** Two things. First, no AI claims, sparkle icons, chat widgets or "AI-powered" copy anywhere. Second, none of the visual tells of generated pages: glass cards, gradient text, glow, identical rounded card grids, fade-and-slide on every section, tracked-out all-caps eyebrows, numbered lists that are not sequences. Beauty comes from real content (actual YAML, actual findings, actual digests), precise type, tonal depth and one well-made animated moment.

**Audience.** Developers and security engineers who read YAML for a living and distrust security marketing. They want to see a real finding on a real line before they read a claim, and they want to try the tool before they sign up.

**Feel.** Precise, calm, dense where people work (tables, findings), spacious where people decide (landing page, forms). Nothing glows, pulses, floats or loops.

**The one memorable thing.** The hero is a live inspection of a workflow file. A scan cursor walks down the YAML, flags risky lines and the findings appear beside them. "Show fix" turns the flagged lines into a diff, a fast re-scan runs, and a verification seal stamps in carrying the real SHA-256 of the corrected file, computed in the browser. Everything else on the page stays quiet so that moment lands. The second interactive surface, the Playground, lets a visitor paste their own workflow and get findings from the same rule engine.

**Colour meaning.** Verdigris (the brand colour) appears only when something is verified, protected or actionable. Warm severity colours mean stop. The two never swap roles, so the colour of a thing always tells you its state.

**What changes from the current frontend** (cyber-dark glass, cyan/indigo/rose, pulsing radar dots):

| Current | Gatehouse |
|---|---|
| `#0a0e17` navy canvas, cyan and indigo gradients | Petrol-slate canvas, one brand colour, no gradients |
| Glassmorphic cards, glow, blur | Tonal layers and 1px lines; shadow only on overlays |
| Pulsing "Live Guard Active", radar pulse, "Telemetry Live" | Static status plus "Updated 12s ago". No idle motion |
| Hero banner with a big risk number | "Needs attention" queue ranked by severity, then age |
| Dual-area gradient chart | One line, one threshold, labelled endpoints |
| Eight page names in the tree, ten in the sidebar, two names per page | One canonical name per concept (see Voice) |
| Custom history manager in `App.jsx` | URL-driven router, lazy route per feature |
| One central `useDashboardData` hook | Per-feature queries with background refresh and optimistic updates |
| Static marketing sections | A working demo (hero scan) and a working tool (Playground) |

**Assumptions to confirm before building.**

- Workflows are GitHub Actions YAML (rules `PG-WF-001` to `PG-WF-006` target them).
- The sample rule names in this file are placeholders. Replace them with the real rule names and IDs from the backend. The hero demo, Playground, rules catalog and Findings table must all read the same rule definitions.
- The backend exposes the endpoints listed in Architecture. `GET /api/repositories/resolve` (used by the Connect repository form) is new; if it does not exist, the form falls back to three plain fields.
- The Playground copy says "Runs in your browser" only if the scan really runs client-side. If it calls the API, the copy must say so.

## Colors

Dark is the reference theme for the dashboard. Both themes ship from the same token names, follow `prefers-color-scheme`, and have a three-way toggle (System, Light, Dark). The landing hero code panel stays dark in both themes. Top-level `primary`, `primary-hover` and `on-primary` are the dark-theme values; `colors.light.*` overrides them.

- **Primary, verdigris (#5CC9B0 dark, #0B6F5F light):** verified, protected, primary action, focus ring, links, the verification seal.
- **Canvas, petrol (#0E181D dark, #F4F7F6 light):** page background. A cool paper in light mode, not cream.
- **Panel (#142329 dark, #FFFFFF light):** tables, forms, drawers, dialogs.
- **Raised (#1B2F36 dark, #E8EEEC light):** hover rows, selected chips, toasts, tooltips.
- **Text, bone (#E9EFEC dark, #10201F light):** body and headings. Muted text is for secondary information only.
- **Severity set:** critical red, high orange, medium amber, low blue, info grey. Each is always paired with a text label and an icon shape. Colour is never the only signal.

```yaml
colors:
  primary: "#5CC9B0"
  primary-hover: "#7FD6C2"
  on-primary: "#0A1317"
  scrim: "rgba(0, 0, 0, 0.6)"
  dark:
    canvas: "#0E181D"
    panel: "#142329"
    raised: "#1B2F36"
    line: "#2A4048"
    line-strong: "#628089"
    text: "#E9EFEC"
    text-muted: "#93A8AD"
    critical: "#FF7A7A"
    high: "#FF9F5A"
    medium: "#F0C75E"
    low: "#7FB2E5"
    info: "#93A8AD"
    pass: "#5CC9B0"
    critical-tint: "#3A3136"
    high-tint: "#3A3731"
    medium-tint: "#373D31"
    low-tint: "#253A47"
    pass-tint: "#203E3F"
  light:
    primary: "#0B6F5F"
    on-primary: "#FFFFFF"
    canvas: "#F4F7F6"
    panel: "#FFFFFF"
    raised: "#E8EEEC"
    line: "#CBD6D3"
    line-strong: "#6F8782"
    text: "#10201F"
    text-muted: "#4A5F5C"
    critical: "#C4262E"
    high: "#A94A0C"
    medium: "#8A6410"
    low: "#1F5FA8"
    info: "#4A5F5C"
    pass: "#0B6F5F"
    critical-tint: "#F9E9EA"
    high-tint: "#F6EDE7"
    medium-tint: "#F3F0E7"
    low-tint: "#E9EFF6"
    pass-tint: "#E7F1EF"
```

Contrast rules: every text pair is at least 4.5:1 on the surface it is used on, and `line-strong` is at least 3:1 against panel and canvas so input borders stay visible. Light `high` text must not be placed on `raised`. Run `npx @google/design.md lint DESIGN.md` after any colour change.

Theme switching: generate CSS variables from the `light` and `dark` groups under `:root[data-theme="light"]` and `:root[data-theme="dark"]`, with a `prefers-color-scheme` default when no choice is stored. An inline script in `index.html` sets `data-theme` before first paint so there is no flash. Support `forced-colors` and `prefers-contrast: more` (stronger `line`, no tints as the only separator).

## Typography

One family for reading, one for literal machine strings. The headline itself is the visual element on the landing page.

- **Instrument Sans** for headlines, interface and body. Display sizes use weight 600 with tight tracking.
- **JetBrains Mono** only for things that are literally code or machine output: YAML, commands, SHA-256 digests, run IDs, rule IDs. Never for generic labels or decoration.
- Sentence case everywhere. No all-caps labels, no tracked-out eyebrows.
- Line length under 68 characters for prose. Tables use tabular numerals.
- Load both from Google Fonts (or self-host) with `font-display: swap`, subset to Latin, and preload only the 600 and 400 weights of Instrument Sans. Define a metric-matched fallback (`size-adjust`) so the swap does not shift layout.
- Code uses ligatures off. Line numbers in code are `text-muted`, right-aligned, non-selectable.

```yaml
typography:
  display-xl:
    fontFamily: Instrument Sans
    fontSize: 64px
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: -0.03em
  display-lg:
    fontFamily: Instrument Sans
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Instrument Sans
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Instrument Sans
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Instrument Sans
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
  body-lg:
    fontFamily: Instrument Sans
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: Instrument Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Instrument Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-lg:
    fontFamily: Instrument Sans
    fontSize: 15px
    fontWeight: 500
    lineHeight: 1
  label-md:
    fontFamily: Instrument Sans
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.2
  label-sm:
    fontFamily: Instrument Sans
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.01em
  data-md:
    fontFamily: Instrument Sans
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "'tnum' 1"
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.65
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  sm:
    display-xl:
      fontFamily: Instrument Sans
      fontSize: 40px
      fontWeight: 600
      lineHeight: 1.05
      letterSpacing: -0.03em
    display-lg:
      fontFamily: Instrument Sans
      fontSize: 34px
      fontWeight: 600
      lineHeight: 1.1
      letterSpacing: -0.025em
    headline-lg:
      fontFamily: Instrument Sans
      fontSize: 26px
      fontWeight: 600
      lineHeight: 1.2
      letterSpacing: -0.02em
```

## Layout

Fixed max-width content (1200px) on the landing page, fluid full-width on the dashboard. Left-aligned text everywhere; nothing is justified, and only the final call to action is centered. 4px base unit; section spacing 96px on the landing page (64px below 640px), 24px between dashboard panels. Design the 360px layout first.

```yaml
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  section: 96px
  gutter: 24px
  margin: 24px
  content-max: 1200px
  prose-max: 40rem
  sidebar: 232px
  sidebar-collapsed: 56px
  row-compact: 28px
  row-default: 36px
  row-comfortable: 44px
```

Breakpoints: `sm` below 640px (single column, drawer navigation), `md` 640 to 1023px, `lg` 1024 to 1279px, `xl` 1280px and up. Hero panels sit side by side from `lg` (code 7 columns, findings 5) and stack below it. Wide content (code, tables) scrolls inside its own container; the page body never scrolls sideways. Respect safe-area insets on phones.

## Elevation & Depth

Depth comes from tonal layers: canvas, then panel, then raised. Separation is a 1px `line`, not a shadow. Only overlays (dialog, drawer, command palette, toast) get a shadow, `0 12px 40px rgba(0,0,0,0.45)` in dark and `0 12px 40px rgba(16,32,31,0.18)` in light, over a flat `scrim`. No backdrop blur on cards, no glow, no gradient washes, no noise textures.

## Shapes

Radius follows hierarchy rather than one value everywhere. Inline code, chips, badges and the seal use `sm`, controls use `md`, panels and dialogs use `lg`. Tables inside a panel have square cell edges. Drawers are square on the screen edge. Status dots are `full`. Severity icon shapes are fixed (see Components) and never rounded into circles.

```yaml
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 14px
  full: 9999px
```

## Motion & Micro-interaction

Idle motion is expensive in a tool people watch all shift, so nothing loops and nothing pulses. Motion appears in two places: a small number of orchestrated moments on the landing page, and responses to what the person just did (open, expand, confirm, change status). Animate only `transform` and `opacity`, plus single-shot background colour changes for row flashes. Honor `prefers-reduced-motion` by rendering the final state immediately; the scan still completes, it just does not travel.

**Implementation order (current browser support).** Scroll-driven animations (`animation-timeline: scroll()` and `view()`) became Baseline "newly available" in October 2026 with Chrome 115+, Safari 26+ and Firefox 159+, so scroll-linked effects are CSS-first. Still wrap them in `@supports (animation-timeline: view())` and make the no-support fallback the finished state, not a broken one. Same-document View Transitions are a progressive enhancement for reorder and theme changes. Landing page: CSS and the Web Animations API first, no animation library unless a moment truly needs one. Dashboard: Motion (`motion/react`) with `LazyMotion` for presence and layout animation, loading `domMax` only where layout animation is used (it is the larger feature bundle; the lighter `domAnimation` covers presence, variants and gestures).

| Moment | Trigger | Token | Tech | Reduced motion |
|---|---|---|---|---|
| Hero scan | Page load, once; replay is a button | `scan-line` per line, `surface-enter` for findings (60ms stagger) | WAAPI plus class toggles | Final state rendered |
| Hero fix and re-scan | "Show fix" | `diff-swap`, then `scan-line` over changed lines only | WAAPI | Diff shown instantly |
| Verification seal | Re-scan completes with zero findings | `seal-stamp` once | CSS | Seal visible at once |
| Finding to line highlight | Hover or focus on either side | `state-change` | CSS | Same, it is instant |
| Incident tabs | Click or arrow keys | `surface-enter` and `surface-exit`; underline slides on a measured transform | CSS plus a few lines of JS | Swap without movement |
| Playground results | Paste or edit (300ms debounce) | `surface-enter` on new findings only | CSS | No movement |
| How-it-works gate line | Scroll position (a real sequence) | Scroll-linked, linear, no easing | CSS `view()` timeline | Line fully drawn |
| Rules catalog filter reorder | Chip toggled | `view-change` through View Transitions | View Transitions API | Instant reorder |
| Dashboard preview hotspots | Hover or focus | `state-change` | CSS | Same |
| Dialog and drawer | Open and close | `surface-enter` and `surface-exit` | Motion presence | Fade only |
| Status change on a finding | Select option | `row-flash` once | CSS | Static highlight for 600ms |
| Toast | Action result | `surface-enter` | Motion presence | Fade only |
| Theme change | Toggle | `view-change` through View Transitions where supported | View Transitions API | Instant |
| Route change | Navigation | `view-change`, progressive enhancement | View Transitions API | Instant |

Not animated: section entrances on scroll, card hover lifts, counters that count up on load, parallax, background effects, custom cursors, looping anything.

```yaml
motion:
  state-change:
    duration: 120ms
    delay: 0ms
    timingFunction: ease-out
  surface-enter:
    duration: 240ms
    delay: 0ms
    timingFunction: cubic-bezier(0.2, 0, 0, 1)
  surface-exit:
    duration: 160ms
    delay: 0ms
    timingFunction: cubic-bezier(0.3, 0, 1, 1)
  row-flash:
    duration: 600ms
    delay: 0ms
    timingFunction: ease-out
  scan-line:
    duration: 70ms
    delay: 0ms
    timingFunction: linear
  diff-swap:
    duration: 200ms
    delay: 0ms
    timingFunction: ease-in-out
  seal-stamp:
    duration: 240ms
    delay: 0ms
    timingFunction: cubic-bezier(0.2, 0, 0, 1)
  view-change:
    duration: 200ms
    delay: 0ms
    timingFunction: ease-in-out
```

The seal stamps by scaling from 1.06 to 1 while fading in. It does not bounce, rotate or glow.

## Voice & Content Strategy

- **Tone of voice:** plain, specific, calm. Say what the tool checks and what it found. No "AI-powered", no "next-generation", no exclamation marks, no fear copy.
- **Capitalization:** sentence case in headings, buttons, labels and menus.
- **Terminology, one word per concept:**

| Use | Replaces |
|---|---|
| Findings | Threat events, Threats |
| Incidents | Incident desk |
| Workflows | Workflow guard, Workflow security |
| Secrets | Secrets scanner |
| Artifacts | Artifact integrity |
| Pipelines, Runs | (unchanged) |
| Audit log | Audit ledger |
| Rule (`PG-WF-003`) | Check, detector |

- **Buttons name the outcome:** "Connect repository", "Mark resolved", "Run scan again", "Show fix". Never "Submit" or "OK". The toast repeats the verb: "Repository connected".
- **Errors** say what failed and what to do next, without apologizing: "Branch `main` was not found in acme/api. Check the name or pick another branch."
- **Empty states** say what belongs there and give the action: "No pipelines yet. Connect a repository to start scanning its workflows."
- **Numbers and time:** `YYYY-MM-DD` in tables, relative time ("3m ago") in feeds, digests shortened to the first 12 characters with a copy button for the full value.
- **No invented proof.** Until real customers exist, the proof line states what the product checks today. No fake logos, quotes or statistics. The hero workflow is labelled "Sample workflow".
- **Claims must match behavior.** "Runs in your browser", "Nothing is uploaded" and "Read-only access" are written only when they are literally true.

Landing copy to start from (edit to match the real rules):

- Headline: "Catch risky workflow changes before they run."
- Sub: "PipelineGuard reads your GitHub Actions workflows, flags unpinned actions, exposed secrets and unverified artifacts, and records every decision in an audit log."
- Buttons: "Connect repository" (primary), "Scan a workflow here" (secondary, jumps to the Playground).
- Proof line: "Six workflow rules, a secret-signature scan and SHA-256 artifact verification run on every push."

## Components

Tokens below are written against the dark theme; the light theme uses the same names under `colors.light`, so implement components with semantic CSS variables (`--pg-panel`, `--pg-text`) that the theme switch re-points. Borders are 1px `line` (inputs use `line-strong`) and are specified in prose because the token schema has no border property.

```yaml
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 16px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.dark.raised}"
    textColor: "{colors.dark.text}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 16px
  button-danger:
    backgroundColor: "{colors.dark.critical}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 16px
  input-default:
    backgroundColor: "{colors.dark.panel}"
    textColor: "{colors.dark.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 12px
  input-error:
    backgroundColor: "{colors.dark.panel}"
    textColor: "{colors.dark.critical}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 12px
  panel:
    backgroundColor: "{colors.dark.panel}"
    textColor: "{colors.dark.text}"
    rounded: "{rounded.lg}"
    padding: 24px
  dialog:
    backgroundColor: "{colors.dark.panel}"
    textColor: "{colors.dark.text}"
    rounded: "{rounded.lg}"
    padding: 24px
  drawer:
    backgroundColor: "{colors.dark.panel}"
    textColor: "{colors.dark.text}"
    rounded: "{rounded.none}"
    padding: 24px
  code-panel:
    backgroundColor: "{colors.dark.canvas}"
    textColor: "{colors.dark.text}"
    typography: "{typography.code-md}"
    rounded: "{rounded.lg}"
    padding: 16px
  code-line-critical:
    backgroundColor: "{colors.dark.critical-tint}"
    textColor: "{colors.dark.text}"
    typography: "{typography.code-md}"
  code-line-high:
    backgroundColor: "{colors.dark.high-tint}"
    textColor: "{colors.dark.text}"
    typography: "{typography.code-md}"
  code-line-medium:
    backgroundColor: "{colors.dark.medium-tint}"
    textColor: "{colors.dark.text}"
    typography: "{typography.code-md}"
  diff-removed:
    backgroundColor: "{colors.dark.critical-tint}"
    textColor: "{colors.dark.text}"
    typography: "{typography.code-md}"
  diff-added:
    backgroundColor: "{colors.dark.pass-tint}"
    textColor: "{colors.dark.text}"
    typography: "{typography.code-md}"
  table-row-hover:
    backgroundColor: "{colors.dark.raised}"
    textColor: "{colors.dark.text}"
    typography: "{typography.data-md}"
    height: 36px
  nav-item-active:
    backgroundColor: "{colors.dark.raised}"
    textColor: "{colors.dark.text}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: 36px
  chip:
    backgroundColor: "{colors.dark.panel}"
    textColor: "{colors.dark.text-muted}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.sm}"
    height: 28px
    padding: 8px
  chip-selected:
    backgroundColor: "{colors.dark.raised}"
    textColor: "{colors.dark.text}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.sm}"
    height: 28px
    padding: 8px
  tab:
    backgroundColor: "{colors.dark.panel}"
    textColor: "{colors.dark.text-muted}"
    typography: "{typography.label-md}"
    height: 40px
    padding: 16px
  tab-active:
    backgroundColor: "{colors.dark.panel}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    height: 40px
    padding: 16px
  kbd:
    backgroundColor: "{colors.dark.raised}"
    textColor: "{colors.dark.text-muted}"
    typography: "{typography.code-sm}"
    rounded: "{rounded.sm}"
    padding: 4px
  badge-critical:
    backgroundColor: "{colors.dark.critical-tint}"
    textColor: "{colors.dark.critical}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.sm}"
  badge-high:
    backgroundColor: "{colors.dark.high-tint}"
    textColor: "{colors.dark.high}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.sm}"
  badge-medium:
    backgroundColor: "{colors.dark.medium-tint}"
    textColor: "{colors.dark.medium}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.sm}"
  badge-low:
    backgroundColor: "{colors.dark.low-tint}"
    textColor: "{colors.dark.low}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.sm}"
  badge-pass:
    backgroundColor: "{colors.dark.pass-tint}"
    textColor: "{colors.dark.pass}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.sm}"
  seal:
    backgroundColor: "{colors.dark.pass-tint}"
    textColor: "{colors.dark.pass}"
    typography: "{typography.code-sm}"
    rounded: "{rounded.sm}"
    padding: 8px
  tooltip:
    backgroundColor: "{colors.dark.raised}"
    textColor: "{colors.dark.text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 8px
  toast:
    backgroundColor: "{colors.dark.raised}"
    textColor: "{colors.dark.text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 12px
  skeleton:
    backgroundColor: "{colors.dark.raised}"
    textColor: "{colors.dark.text-muted}"
    rounded: "{rounded.sm}"
```

**Behavior rules**

- Buttons: one primary per view. Pressed state moves 1px down. Pending keeps the button width and swaps the label ("Connecting…"). Focus ring is a 2px verdigris outline with 2px offset on every interactive element.
- Badges: icon shape plus text label plus tint. Shapes are distinct: filled diamond critical, triangle high, square medium, circle low, check pass. Shapes are custom 12px SVG, not Lucide.
- Seal: a bordered `sm` rectangle with a check shape, the word "Verified" and a 12-character digest in `code-sm` with a copy button for the full value. It appears only when a real verification passed.
- Tables: sticky header, sortable columns with `aria-sort`, density toggle (28, 36, 44px), row click opens a side drawer with the evidence, `j` and `k` move between rows, `Enter` opens, `Esc` closes.
- Tabs: roving tabindex, arrow keys move and activate, `Home` and `End` jump. The underline is 2px verdigris.
- Chips: toggle buttons with `aria-pressed`; the selected state is `raised` plus a check shape, not colour alone.
- Primitives (dialog, select, tabs, tooltip, popover, command palette) come from an accessible headless library such as Radix, Base UI or React Aria; styling is ours. Do not hand-roll focus traps.
- Icons: Lucide stays, used inline at 16px next to text, 1.5px stroke. No icon-in-coloured-circle feature cards.
- Skeletons match real column widths and do not shimmer; they are static `raised` blocks.

## Do's and Don'ts

- Do use verdigris only for verified, protected and primary-action states.
- Do encode severity three ways: colour, label, shape.
- Do let the first screen of the dashboard answer "what should I work on next".
- Do keep one primary button per view.
- Do keep all copy in the terminology table above.
- Do render the final state immediately under `prefers-reduced-motion`.
- Do feed the hero demo, Playground, rules catalog and Findings table from one rule engine and one finding schema so they cannot drift.
- Do make every animated moment answer a question: what was found, what changed, what is verified.
- Don't use cyan-to-indigo gradients, gradient text, glow, or glass blur.
- Don't add pulsing dots, radar pulses, shimmer or looping animation.
- Don't fade-and-slide every section on scroll or lift every card on hover.
- Don't chop content into identical rounded cards with the same shadow.
- Don't use all-caps eyebrow labels, middle-dot meta strings, or "→" on every link.
- Don't number things that are not a sequence.
- Don't accent a single word in a headline with colour or italic.
- Don't use sparkle icons, chat widgets, or "AI-powered" claims.
- Don't validate a field before the person has left it (format masks excepted).
- Don't use a disabled submit button to hide why a form is invalid.
- Don't ship placeholder names ("Acme Inc"), fake logos, invented numbers or privacy claims the code does not back.

## Brand mark and assets

- **Mark:** a gate. Two vertical posts and a lintel on a 24px grid, with a 4px notch cut into the lintel centre. Posts and lintel use `text`; only the notch is verdigris (it is the "checked" part). One-colour version for favicons and small sizes.
- **Wordmark:** "PipelineGuard" in Instrument Sans 600, tight tracking, no tagline lockup.
- **Imagery:** none. The product is the image. Product screenshots are real, in both themes, captured by the Playwright screenshot job rather than by hand.
- **Open Graph image:** a static render of the hero in its final state (flagged lines, findings and seal). Regenerated in CI so it never shows an outdated UI.
- **Favicon:** the gate mark; add a small critical shape badge variant for the browser tab when open critical findings exist (static, not animated).

## Landing page

Structure follows what studies of developer-tool pages keep finding: lead with the product, build trust fast, let people try it before signing up, tell the story through problems, keep supporting blocks few and end with one distinct call to action. Linear's embedded demo, Vercel's live deployment view, Evervault's interactive demos and Semgrep's rule playground all point the same way: a working surface beats a description of one.

```
┌──────────────────────────────────────────────────────────────┐
│ PipelineGuard     Rules  Playground  Docs  GitHub  [Sign in] │  sticky, 56px
├──────────────────────────────────────────────────────────────┤
│ Catch risky workflow changes                                 │
│ before they run.                          display-xl, left   │
│ One plain sentence of what it checks.                        │
│ [Connect repository]  [Scan a workflow here]                 │
│                                                              │
│ ┌ Sample workflow: ci.yml ──────┐ ┌ Findings ──────────────┐ │
│ │  1 name: release              │ │ ◆ Critical  PG-WF-00x  │ │
│ │  …                            │ │ ▲ High      PG-WF-00y  │ │
│ │ 13 ▌ uses: vendor/action@v3   │ │ ■ Medium    …          │ │
│ │ 14 ▌ run: echo ${{ secrets…}} │ │ [Show fix] [Run again] │ │
│ └───────────────────────────────┘ │ ✓ Verified  9f2c41ab07de│ │
│                                   └────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ One-sentence proof of what it checks today (no stat tiles)   │
├──────────────────────────────────────────────────────────────┤
│ How pipelines get compromised   [tab] [tab] [tab]            │
│ problem sentence · the line that causes it · what we flag    │
├──────────────────────────────────────────────────────────────┤
│ Playground: paste your own workflow, get findings            │
│ ┌ textarea with line numbers ┐ ┌ findings (same engine) ───┐ │
├──────────────────────────────────────────────────────────────┤
│ From repository to audit log        (real sequence, numbered)│
│ Connect ─── Scan ─── Score ─── Record     scroll-linked line │
├──────────────────────────────────────────────────────────────┤
│ Rules catalog: filterable table, PG-WF-001 to 006            │
├──────────────────────────────────────────────────────────────┤
│ Dashboard preview with 3 focusable hotspots                  │
├──────────────────────────────────────────────────────────────┤
│ FAQ (native <details>)                                       │
├──────────────────────────────────────────────────────────────┤
│ Connect a repository: the real form, centered                │
└──────────────────────────────────────────────────────────────┘
```

### Hero scan demo

Left: read-only YAML with line numbers (`code-md`) inside a `code-panel`, titled "Sample workflow". Right: findings list (`panel`). The demo runs from a bundled sample and the shared client-side rule engine, so it needs no backend. The same finding objects feed the real Findings table.

Sample (broken) workflow, 15 lines. Rule IDs and wording are placeholders to remap:

```yaml
name: release
on:
  pull_request_target:
    branches: [main]
permissions: write-all
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
      - uses: vendor/deploy-action@v3
      - run: echo "token=${{ secrets.NPM_TOKEN }}"
      - run: ./build.sh "${{ github.event.pull_request.title }}"
```

Expected findings, in line order (six, the maximum shown):

| Lines | Severity | Finding | Fix shown |
|---|---|---|---|
| 3, 12 | Critical | `pull_request_target` runs the pull request's own code with a write token | Trigger on `pull_request`; drop the head `ref` |
| 5 | High | `write-all` grants every permission to every job | `contents: read` |
| 10 | Medium | Checkout leaves credentials in the git config | `persist-credentials: false` |
| 13 | High | Action pinned to a tag that can move | Pin to a full commit SHA |
| 14 | Critical | A secret is written to the job log | Remove the echo |
| 15 | High | Pull request title is interpolated into a shell command | Pass it through `env` |

Sample (fixed) workflow shown by "Show fix" (the SHA is an obvious sample value):

```yaml
name: release
on:
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: vendor/deploy-action@0123456789abcdef0123456789abcdef01234567 # v3
      - run: ./build.sh "$PR_TITLE"
        env:
          PR_TITLE: ${{ github.event.pull_request.title }}
```

Choreography:

1. On load, the scan cursor (a 2px verdigris bar on the line gutter) moves down at `scan-line` per line (15 lines, about 1.05s). When it passes a flagged line, that line gets a 3px left marker in the severity colour and the severity tint, and the matching finding enters the list (60ms stagger). Whole sequence under 2.2s; plays once.
2. Hover or focus on a finding highlights its line, and the reverse. Findings are buttons; selecting one moves focus to its line range and the line range is exposed with `aria-describedby`.
3. A single polite live region announces once when the scan ends: "Scan complete: 6 findings, 2 critical, 3 high, 1 medium." Findings are not announced one by one.
4. "Show fix" runs `diff-swap`: removed lines show `diff-removed` with a strike, then are replaced by `diff-added` lines. Each finding row flips to a check shape and "Fixed" in order. A fast re-scan runs over the changed lines only.
5. When the re-scan returns zero findings, the seal stamps in (`seal-stamp`) showing "Verified" and the first 12 hex characters of the SHA-256 of the fixed file, computed in the browser with `crypto.subtle.digest`. The digest is real, not invented. "Run scan again" resets to the broken file and replays.
6. Below `lg`, the panels stack: code first (horizontally scrollable), then findings. The scan still plays; findings are inserted in the order the cursor reaches them.

### Incident tabs

Three tabs, each a real way pipelines are compromised: a third-party action that changes under you, a secret that reaches the logs, and an artifact that is not what was built. Each panel shows one sentence of problem, the exact line that causes it, and the rule that flags it. The third tab shows two 12-character digests (built versus published) instead of a YAML line. The underline slides between tabs; panels crossfade. Arrow keys switch tabs.

### Playground

A textarea with line numbers on the left and findings on the right, using the same rule engine as the hero. Paste or type; results update after a 300ms pause and only new findings animate in. Ship three one-click samples ("Unpinned action", "Secret in a log", "Pull request title in a shell command"). Empty state: "Paste a GitHub Actions workflow to see what PipelineGuard flags." Parse errors say which line failed: "Line 9: expected a list item. Check the indentation under `steps:`." Files over 200 lines are scanned in a Web Worker so typing never blocks. Copy under the panel states exactly where the scan runs. Below the results: "Connect repository" with the same form as the final call to action.

### How it works

Numbered because it is a real sequence: Connect, Scan, Score, Record. A single horizontal line (vertical on small screens) with four gate nodes draws as the section scrolls. Use a CSS view timeline; each node turns from `line-strong` to `primary` as the line reaches it.

```css
.gate-line {
  transform-origin: left;
  transform: scaleX(1);
}
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .gate-line {
      transform: scaleX(0);
      animation: gate-draw linear both;
      animation-timeline: view();
      animation-range: entry 20% cover 55%;
    }
  }
}
@keyframes gate-draw { to { transform: scaleX(1); } }
```

Unsupported browsers and reduced-motion users see the line fully drawn.

### Rules catalog

A real table: ID, what it flags, severity, a one-line example, the fix. Filter chips for severity; rows reorder with a View Transition and fall back to an instant reorder. This is the page's documentation surface, so keep it complete and honest, and generate it from the same rule definitions the engine uses.

### Dashboard preview

A real screenshot of the dashboard, captured in CI, in the visitor's theme. Three hotspots (findings queue, evidence drawer, audit log) open a callout on hover and focus. No mockups, no fake data that the real UI could not show.

### FAQ

Native `<details>` elements, left aligned, answers in plain prose. Questions come from real objections: what access the app needs, what runs where, what it does with secrets, how it differs from a linter, what it costs.

### Final call to action

The connect form itself, embedded, instead of a button that leads to another form. Distinct `panel` on a `canvas` band, centered, one field visible first (see Forms).

## Forms and interaction

### Connect repository

Replaces the current modal and is reused in the landing call to action and the Playground. Progressive disclosure: one field first, the rest once the repository resolves.

| Field | Behavior |
|---|---|
| Repository URL | First field, autofocus in the dialog. `type="url"`, `inputmode="url"`, `autocapitalize="off"`, `spellcheck="false"`. On paste, parse owner and repo, then resolve it. |
| Pipeline ID | Appears after resolve. Suggested as `pipe-<repo>`, editable. Lowercase letters, digits, hyphens, 3 to 48 characters. Uniqueness checked on blur. |
| Branch | Appears after resolve. A select of detected branches, default branch preselected. No spaces, no `..` if typed manually. |

States of the form:

1. **Idle:** only Repository URL and the primary button "Connect repository" (enabled).
2. **Resolving:** a static line under the field, "Checking acme/api…". A spinner only while the request is in flight.
3. **Resolved:** evidence appears before commitment: "Found 4 workflows in `.github/workflows` on `main`" with the file names in `code-sm` and check shapes. Pipeline ID and Branch appear with suggested values. Nothing is uploaded or changed yet.
4. **Not found or empty:** "No workflows found in `.github/workflows` on `main`. Pick another branch or add a workflow file." The form stays editable.
5. **Submitting:** the button keeps its width and reads "Connecting…"; fields lock; typed values are never lost on failure.
6. **Done:** the dialog closes, the new pipeline card is inserted with a layout animation, a toast says "Repository connected. First scan queued." and focus returns to the control that opened the dialog.

### Rules for every form in the product

- Validate on blur first. Do not show an error while the person is still typing, except for format masks. After a field has shown an error, revalidate on every change so the error clears the moment it is fixed.
- Positive confirmation (a check shape with "Found" or "Available") is allowed for asynchronous checks and for fields that previously had an error. Do not decorate every valid field.
- The submit button stays enabled. On submit with one error, focus that field and show its inline error; no summary. With two or more errors, show an error summary at the top of the form with a link to each field and focus the summary; also keep every inline error.
- Errors sit under the field, say what to change, and are tied to the input with `aria-describedby` and `aria-invalid`. Labels are always visible; placeholders are examples, never labels. Do not put the error inside the label element.
- Pending state keeps the button width and locks the fields. Success returns focus to the opener.
- Failure shows a form-level alert at the top of the form: what failed and what to try. Network failures offer "Try again".
- `Enter` submits, `Esc` closes, and closing a dirty form asks once.
- One Zod schema per form, shared by the client check and the API client, so rules live in one place.
- Use React 19 form actions (`<form action>`, `useActionState`) for pending and error state; they work in a client-only Vite app as well.
- Respect `autocomplete` attributes; never block paste.

### Changing a finding's status

Optimistic update with `useOptimistic`, `row-flash` once, a toast "Marked resolved. Undo" for 6 seconds, and an audit entry written by the API. On failure the row reverts and says why. The status control is a select with the four statuses, keyboard operable, with the same verb in the toast and the audit log.

### Filters

Chips for severity and status, stored in the URL query string so any view can be shared or bookmarked. The empty-result state offers "Clear filters".

### Command palette

`Ctrl+K` or `⌘K`, replaces the search mockup. Groups: Findings, Pipelines, Pages, Actions. Recent items first. Fully keyboard navigable. Use `cmdk` or an equivalent headless implementation. Footer shows the key hints as `kbd`.

## Dashboard patterns

```
┌────────┬─────────────────────────────────────────────────────┐
│Monitor │ Findings                    [Search ⌘K] [Updated 12s]│
│ Overview│ ┌ Needs attention ────────────────┐ ┌ Open now ───┐ │
│ Findings│ │ ◆ PG-WF-00x  pipe-auth   4d     │ │ 3 critical  │ │
│ Incidents│ │ ▲ PG-WF-00y  pipe-web   1d     │ │ ▬▬▬▬▬ bar   │ │
│Guard   │ │ ■ …                              │ │ in 2 pipes  │ │
│ Workflows│ └─────────────────────────────────┘ └─────────────┘ │
│ Secrets │ ┌ Run risk, last 14 days ─────────────────────────┐ │
│ Artifacts│ │ one line, one threshold, labelled endpoints     │ │
│Pipelines│ └─────────────────────────────────────────────────┘ │
│ Pipelines│                                                     │
│ Runs   │                                                      │
│Records │                                                      │
│ Audit log│                                                    │
│Settings│                                                      │
└────────┴─────────────────────────────────────────────────────┘
```

- **Overview first screen:** the ranked "Needs attention" queue, one sentence of posture ("3 critical findings are open across 2 pipelines. Oldest is 4 days."), a single stacked severity bar and one run-risk line chart. At most four plain stats, set as text, not tiles. Ranking is severity first, then age, with no hidden score, so the order can be explained in one sentence.
- **First run:** with no pipelines, the Overview is a single panel with the Connect repository form and a short list of what happens next. After connecting, a "First scan" row shows real steps (queued, reading workflows, applying rules, recorded) as static text with check shapes, updating as the API reports them.
- **Navigation:** grouped (Monitor, Guard, Pipelines, Records), sentence-case group labels, collapses to a 56px icon rail, becomes a drawer below 640px. The open-findings count is a number badge, not a pulsing dot. Group and page names match the terminology table.
- **Status line:** "Connected" or "Degraded" as text plus a static dot, with "Updated 12s ago". The manual refresh button spins only while a request is in flight. Polling is 15s, pauses when the tab is hidden, and two consecutive failures flip the status to Degraded.
- **Evidence beside the finding:** the row opens a right drawer with the offending lines (`code-panel` with the flagged range in a severity tint), the rule, the score, a suggested fix as a diff, and the status history. No inline accordion that pushes rows around.
- **Loading:** static skeleton rows that match the column widths. **Error:** panel-level message with "Try again" and the request id.
- **Charts:** Recharts is fine. One series, flat colour from tokens, direct labels instead of legends, one threshold line, no gradient fills, tooltips in `panel` colours. Severity bars use the shape-plus-colour encoding in their labels.
- **Density:** the default is 36px rows; the person's choice is remembered.
- **Settings:** the connection test shows the request, the status and the response time as plain rows, not a decorative card.

## Architecture and scalability

Keep React 19, Vite and Tailwind for the dashboard. Change how the code is organised so features can be added without touching each other and so the landing page never pays for dashboard code.

Target layout (pnpm workspaces). Start as one app and extract in the order shown in Build order; the folder boundaries below make that extraction mechanical.

```
pipelineguard/
  apps/
    web/            landing page (Astro with React islands is the recommended
                    target; a lazy route in the Vite app is the starting point)
    dashboard/      Vite + React 19 single-page app
      src/
        app/          router, providers, query client, theme, motion config
        routes/       one lazy route per feature
        features/     findings/ incidents/ workflows/ secrets/ artifacts/
                      pipelines/ runs/ audit/
          <feature>/  api.ts  queries.ts  schemas.ts  components/  index.ts
  packages/
    tokens/         generated tokens.css, tailwind theme, tokens.json
    rules/          pure TypeScript rule engine, finding schema (Zod),
                    sample workflows, one test fixture per rule
    ui/             Button Input Select Badge Panel Table Drawer Dialog Toast
                    EmptyState Skeleton Kbd Seal
    motion/         motion tokens and reduced-motion helpers
  design/           DESIGN.md
```

- **One rule engine:** `packages/rules` is the single source for rule definitions, severities, examples and fixes. The hero demo, Playground, rules catalog, Findings table and backend contract tests all import from it. Each rule has a fixture: input workflow in, expected findings with line numbers out. The demo is a test.
- **Routing:** URL-driven routes with React Router or TanStack Router instead of the custom history manager in `App.jsx`. Code-split every feature route with `lazy()`. Filters and drawer state live in the URL.
- **Server state:** replace the central `useDashboardData` hook with TanStack Query: per-feature queries, background refresh, request deduplication, optimistic mutations with rollback.
- **Single sources of truth:** `severity.ts` maps a severity to token, label and icon shape; Zod schemas define each API type and each form; this file defines every colour, size and duration. Components receive data through props and do not fetch.
- **Tables:** TanStack Table for sort and filter, TanStack Virtual once a list passes a few hundred rows.
- **Tokens:** author here, then generate. Export a Tailwind theme and DTCG tokens from this file with the `@google/design.md` CLI (run `npx @google/design.md export --help` for the format names in your installed version; they have changed across alpha releases), and generate `tokens.css` from that. Map `colors.light.*` and `colors.dark.*` to semantic variables under the theme selectors. Never write a hex value in a component.
- **TypeScript:** adopt it feature by feature; the prop contracts in the current docs are already written as interfaces.
- **Animation code:** dashboard uses Motion with `LazyMotion` and `domMax` loaded only for layout animation (`m` components, `strict` mode so a stray full `motion` import fails loudly). Landing uses CSS and WAAPI. A shared `motion.ts` exposes the tokens above, so no component hard-codes a duration. Add GSAP only if a scrubbed, pinned scroll sequence is later needed.
- **Marketing site separation:** the landing page is public, indexable and performance-critical, so it should not ship the dashboard router, query client or chart library. Astro with React islands (hero demo, Playground, tabs, connect form) gives static HTML for everything else and imports the same `tokens`, `rules` and `ui` packages. Until then, keep it a lazy route that imports nothing from `features/`.
- **Contracts:** the backend publishes an OpenAPI document; generate the API client types from it and validate responses with the Zod schemas in dev builds.
- **Budgets:** landing route LCP 2.5s or better, INP 200ms or better, CLS 0.1 or better. Initial landing JavaScript target 80 KB gzipped or less, with the Playground, charts and any Motion bundle loaded on demand. Fonts under 60 KB total. The dashboard bundle stays out of the landing route.

## Quality gates

- `npx @google/design.md lint DESIGN.md` and `diff` in CI to catch token regressions and contrast failures.
- Rule engine fixtures run in CI; a changed rule that alters the hero sample's findings fails the build until the copy is updated.
- Automated accessibility checks with axe in Playwright for landing, a form error state, the findings table and the open drawer.
- Visible keyboard focus, a full keyboard path through every form and table, targets at least 24px (aim for 40px), text resizable to 200%, `forced-colors` and `prefers-contrast` spot checks.
- Playwright screenshots for the hero (broken and fixed states) in both themes and at 360px, to catch token drift.
- Reduced-motion run of the whole landing page; hero must show the final state with no travel.
- Browser matrix check for the scroll-driven section: supported browsers animate, unsupported browsers show the finished line.
- Lighthouse CI against the performance budgets above.
- Copy review against the terminology table before each release, plus a simple lint that fails on banned strings ("AI-powered", "Submit", exclamation marks in UI copy).

## Build order

1. Tokens: generate `tokens.css` and the Tailwind theme from this file; set up fonts and the theme toggle.
2. Rules package: finding schema, six rules, fixtures, sample workflows. Everything visible depends on it.
3. Shared UI: Button, Input, Badge, Panel, Table, Dialog, Drawer, Toast, Skeleton, EmptyState, Seal.
4. Shell: router, sidebar, navbar with static status, command palette.
5. Findings: queue, table, drawer, status change with undo. This proves the patterns.
6. Connect repository form and pipelines grid (three-field version first, resolve step second).
7. Landing: hero scan with fix and seal first, then Playground, incident tabs, rules catalog, how it works, FAQ, final form.
8. Remaining pages (runs, audit log, workflows, secrets, artifacts, settings).
9. Quality gates in CI; split the landing page into its own app if search visibility or bundle size calls for it.

## Sources

Studied while preparing this file. Patterns were adapted, not copied. Pages named as references were read for patterns, not reproduced.

- DESIGN.md format specification (Google Labs), used to validate section order, token schema, grouped light and dark colours, motion tokens and the `@google/design.md` CLI: https://github.com/google-labs-code/design.md
- web.dev, "New to the web platform in October" (2026-10-29): scroll-driven animations reach Baseline newly available (Chrome 115, Safari 26, Firefox 159): https://web.dev/blog/web-platform-10-2026
- Motion documentation on reducing bundle size (`LazyMotion`, `domAnimation` versus `domMax` for layout animation): https://motion.dev/motion/guide-reduce-bundle-size/
- Evil Martians, study of 100+ developer-tool landing pages: https://evilmartians.com/chronicles/we-studied-100-devtool-landing-pages-here-is-what-actually-works-in-2025
- Department of Product, 2026 homepage UX review (Linear's embedded product demo that works without signing up): https://departmentofproduct.substack.com/p/deep-homepage-ux-explored
- Line25, landing page examples 2026 (Vercel's live deployment view, code-centric developer pages): https://line25.com/articles/best-landing-page-design-examples-2026/
- Webstacks, Semgrep case study (interactive demos and a rule playground as product surfaces): https://www.webstacks.com/client-stories/semgrep
- Baymard Institute, inline form validation (avoid premature validation, clear errors on correction, positive inline validation): https://baymard.com/research-articles/inline-form-validation
- Nielsen Norman Group, form error guidelines (a summary should not be the only error signal): https://www.nngroup.com/articles/errors-forms-design-guidelines/
- Australian Government Department of Agriculture design system, accessible form validation (one error: focus the field, no summary): https://design-system.agriculture.gov.au/patterns/accessible-form-validation-and-recovery
- CMS Design System, error validation pattern (summary below the page heading, inline messages repeated): https://design.cms.gov/patterns/Forms/error-validation/

Carried over from v1 and not re-checked in this pass:

- StepSecurity, CI/CD supply-chain product pages (story anchored on real attacks, one surface per attack stage): https://www.stepsecurity.io/platform
- Fuselab, security dashboard design (density is fine, idle motion is costly, encode severity twice): https://fuselabcreative.com/cybersecurity-dashboard-design/
- OpenReplay, Motion versus GSAP: https://blog.openreplay.com/motion-vs-gsap/
- Developer-docs font notes: https://fontalternatives.com/blog/best-fonts-developer-docs-api-reference/
- Gallery for security pages: https://www.saasframe.io/landing-page-examples/cybersecurity-threat-detection

What was taken from each reference:

| Reference | Taken | Left out |
|---|---|---|
| Linear, Vercel, Evervault | A working product surface in the hero; typography and product as the identity | Cinematic gradients, 3D visuals, dark atmospheric glow |
| Resend | Type as the differentiator; code on the page | Decorative serif display |
| Semgrep | A playground that runs real rules on pasted input | Scrolling logo bars, ROI calculator |
| StepSecurity | Story told through real attacks, one surface per stage | Vendor-style stat tiles |
| Government design systems | Error summary rules, focus management, plain error language | Visual styling |
