# PipelineGuard: Comprehensive Frontend Architecture & Component Catalog

> **Framework:** React 19 + Vite 8.3 + Tailwind CSS  
> **Directory:** `dashboard/src/`  
> **Live URL:** `http://localhost:5173`  
> **Theme:** Cyber-Dark Glassmorphic (`#0a0e17` canvas, `#111827` cards, cyan/indigo/rose accents)

---

## 1. Component Tree & Hierarchy

```
App.jsx (Root View Orchestrator & History Manager)
├── useDashboardData (Central Telemetry Hook)
│
├── layout/
│   ├── Sidebar.jsx (Desktop Sidebar + Mobile Drawer)
│   ├── Navbar.jsx (Top Navigation Bar + Breadcrumbs + Search Trigger)
│   └── SearchModal.jsx (Global Ctrl+K Search Dialog)
│
└── Main Content Container (Dynamic Page Switching)
    ├── Overview (Default View)
    │   ├── HeroBanner.jsx (Real-time Threat Level & Radar Pulse)
    │   ├── StatCard.jsx (KPI Metrics Grid)
    │   ├── ThreatChart.jsx (Dual-Area Risk Velocity Chart)
    │   └── ThreatTable.jsx (Recent Security Findings Preview)
    │
    ├── Threats & Incidents
    │   └── ThreatTable.jsx (Full Interactive Security Events Table)
    │
    ├── Pipelines
    │   └── PipelineGrid.jsx (Monitored Repositories + Connect Repo Modal)
    │
    ├── Runs
    │   └── RunTable.jsx (Execution History & Risk Scores)
    │
    ├── Audit Log
    │   └── AuditTable.jsx (Immutable Status Transition Ledger)
    │
    ├── Workflow Security
    │   └── WorkflowSecurityPage.jsx (PG-WF-001 to 006 Rules Catalog)
    │
    ├── Secrets
    │   └── SecretsPage.jsx (Entropy & Token Signatures)
    │
    ├── Artifacts
    │   └── ArtifactsPage.jsx (SHA-256 Cryptographic Digest Verification)
    │
    └── Settings
        └── SettingsPage.jsx (API Connection Diagnostics & Auth Info)
```

---

## 2. Complete Component Specifications

### 2.1. `layout/Sidebar.jsx`
* **File:** `dashboard/src/components/layout/Sidebar.jsx`
* **Purpose:** Primary application navigation, system health monitor, and mobile drawer.
* **UI Elements:**
  * **Brand Header:** Shield icon in gradient square, "PipelineGuard v2.0", subtitle "CI/CD Defense Engine".
  * **Mobile Close Button:** `<X />` icon (hidden on desktop).
  * **Nav Item List (10 Pages):**
    * Overview (`<LayoutDashboard />`)
    * Threat Events (`<ShieldAlert />`) + Live Open Alerts Counter Badge
    * Workflow Guard (`<Workflow />`)
    * Secrets Scanner (`<KeyRound />`)
    * Artifact Integrity (`<Package />`)
    * Pipelines (`<GitBranch />`)
    * Pipeline Runs (`<Activity />`)
    * Incident Desk (`<AlertTriangle />`)
    * Audit Ledger (`<FileClock />`)
    * Settings (`<Settings />`)
  * **System Status Footer:** Live pulse dot (Green = Connected, Yellow = Degraded), backend connection text, SQLite storage badge.
* **Props Contract:**
  ```typescript
  interface SidebarProps {
    activePage: string;
    onNavigate: (page: string) => void;
    openCount: number;
    isMobileOpen: boolean;
    onCloseMobile: () => void;
    backendStatus: "ok" | "healthy" | "offline";
  }
  ```

---

### 2.2. `layout/Navbar.jsx`
* **File:** `dashboard/src/components/layout/Navbar.jsx`
* **Purpose:** Persistent top header displaying current location, global search shortcut, and manual telemetry refresh.
* **UI Elements:**
  * **Mobile Menu Button:** `<Menu />` hamburger icon (toggles mobile drawer).
  * **Breadcrumbs:** `PipelineGuard > [Current Page Name]`.
  * **Search Trigger:** Quick search input mockup with `<Search />` icon and `<kbd>Ctrl+K</kbd>` badge.
  * **Telemetry Refresh Button:** `<RefreshCw />` button with spin animation during fetch.
  * **Live Guard Pill:** Pulsing radar dot + "Live Guard Active".
* **Props Contract:**
  ```typescript
  interface NavbarProps {
    activePage: string;
    onOpenMobile: () => void;
    onOpenSearch: () => void;
    onRefresh: () => Promise<void>;
    isRefreshing: boolean;
    backendStatus: string;
  }
  ```

---

### 2.3. `layout/SearchModal.jsx`
* **File:** `dashboard/src/components/layout/SearchModal.jsx`
* **Purpose:** Instant spotlight search across threat descriptions, pipeline IDs, and pages.
* **UI Elements:**
  * **Backdrop:** Dimmed glass blur (`bg-black/70 backdrop-blur-sm`).
  * **Search Input:** Auto-focused text input with clean placeholder and clear/esc button.
  * **Results Categorization:**
    * Threat findings matching query (shows event type, description, and severity badge).
    * Pipelines matching query (shows pipeline ID and branch).
    * Direct page navigation quick-links.
* **Props Contract:**
  ```typescript
  interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    onNavigate: (page: string) => void;
    events: SecurityEvent[];
    pipelines: Pipeline[];
  }
  ```

---

### 2.4. `overview/HeroBanner.jsx`
* **File:** `dashboard/src/components/overview/HeroBanner.jsx`
* **Purpose:** Executive security summary header displaying overall risk state.
* **UI Elements:**
  * **Dynamic Border & Ambient Glow:** Green (Resilient), Amber (Moderate), or Red (Critical Findings).
  * **Status Pill:** Live ping dot + dynamic headline.
  * **Main Title & Subtitle:** Pipeline Security Operations Center overview.
  * **Metrics Cluster:**
    * Mean Risk Score (`/100`)
    * Open Findings Counter
    * Quick Action Button: "Review Threats →" (navigates to Threats view).
* **Props Contract:**
  ```typescript
  interface HeroBannerProps {
    events: SecurityEvent[];
    pipelines: Pipeline[];
    onNavigate: (page: string) => void;
  }
  ```

---

### 2.5. `overview/StatCard.jsx`
* **File:** `dashboard/src/components/overview/StatCard.jsx`
* **Purpose:** Reusable KPI card for dashboard metrics.
* **UI Elements:**
  * Category label (uppercase small text).
  * Primary metric value (large bold font).
  * Subtext description.
  * Icon badge with colored background glow (`cyan`, `rose`, `indigo`, `amber`, `emerald`).
  * 24h trend badge (e.g. `+12% vs previous 24h`).
* **Props Contract:**
  ```typescript
  interface StatCardProps {
    title: string;
    value: string | number;
    subtext?: string;
    icon: LucideIcon;
    variant?: "cyan" | "rose" | "indigo" | "amber" | "emerald";
    trend?: string;
  }
  ```

---

### 2.6. `overview/ThreatChart.jsx`
* **File:** `dashboard/src/components/overview/ThreatChart.jsx`
* **Purpose:** Dual-area telemetry chart visualizing threat frequency and calculated risk trajectory over time.
* **UI Elements:**
  * Header with "Telemetry Live" status tag.
  * Recharts `<AreaChart />` with two smooth splines:
    * Cyan Gradient: Event frequency
    * Indigo Gradient: Risk score velocity
  * Custom dark tooltip formatted for high-contrast viewing.
* **Props Contract:**
  ```typescript
  interface ThreatChartProps {
    events: SecurityEvent[];
  }
  ```

---

### 2.7. `pipelines/PipelineGrid.jsx` (Includes Form Modal)
* **File:** `dashboard/src/components/pipelines/PipelineGrid.jsx`
* **Purpose:** Grid of registered repositories and the interactive modal for adding/connecting new repositories.
* **UI Elements:**
  * **Header:** Active pipelines counter badge.
  * **Action Button:** `+ Connect New Repository` (triggers modal).
  * **Empty State:** Illustrated prompt if no repositories exist.
  * **Pipeline Card Grid:**
    * Pipeline ID (e.g. `pipe-auth-service`)
    * Status Badge: `Protected` (green) or `Paused` (gray)
    * Repository URL with `<Globe />` icon
    * Branch with `<GitFork />` icon
    * SQLite Attestation Tag
  * **Embedded Form Modal:**
    * Input 1: Pipeline Identifier (`pipelineId`)
    * Input 2: Repository URL (`repoUrl`)
    * Input 3: Default Branch (`branch`, defaults to `main`)
    * Form Error Alert (displays validation errors)
    * Buttons: "Cancel" and "Connect Repository" (with submitting state)
* **Props Contract:**
  ```typescript
  interface PipelineGridProps {
    pipelines: Pipeline[];
    loading: boolean;
    error: string | null;
    onAddPipeline: (data: {
      pipeline_id: string;
      name: string;
      repository: string;
      branch: string;
      status: string;
    }) => Promise<void>;
  }
  ```

---

### 2.8. `threats/ThreatTable.jsx`
* **File:** `dashboard/src/components/threats/ThreatTable.jsx`
* **Purpose:** Comprehensive interactive security events table.
* **UI Elements:**
  * **Filter Controls:**
    * Severity Filter: `All Severities`, `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
    * Status Filter: `All Statuses`, `OPEN`, `INVESTIGATING`, `RESOLVED`, `FALSE_POSITIVE`
  * **Table Columns:**
    * Event ID & Type
    * Severity Badge (color-coded)
    * Risk Score (numerical 0-100)
    * Source (`workflow`, `secrets`, `artifacts`)
    * Target Pipeline ID
    * Status Action Dropdown (interactive `<select>`)
    * Expand Details Toggle (`<ChevronDown />` / `<ChevronUp />`)
  * **Expandable Drawer:** Detailed finding explanation, timestamp, and remediation engine info.
* **Props Contract:**
  ```typescript
  interface ThreatTableProps {
    events: SecurityEvent[];
    loading: boolean;
    error: string | null;
    onStatusUpdate: (eventId: string, newStatus: string) => Promise<void>;
  }
  ```

---

### 2.9. `runs/RunTable.jsx`
* **File:** `dashboard/src/components/runs/RunTable.jsx`
* **Purpose:** Chronological audit log of pipeline executions.
* **UI Elements:**
  * Columns: Run ID, Pipeline ID, Trigger Event (`push`, `pull_request`), Status Badge (`SUCCESS`, `FAILED`, `RUNNING`), Risk Index, Duration.
* **Props Contract:**
  ```typescript
  interface RunTableProps {
    runs: PipelineRun[];
    loading: boolean;
    error: string | null;
  }
  ```

---

### 2.10. `audit/AuditTable.jsx`
* **File:** `dashboard/src/components/audit/AuditTable.jsx`
* **Purpose:** Immutable forensic ledger of security incident status overrides.
* **UI Elements:**
  * Columns: Log ID, Event ID, Status Transition Visualizer (`[PREV] -> [NEW]`), Actor (`admin`), Timestamp.
* **Props Contract:**
  ```typescript
  interface AuditTableProps {
    auditLogs: AuditLogEntry[];
    loading: boolean;
  }
  ```

---

### 2.11. Dedicated Security Modules
* **`pages/WorkflowSecurityPage.jsx`:** Displays rule definitions for `PG-WF-001` through `PG-WF-006` with severity, risk impact, and AST detection vector descriptions.
* **`pages/SecretsPage.jsx`:** Lists entropy thresholds, secret signatures (AWS keys, GitHub tokens, Slack tokens), and scanning coverage.
* **`pages/ArtifactsPage.jsx`:** Lists verified build artifacts with SHA-256 cryptographic digests, provenance status, and pipeline targets.
* **`pages/SettingsPage.jsx`:** Diagnostic panel with a "Test Connection" button calling `GET /api/health`, database engine information, and authentication protocols.

---

## 3. How to Extract or Swap Components

All components are **self-contained and decoupled**:
1. To replace a component with an external one (e.g. from React Bits, shadcn/ui, or Tailwind UI):
   * Copy the component into `dashboard/src/components/`.
   * Keep the **Props Contract** (listed above) consistent.
   * Import the component in [App.jsx](file:///d:/pipelineguard/dashboard/src/App.jsx).
2. To extract these components into another project:
   * Copy `dashboard/src/components/` and `dashboard/src/hooks/useDashboardData.js`.
   * Ensure `lucide-react`, `recharts`, and `@tailwindcss/vite` are installed.
