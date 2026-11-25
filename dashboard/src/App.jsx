import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
  Clock3,
  Database,
  Eye,
  Menu,
  FileClock,
  FileWarning,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Package,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  TriangleAlert,
  Workflow,
  X,
} from "lucide-react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "./App.css";
import {
  getBackendHealth,
  getPipelines,
  getRuns,
  getSecurityEvents,
  updateSecurityEventStatus,
} from "./services/api";

/* =========================================================
   MOCK DATA
   PHASE 1 ONLY
   Later replaced by FastAPI + PostgreSQL
========================================================= */

const activityData = [
  { time: "09:00", events: 2 },
  { time: "10:00", events: 4 },
  { time: "11:00", events: 3 },
  { time: "12:00", events: 7 },
  { time: "13:00", events: 5 },
  { time: "14:00", events: 9 },
  { time: "15:00", events: 6 },
  { time: "16:00", events: 11 },
];

const incidents = [
  {
    id: "INC-001",
    severity: "critical",
    title: "Workflow Command Injection",
    source: "GitHub Actions",
    risk: 96,
    time: "2m ago",
    status: "BLOCKED",
    description:
      "Untrusted pull request input appears to reach a shell execution step.",
  },
  {
    id: "INC-002",
    severity: "critical",
    title: "Potential Secret Exposure",
    source: "Secret Scanner",
    risk: 91,
    time: "8m ago",
    status: "OPEN",
    description:
      "A credential-like value was detected in a repository configuration file.",
  },
  {
    id: "INC-003",
    severity: "warning",
    title: "Unexpected Dependency Change",
    source: "Workflow Guard",
    risk: 64,
    time: "21m ago",
    status: "REVIEW",
    description:
      "A pipeline dependency changed outside the expected update pattern.",
  },
  {
    id: "INC-004",
    severity: "critical",
    title: "Artifact Hash Mismatch",
    source: "Artifact Guard",
    risk: 88,
    time: "34m ago",
    status: "BLOCKED",
    description:
      "The artifact checksum does not match the expected trusted digest.",
  },
  {
    id: "INC-005",
    severity: "info",
    title: "Pipeline Configuration Change",
    source: "Pipeline Monitor",
    risk: 32,
    time: "51m ago",
    status: "RESOLVED",
    description:
      "A pipeline configuration was modified and recorded in the audit trail.",
  },
];

const pipelines = [
  {
    name: "Production API",
    branch: "main",
    status: "healthy",
    duration: "2m 14s",
    lastRun: "RUN-1042",
  },
  {
    name: "Frontend",
    branch: "main",
    status: "healthy",
    duration: "1m 48s",
    lastRun: "RUN-1040",
  },
  {
    name: "Security Engine",
    branch: "develop",
    status: "warning",
    duration: "3m 06s",
    lastRun: "RUN-1041",
  },
  {
    name: "Data Processor",
    branch: "main",
    status: "healthy",
    duration: "1m 32s",
    lastRun: "RUN-1039",
  },
];

const runs = [
  {
    id: "RUN-1042",
    pipeline: "Production API",
    branch: "main",
    status: "PASSED",
    duration: "2m 14s",
    time: "2m ago",
  },
  {
    id: "RUN-1041",
    pipeline: "Security Engine",
    branch: "develop",
    status: "BLOCKED",
    duration: "3m 06s",
    time: "7m ago",
  },
  {
    id: "RUN-1040",
    pipeline: "Frontend",
    branch: "main",
    status: "PASSED",
    duration: "1m 48s",
    time: "13m ago",
  },
  {
    id: "RUN-1039",
    pipeline: "Data Processor",
    branch: "main",
    status: "PASSED",
    duration: "1m 32s",
    time: "20m ago",
  },
];

const secrets = [
  {
    id: "SEC-001",
    type: "API Key",
    file: ".env.production",
    severity: "critical",
    status: "BLOCKED",
  },
  {
    id: "SEC-002",
    type: "Database Credential",
    file: "config/database.py",
    severity: "critical",
    status: "BLOCKED",
  },
  {
    id: "SEC-003",
    type: "Generic Secret",
    file: "test_secret.py",
    severity: "warning",
    status: "REVIEW",
  },
  {
    id: "SEC-004",
    type: "Token",
    file: "deploy/config.yml",
    severity: "warning",
    status: "MASKED",
  },
];

const artifacts = [
  {
    id: "ART-001",
    name: "pipelineguard-api.tar.gz",
    hash: "8f31...a92c",
    status: "VERIFIED",
    risk: 4,
  },
  {
    id: "ART-002",
    name: "frontend-build.zip",
    hash: "71aa...92de",
    status: "VERIFIED",
    risk: 2,
  },
  {
    id: "ART-003",
    name: "security-engine.tar.gz",
    hash: "91bc...44ef",
    status: "TAMPERED",
    risk: 94,
  },
];

const auditEvents = [
  {
    action: "Pipeline blocked",
    actor: "PipelineGuard Engine",
    target: "Security Engine",
    time: "2m ago",
  },
  {
    action: "Incident created",
    actor: "Workflow Detector",
    target: "INC-001",
    time: "2m ago",
  },
  {
    action: "Secret masked",
    actor: "Secret Scanner",
    target: "SEC-004",
    time: "8m ago",
  },
  {
    action: "Artifact verification failed",
    actor: "Artifact Guard",
    target: "ART-003",
    time: "34m ago",
  },
];

const navigation = [
  {
    section: "COMMAND CENTER",
    items: [{ name: "Overview", icon: LayoutDashboard }],
  },
  {
    section: "SECURITY",
    items: [
      { name: "Threats", icon: ShieldAlert, badge: "07" },
      { name: "Workflow Security", icon: Workflow },
      { name: "Secrets", icon: LockKeyhole },
      { name: "Artifacts", icon: Package },
    ],
  },
  {
    section: "PIPELINES",
    items: [
      { name: "Pipelines", icon: GitBranch },
      { name: "Runs", icon: Activity },
    ],
  },
  {
    section: "RESPONSE",
    items: [
      { name: "Incidents", icon: AlertTriangle },
      { name: "Audit Log", icon: Clock3 },
    ],
  },
];

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function SeverityIcon({ severity }) {
  if (severity === "critical") {
    return <TriangleAlert size={14} />;
  }

  if (severity === "warning") {
    return <AlertTriangle size={14} />;
  }

  return <CircleCheck size={14} />;
}

function PageHeader({ eyebrow, title, description, action, onAction }) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {action && (
        <button className="module-action" onClick={onAction}>
          {action}
          <ArrowUpRight size={13} />
        </button>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon = Database, title, description }) {
  return (
    <div className="empty-state">
      <Icon size={22} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function StatusBadge({ children, type = "neutral" }) {
  return <span className={`status-badge ${type}`}>{children}</span>;
}

/* =========================================================
   OVERVIEW
========================================================= */

function OverviewPage({
  onNavigate,
  pipelines,
  pipelineLoading,
  pipelineError,
  events = [],
  eventsLoading = false,
  eventsError = "",
}) {
  const openEvents = events.filter(
    (event) => String(event.status || "").toUpperCase() === "OPEN"
  );
  const criticalEvents = events.filter(
    (event) => String(event.severity || "").toUpperCase() === "CRITICAL"
  );
  const blockedEvents = events.filter(
    (event) => String(event.status || "").toUpperCase() === "BLOCKED"
  );
  const averageRisk = events.length
    ? events.reduce((total, event) => total + Number(event.risk_score || 0), 0) /
      events.length
    : 0;

  const recentEvents = [...events]
    .sort((a, b) => {
      const dateA = new Date(a.created_at || a.timestamp || 0).getTime();
      const dateB = new Date(b.created_at || b.timestamp || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 4)
    .map((event) => ({
      id: event.event_id,
      title: event.description || event.event_type || "Security event",
      severity: String(event.severity || "INFO").toLowerCase(),
      source: event.source || "Unknown source",
      risk: Number(event.risk_score || 0),
      status: String(event.status || "OPEN").toUpperCase(),
      time: event.created_at
        ? new Date(event.created_at).toLocaleString()
        : event.timestamp
          ? new Date(event.timestamp).toLocaleString()
          : "Time unavailable",
      description: event.description || "No description provided.",
    }));

  const activityData = events.reduce((buckets, event) => {
    const rawDate = event.created_at || event.timestamp;
    if (!rawDate) return buckets;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return buckets;
    const label = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const existing = buckets.find((bucket) => bucket.time === label);
    if (existing) {
      existing.events += 1;
    } else {
      buckets.push({ time: label, events: 1, sortTime: date.getTime() });
    }
    return buckets;
  }, []).sort((a, b) => (a.sortTime || 0) - (b.sortTime || 0))
    .slice(-8);

  const displayActivity = activityData.map(({ time, events: count }) => ({
    time,
    events: count,
  }));

  const riskLevel = events.length
    ? averageRisk >= 75
      ? "high"
      : averageRisk >= 40
        ? "medium"
        : "low"
    : "none";

  return (
    <>
      <section className={`hero hero-${riskLevel}`}>
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-content">
          <div className="hero-kicker">
            <span className="live-dot" />
            Security posture
          </div>
          <h1 className="hero-title">
            {eventsLoading
              ? "Analysing your pipelines…"
              : events.length === 0
                ? "Every pipeline, protected."
                : openEvents.length === 0
                  ? "All clear. Nothing needs you."
                  : `${openEvents.length} ${
                      openEvents.length === 1 ? "threat needs" : "threats need"
                    } your attention.`}
          </h1>
          <p className="hero-sub">
            PipelineGuard watches workflows, secrets and artifacts across{" "}
            {pipelineLoading ? "your" : pipelines.length} monitored{" "}
            {pipelines.length === 1 ? "pipeline" : "pipelines"} in real time.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate("Threats")}
            >
              <ShieldAlert size={16} />
              Review threats
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onNavigate("Pipelines")}
            >
              <GitBranch size={16} />
              View pipelines
            </button>
          </div>
        </div>

        <div className="hero-score">
          <div className="hero-score-value">
            {eventsLoading ? "…" : averageRisk.toFixed(0)}
          </div>
          <div className="hero-score-label">Average risk</div>
          <div className="hero-score-bar">
            <span style={{ width: `${Math.min(100, Math.max(0, averageRisk))}%` }} />
          </div>
        </div>
      </section>

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span>PIPELINES</span>
            <GitBranch size={16} />
          </div>
          <div className="metric-value">
            {pipelineLoading ? "…" : pipelines.length}
          </div>
          <div className="metric-bottom">
            <span>{pipelineError ? "Unavailable" : "Database"}</span>
            <span>registered pipelines</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span>OPEN THREATS</span>
            <ShieldAlert size={16} />
          </div>
          <div className="metric-value">
            {eventsLoading ? "…" : openEvents.length}
          </div>
          <div className="metric-bottom">
            <span className="critical-text">{criticalEvents.length} critical</span>
            <span>critical events recorded</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span>BLOCKED</span>
            <Ban size={16} />
          </div>
          <div className="metric-value">
            {eventsLoading ? "…" : blockedEvents.length}
          </div>
          <div className="metric-bottom">
            <span>Recorded status</span>
            <span>blocked events</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span>AVERAGE RISK</span>
            <Activity size={16} />
          </div>
          <div className="metric-value">
            {eventsLoading ? "…" : averageRisk.toFixed(1)}
          </div>
          <div className="metric-bottom">
            <span className="warning-text">
              {events.length
                ? averageRisk >= 75
                  ? "HIGH"
                  : averageRisk >= 40
                    ? "MEDIUM"
                    : "LOW"
                : "NO DATA"}
            </span>
            <span>mean event risk / 100</span>
          </div>
        </div>
      </section>

      <section className="main-grid">
        <div className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <div className="panel-label">SECURITY TELEMETRY</div>
              <h2>Event activity</h2>
              <p>Recorded security events grouped by creation time.</p>
            </div>
            <div className="live-pill">
              <span className="live-dot" />
              BACKEND DATA
            </div>
          </div>

          <div className="chart-container">
            {eventsLoading ? (
              <p>Loading event activity…</p>
            ) : eventsError ? (
              <p role="alert">Unable to load event activity: {eventsError}</p>
            ) : displayActivity.length === 0 ? (
              <p>No timestamped security events are available yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayActivity}>
                  <defs>
                    <linearGradient
                      id="activityGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#e50914" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#e50914" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="2 6"
                    vertical={false}
                    stroke="rgba(255,255,255,0.08)"
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "#8e8e93", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    dy={6}
                  />
                  <YAxis
                    tick={{ fill: "#8e8e93", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(255,255,255,0.18)", strokeWidth: 1 }}
                    contentStyle={{
                      background: "rgba(28,28,30,0.82)",
                      backdropFilter: "blur(20px)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "12px",
                      color: "#f5f5f7",
                      fontSize: "12px",
                      boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
                    }}
                    itemStyle={{ color: "#f5f5f7" }}
                    labelStyle={{ color: "#8e8e93", marginBottom: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="events"
                    stroke="#ff3b47"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: "#fff", stroke: "#e50914", strokeWidth: 2 }}
                    fill="url(#activityGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="panel risk-panel">
          <div className="panel-heading">
            <div>
              <div className="panel-label">RISK ENGINE</div>
              <h2>Risk index</h2>
              <p>Calculated from recorded event risk scores.</p>
            </div>
          </div>
          <div className="risk-display">
            <div
              className={`risk-ring risk-${riskLevel}`}
              style={{ "--pct": Math.min(100, Math.max(0, averageRisk)) }}
            >
              <div className="risk-ring-inner">
                <strong>{eventsLoading ? "…" : averageRisk.toFixed(1)}</strong>
                <span>/100</span>
              </div>
            </div>
            <div className="risk-state">
              <span />
              {events.length
                ? averageRisk >= 75
                  ? "HIGH EXPOSURE"
                  : averageRisk >= 40
                    ? "MODERATE EXPOSURE"
                    : "LOW EXPOSURE"
                : "NO EVENT DATA"}
            </div>
            <p>
              {eventsLoading
                ? "Loading recorded security events."
                : eventsError
                  ? "Risk information is unavailable because events could not be loaded."
                  : `${openEvents.length} open event(s), including ${criticalEvents.length} critical event(s).`}
            </p>
          </div>
          <div className="risk-breakdown">
            {["workflow-security", "secrets-security", "artifact-security"].map(
              (source) => {
                const sourceEvents = events.filter(
                  (event) => String(event.source || "").toLowerCase() === source
                );
                const sourceRisk = sourceEvents.length
                  ? sourceEvents.reduce(
                      (total, event) => total + Number(event.risk_score || 0),
                      0
                    ) / sourceEvents.length
                  : 0;
                return (
                  <div key={source}>
                    <span>
                      {source === "workflow-security"
                        ? "WORKFLOW"
                        : source === "secrets-security"
                          ? "SECRETS"
                          : "ARTIFACTS"}
                    </span>
                    <strong>{sourceEvents.length ? sourceRisk.toFixed(0) : "—"}</strong>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="panel-label">PIPELINE MONITOR</div>
            <h2>Active pipelines</h2>
            <p>Current health across monitored delivery pipelines.</p>
          </div>
          <button
            className="text-button"
            onClick={() => onNavigate("Pipelines")}
          >
            View all
            <ChevronRight size={12} />
          </button>
        </div>

        {pipelineLoading ? (
          <p>Loading pipelines from database...</p>
        ) : pipelineError ? (
          <p role="alert">Unable to load database pipelines: {pipelineError}</p>
        ) : pipelines.length === 0 ? (
          <p>No pipelines found in the database.</p>
        ) : (
          <div className="pipeline-grid">
            {pipelines.map((pipeline) => (
              <div className="pipeline-card" key={pipeline.pipeline_id}>
                <div className="pipeline-icon">
                  <GitBranch size={14} />
                </div>
                <div className="pipeline-info">
                  <strong>{pipeline.name}</strong>
                  <span>
                    <GitBranch size={9} />
                    {pipeline.branch || "No branch specified"}
                  </span>
                  <span>{pipeline.pipeline_id}</span>
                </div>
                <div className="pipeline-status">
                  <span
                    className={`status-dot ${
                      pipeline.status?.toUpperCase() === "ACTIVE"
                        ? "healthy"
                        : pipeline.status?.toLowerCase()
                    }`}
                  />
                  {pipeline.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="panel-label">INCIDENT STREAM</div>
            <h2>Recent security events</h2>
            <p>Latest events received from the backend.</p>
          </div>
          <button
            className="text-button"
            onClick={() => onNavigate("Threats")}
          >
            Threat center
            <ChevronRight size={12} />
          </button>
        </div>

        {eventsLoading ? (
          <p>Loading recent security events…</p>
        ) : eventsError ? (
          <p role="alert">Unable to load recent events: {eventsError}</p>
        ) : recentEvents.length === 0 ? (
          <p>No security events found in the backend.</p>
        ) : (
          <ThreatList
            items={recentEvents}
            onIncident={() => onNavigate("Incidents")}
          />
        )}
      </section>
    </>
  );
}

/* =========================================================
   THREATS
========================================================= */


function ThreatsPage({ onNavigate, events, loading, error }) {
  const mappedEvents = events.map((event) => {
    const severity = String(event.severity || "INFO").toLowerCase();

    return {
      id: event.event_id,
      severity:
        severity === "critical" || severity === "high"
          ? "critical"
          : severity === "medium" || severity === "warning"
            ? "warning"
            : "info",
      title: String(event.event_type || "Security event").replaceAll("_", " "),
      source: event.source || "Unknown source",
      risk: event.risk_score ?? 0,
      time: event.timestamp
        ? new Date(event.timestamp).toLocaleString()
        : "Time unavailable",
      status: event.status || "OPEN",
      description: event.description || "No description provided.",
    };
  });

  const openEvents = events.filter(
    (event) =>
      !["RESOLVED", "CLOSED"].includes(
        String(event.status || "").toUpperCase()
      )
  ).length;

  const criticalEvents = events.filter((event) =>
    ["CRITICAL", "HIGH"].includes(
      String(event.severity || "").toUpperCase()
    )
  ).length;

  const averageRisk = events.length
    ? Math.round(
        events.reduce((total, event) => total + (event.risk_score || 0), 0) /
          events.length
      )
    : 0;

  const blockedEvents = events.filter(
    (event) => String(event.status || "").toUpperCase() === "BLOCKED"
  ).length;

  const resolvedEvents = events.filter((event) =>
    ["RESOLVED", "CLOSED"].includes(
      String(event.status || "").toUpperCase()
    )
  ).length;

  return (
    <>
      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span>ACTIVE</span>
            <ShieldAlert size={16} />
          </div>
          <div className="metric-value">{String(openEvents).padStart(2, "0")}</div>
          <div className="metric-bottom">
            <span className="critical-text">
              {String(criticalEvents).padStart(2, "0")} high/critical
            </span>
            <span>open threats</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span>BLOCKED</span>
            <Ban size={16} />
          </div>
          <div className="metric-value">{blockedEvents}</div>
          <div className="metric-bottom">
            <span className="positive">recorded</span>
            <span>blocked events</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span>AVG RISK</span>
            <Activity size={16} />
          </div>
          <div className="metric-value">{averageRisk}</div>
          <div className="metric-bottom">
            <span className="warning-text">
              {averageRisk >= 80 ? "CRITICAL" : averageRisk >= 50 ? "HIGH" : "LOW"}
            </span>
            <span>event risk</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span>RESOLVED</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="metric-value">{resolvedEvents}</div>
          <div className="metric-bottom">
            <span className="positive">from database</span>
            <span>resolved events</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="panel-label">DETECTION FEED</div>
            <h2>Security threats</h2>
            <p>Security events retrieved from the PipelineGuard API.</p>
          </div>
        </div>

        {loading && <p>Loading security events...</p>}

        {!loading && error && (
          <p role="alert">Unable to load security events: {error}</p>
        )}

        {!loading && !error && mappedEvents.length === 0 && (
          <p>No security events have been recorded yet.</p>
        )}

        {!loading && !error && mappedEvents.length > 0 && (
          <ThreatList
            items={mappedEvents}
            onIncident={() => onNavigate("Incidents")}
          />
        )}
      </section>
    </>
  );
}
function ThreatList({ items, onIncident }) {
  return (
    <div className="threat-list">
      {items.map((incident) => (
        <button
          className="threat-row"
          key={incident.id}
          onClick={() => onIncident(incident)}
        >
          <div className={`threat-severity ${incident.severity}`}>
            <SeverityIcon severity={incident.severity} />
          </div>

          <div className="threat-main">
            <strong>{incident.title}</strong>
            <span>
              {incident.id} · {incident.source}
            </span>
          </div>

          <div className="threat-risk">
            <span>RISK</span>
            <strong>{incident.risk}</strong>
          </div>

          <div
            className={`threat-status ${incident.status.toLowerCase()}`}
          >
            {incident.status}
          </div>

          <div className="threat-time">
            <Clock3 size={9} />
            {incident.time}
          </div>

          <ChevronRight className="threat-arrow" size={13} />
        </button>
      ))}
    </div>
  );
}

/* =========================================================
   WORKFLOW SECURITY
========================================================= */

function WorkflowSecurityPage() {
  const workflowEvents = [
    {
      id: "WF-001",
      workflow: "deploy-production.yml",
      issue: "Command injection",
      source: "pull_request.title",
      risk: 96,
      status: "BLOCKED",
    },
    {
      id: "WF-002",
      workflow: "build.yml",
      issue: "Untrusted shell input",
      source: "github.event.issue.body",
      risk: 88,
      status: "BLOCKED",
    },
    {
      id: "WF-003",
      workflow: "release.yml",
      issue: "Suspicious command",
      source: "run step",
      risk: 72,
      status: "REVIEW",
    },
  ];

  return (
    <section className="panel">
      <PageHeader
        eyebrow="WORKFLOW DEFENSE"
        title="Workflow Security"
        description="Detecting injection, suspicious commands and unsafe GitHub Actions behavior."
      />

      <div className="security-summary">
        <div>
          <Workflow size={17} />
          <span>Workflow monitoring</span>
          <strong>ACTIVE</strong>
        </div>
        <div>
          <Terminal size={17} />
          <span>Command analysis</span>
          <strong>ENABLED</strong>
        </div>
        <div>
          <Shield size={17} />
          <span>Automatic blocking</span>
          <strong>ENABLED</strong>
        </div>
      </div>

      <div className="table">
        <div className="table-head">
          <span>WORKFLOW</span>
          <span>DETECTION</span>
          <span>SOURCE</span>
          <span>RISK</span>
          <span>STATUS</span>
        </div>

        {workflowEvents.map((event) => (
          <div className="table-row" key={event.id}>
            <div>
              <strong>{event.workflow}</strong>
              <small>{event.id}</small>
            </div>
            <span>{event.issue}</span>
            <code>{event.source}</code>
            <strong>{event.risk}</strong>
            <StatusBadge
              type={event.status === "BLOCKED" ? "danger" : "warning"}
            >
              {event.status}
            </StatusBadge>
          </div>
        ))}
      </div>
    </section>
  );
}

/* =========================================================
   SECRETS
========================================================= */

function SecretsPage() {
  return (
    <section className="panel">
      <PageHeader
        eyebrow="SECRET DEFENSE"
        title="Secrets"
        description="Credential exposure detection, masking and response."
      />

      <div className="secret-overview">
        <div className="security-summary-card">
          <KeyRound size={18} />
          <span>Secrets detected</span>
          <strong>04</strong>
        </div>

        <div className="security-summary-card">
          <Ban size={18} />
          <span>Blocked</span>
          <strong>02</strong>
        </div>

        <div className="security-summary-card">
          <Eye size={18} />
          <span>Masked</span>
          <strong>01</strong>
        </div>
      </div>

      <div className="table">
        <div className="table-head">
          <span>ID</span>
          <span>TYPE</span>
          <span>LOCATION</span>
          <span>SEVERITY</span>
          <span>STATUS</span>
        </div>

        {secrets.map((secret) => (
          <div className="table-row" key={secret.id}>
            <strong>{secret.id}</strong>
            <span>{secret.type}</span>
            <code>{secret.file}</code>
            <StatusBadge
              type={secret.severity === "critical" ? "danger" : "warning"}
            >
              {secret.severity.toUpperCase()}
            </StatusBadge>
            <StatusBadge
              type={secret.status === "BLOCKED" ? "danger" : "neutral"}
            >
              {secret.status}
            </StatusBadge>
          </div>
        ))}
      </div>
    </section>
  );
}

/* =========================================================
   ARTIFACTS
========================================================= */

function ArtifactsPage() {
  return (
    <section className="panel">
      <PageHeader
        eyebrow="ARTIFACT INTEGRITY"
        title="Artifacts"
        description="Hash verification and tamper detection for pipeline artifacts."
      />

      <div className="artifact-grid">
        {artifacts.map((artifact) => (
          <div className="artifact-card" key={artifact.id}>
            <div className="artifact-top">
              <div className="artifact-icon">
                <Package size={16} />
              </div>

              <StatusBadge
                type={artifact.status === "TAMPERED" ? "danger" : "success"}
              >
                {artifact.status}
              </StatusBadge>
            </div>

            <strong>{artifact.name}</strong>

            <div className="artifact-meta">
              <span>{artifact.id}</span>
              <code>{artifact.hash}</code>
            </div>

            <div className="artifact-risk">
              <span>RISK</span>
              <strong>{artifact.risk}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* =========================================================
   PIPELINES
========================================================= */

function PipelinesPage({ onNavigate, pipelines, pipelineLoading, pipelineError }) {
  return (
    <section className="panel">
      <PageHeader
        eyebrow="DELIVERY CONTROL"
        title="Pipelines"
        description="Monitored CI/CD pipelines and their current security state."
      />

      {pipelineLoading ? (
        <p>Loading pipelines from database...</p>
      ) : pipelineError ? (
        <p role="alert">Unable to load database pipelines: {pipelineError}</p>
      ) : pipelines.length === 0 ? (
        <p>No pipelines found in the database.</p>
      ) : (
        <div className="pipeline-large-grid">
          {pipelines.map((pipeline) => (
            <button
              className="pipeline-large-card"
              key={pipeline.pipeline_id}
              onClick={() => onNavigate("Runs")}
            >
              <div className="pipeline-large-header">
                <div className="pipeline-icon">
                  <GitBranch size={15} />
                </div>

                <span className={`status-dot ${pipeline.status?.toUpperCase() === "ACTIVE" ? "healthy" : pipeline.status?.toLowerCase()}`} />
              </div>

              <strong>{pipeline.name}</strong>

              <span className="branch-label">
                <GitBranch size={10} />
                {pipeline.branch || "No branch specified"}
              </span>

              <div className="pipeline-large-footer">
                <span>{pipeline.pipeline_id}</span>
                <span>{pipeline.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   RUNS
========================================================= */

function RunsPage({ runs, loading, error }) {
  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  };

  return (
    <section className="panel">
      <PageHeader
        eyebrow="EXECUTION TELEMETRY"
        title="Pipeline Runs"
        description="Recent CI/CD executions and security outcomes."
      />

      {loading ? (
        <p>Loading runs from database...</p>
      ) : error ? (
        <p role="alert">Unable to load pipeline runs: {error}</p>
      ) : runs.length === 0 ? (
        <p>No pipeline runs found in the database.</p>
      ) : (
        <div className="table">
          <div className="table-head">
            <span>RUN</span>
            <span>PIPELINE ID</span>
            <span>BRANCH</span>
            <span>STARTED</span>
            <span>STATUS</span>
          </div>

          {runs.map((run) => {
            const status = (run.status || "UNKNOWN").toUpperCase();
            const badgeType =
              status === "BLOCKED" || status === "FAILED"
                ? "danger"
                : status === "RUNNING"
                  ? "warning"
                  : "success";

            return (
              <div className="table-row" key={run.run_id}>
                <div>
                  <strong>{run.run_id}</strong>
                  <small>{formatDate(run.created_at)}</small>
                </div>

                <span>{run.pipeline_id}</span>

                <code>{run.branch || "—"}</code>

                <span>{formatDate(run.started_at)}</span>

                <StatusBadge type={badgeType}>
                  {status}
                </StatusBadge>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   SETTINGS
========================================================= */

function IncidentsPage({
  events = [],
  loading = false,
  error = "",
  onStatusUpdated,
}) {
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [statusSuccess, setStatusSuccess] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");

  const incidentEvents = events.map((event) => {
    const rawType = event.event_type || "Security event";
    const title = rawType
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());

    let reportedTime = "—";
    if (event.timestamp) {
      const parsedDate = new Date(event.timestamp);
      if (!Number.isNaN(parsedDate.getTime())) {
        reportedTime = parsedDate.toLocaleString();
      }
    }

    return {
      id: event.event_id || "—",
      title,
      source: event.source || "Unknown",
      severity: event.severity || "UNKNOWN",
      risk: event.risk_score ?? "—",
      status: event.status || "UNKNOWN",
      description: event.description || "No description provided.",
      time: reportedTime,
    };
  });

  const countByStatus = (status) =>
    incidentEvents.filter(
      (incident) => incident.status.toUpperCase() === status
    ).length;

  const availableSources = [
    ...new Set(incidentEvents.map((incident) => incident.source)),
  ].sort();

  const filteredIncidents = incidentEvents.filter((incident) => {
    const matchesSeverity =
      severityFilter === "ALL" ||
      incident.severity.toUpperCase() === severityFilter;

    const matchesStatus =
      statusFilter === "ALL" ||
      incident.status.toUpperCase() === statusFilter;

    const matchesSource =
      sourceFilter === "ALL" || incident.source === sourceFilter;

    return matchesSeverity && matchesStatus && matchesSource;
  });

  return (
    <div className="page-content">
      <PageHeader
        eyebrow="RESPONSE CENTER"
        title="Incidents"
        description="Review, investigate, and track security incidents."
      />

      {loading ? (
        <section className="panel">
          <p>Loading incidents from the backend...</p>
        </section>
      ) : error ? (
        <section className="panel">
          <h2>Unable to load incidents</h2>
          <p>{error}</p>
          <p>Check that the backend is running and the events API is available.</p>
        </section>
      ) : selectedIncident ? (
        <section className="panel incident-detail">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSelectedIncident(null)}
          >
            ← Back to incidents
          </button>

          <div className="detail-head">
            <div className="panel-label">{selectedIncident.id}</div>
            <h2>{selectedIncident.title}</h2>
            <p>{selectedIncident.description}</p>
          </div>

          <dl className="detail-grid">
            <div>
              <dt>Source</dt>
              <dd>{selectedIncident.source}</dd>
            </div>
            <div>
              <dt>Severity</dt>
              <dd>
                <span
                  className={`sev-pill sev-${String(selectedIncident.severity).toLowerCase()}`}
                >
                  {selectedIncident.severity}
                </span>
              </dd>
            </div>
            <div>
              <dt>Risk score</dt>
              <dd>
                <span className="detail-risk">{selectedIncident.risk}</span>
                <span className="detail-risk-max">/100</span>
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span
                  className={`threat-status ${String(selectedIncident.status).toLowerCase()}`}
                >
                  {selectedIncident.status}
                </span>
              </dd>
            </div>
            <div>
              <dt>Reported</dt>
              <dd>{selectedIncident.time}</dd>
            </div>
          </dl>

          <div className="status-editor">
            <label htmlFor="incident-status">
              <strong>Update incident status</strong>
            </label>
            <select
              id="incident-status"
              className="select"
              value={newStatus || selectedIncident.status}
              onChange={(event) => {
                setNewStatus(event.target.value);
                setStatusError("");
                setStatusSuccess("");
              }}
              disabled={statusSaving}
            >
              <option value="OPEN">OPEN</option>
              <option value="INVESTIGATING">INVESTIGATING</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
            </select>

            <button
              type="button"
              className="btn-primary"
              disabled={
                statusSaving ||
                !(newStatus || selectedIncident.status) ||
                (newStatus || selectedIncident.status) === selectedIncident.status
              }
              onClick={async () => {
                const targetStatus = newStatus || selectedIncident.status;
                setStatusSaving(true);
                setStatusError("");
                setStatusSuccess("");

                try {
                  const updated = await updateSecurityEventStatus(
                    selectedIncident.id,
                    targetStatus
                  );
                  setSelectedIncident((current) =>
                    current && current.id === updated.event_id
                      ? { ...current, status: updated.status }
                      : current
                  );
                  setNewStatus("");
                  setStatusSuccess("Incident status updated successfully.");
                  if (onStatusUpdated) {
                    await onStatusUpdated();
                  }
                } catch (updateError) {
                  setStatusError(
                    updateError.message || "Unable to update incident status."
                  );
                } finally {
                  setStatusSaving(false);
                }
              }}
            >
              {statusSaving ? "Saving..." : "Save status"}
            </button>

            {statusError && (
              <p role="alert" className="form-msg form-msg-error">
                {statusError}
              </p>
            )}
            {statusSuccess && (
              <p role="status" className="form-msg form-msg-success">
                {statusSuccess}
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="panel">
          <h2>Incident queue</h2>
          <p>
            {incidentEvents.length > 0
              ? `${incidentEvents.length} security event(s) received from the backend. Select one to inspect its details.`
              : "No security events have been returned by the backend yet."}
          </p>

          <div className="metrics-grid">
            {[
              { label: "OPEN", value: countByStatus("OPEN") },
              { label: "INVESTIGATING", value: countByStatus("INVESTIGATING") },
              { label: "RESOLVED", value: countByStatus("RESOLVED") },
              { label: "FALSE POSITIVE", value: countByStatus("FALSE_POSITIVE") },
            ].map((metric) => (
              <div className="metric-card" key={metric.label}>
                <div className="metric-top">{metric.label}</div>
                <div className="metric-value">{metric.value}</div>
                <div className="metric-bottom">Security incidents</div>
              </div>
            ))}
          </div>

          <div className="incident-filters">
            <label className="incident-filter">
              Severity
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
              >
                <option value="ALL">All severities</option>
                {[...new Set(incidentEvents.map((item) => item.severity.toUpperCase()))]
                  .sort()
                  .map((severity) => (
                    <option key={severity} value={severity}>{severity}</option>
                  ))}
              </select>
            </label>

            <label className="incident-filter">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="INVESTIGATING">INVESTIGATING</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
              </select>
            </label>

            <label className="incident-filter">
              Source
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                <option value="ALL">All sources</option>
                {availableSources.map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </label>
          </div>

          <p>
            Showing {filteredIncidents.length} of {incidentEvents.length} incidents.
          </p>

          <div className="incident-list">
            {filteredIncidents.length === 0 ? (
              <p>No incidents match the selected filters.</p>
            ) : filteredIncidents.map((incident) => (
              <button
                key={incident.id}
                type="button"
                className="incident-row"
                onClick={() => setSelectedIncident(incident)}
              >
                <span className="incident-main">
                  <strong>{incident.title}</strong>
                  <small>
                    {incident.id} · {incident.source}
                  </small>
                  <small>
                    <span
                      className={`sev-pill sev-${String(incident.severity).toLowerCase()}`}
                    >
                      {incident.severity}
                    </span>
                  </small>
                </span>
                <span className="incident-side">
                  <strong>
                    {incident.risk}
                    <em>/100</em>
                  </strong>
                  <small>{incident.status}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SettingsPage() {
  const [settings, setSettings] = useState({
    workflowBlocking: true,
    secretScanning: true,
    artifactVerification: true,
    auditLogging: true,
  });

  const toggle = (key) => {
    setSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const rows = [
    {
      key: "workflowBlocking",
      title: "Automatic workflow blocking",
      description: "Block pipelines when critical workflow threats are detected.",
    },
    {
      key: "secretScanning",
      title: "Secret scanning",
      description: "Scan repository and pipeline inputs for credential exposure.",
    },
    {
      key: "artifactVerification",
      title: "Artifact verification",
      description: "Verify artifact hashes before downstream deployment.",
    },
    {
      key: "auditLogging",
      title: "Audit logging",
      description: "Record security actions and response events.",
    },
  ];

  return (
    <section className="panel">
      <PageHeader
        eyebrow="CONTROL PLANE"
        title="Settings"
        description="Configure PipelineGuard detection and response behavior."
      />

      <div className="settings-list">
        {rows.map((row) => (
          <div className="settings-row" key={row.key}>
            <div>
              <strong>{row.title}</strong>
              <span>{row.description}</span>
            </div>

            <button
              className={`toggle ${settings[row.key] ? "active" : ""}`}
              onClick={() => toggle(row.key)}
              aria-label={row.title}
            >
              <span />
            </button>
          </div>
        ))}
      </div>

      <div className="settings-footer">
        <Database size={15} />
        <span>
          Pipeline and security event data are connected to the backend.
          Settings persistence is not yet connected to PostgreSQL.
        </span>
      </div>
    </section>
  );
}

/* =========================================================
   APP
========================================================= */


export default function App() {
  const [activePage, setActivePage] = useState(() => {
    const savedPage = window.history.state?.pipelineGuardPage;
    return typeof savedPage === "string" ? savedPage : "Overview";
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
const [backendStatus, setBackendStatus] = useState("CONNECTING");
  const [dbPipelines, setDbPipelines] = useState([]);
  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [pipelineError, setPipelineError] = useState("");
  const [dbRuns, setDbRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState("");

const [dbSecurityEvents, setDbSecurityEvents] = useState([]);
const [securityEventsLoading, setSecurityEventsLoading] = useState(true);
const [securityEventsError, setSecurityEventsError] = useState("");

  useEffect(() => {
    getBackendHealth()
      .then(() => {
        setBackendStatus("CONNECTED");
      })
      .catch(() => {
        setBackendStatus("OFFLINE");
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    getPipelines()
      .then((data) => {
        if (!cancelled) {
          setDbPipelines(data);
          setPipelineError("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPipelineError(error.message || "Unable to load pipelines");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPipelineLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

const refreshSecurityEvents = async () => {
  try {
    const data = await getSecurityEvents();
    setDbSecurityEvents(data);
    setSecurityEventsError("");
  } catch (error) {
    setSecurityEventsError(
      error.message || "Unable to refresh security events"
    );
    throw error;
  }
};

useEffect(() => {
  let cancelled = false;

  getSecurityEvents()
    .then((data) => {
      if (!cancelled) {
        setDbSecurityEvents(data);
        setSecurityEventsError("");
      }
    })
    .catch((error) => {
      if (!cancelled) {
        setSecurityEventsError(
          error.message || "Unable to load security events"
        );
      }
    })
    .finally(() => {
      if (!cancelled) {
        setSecurityEventsLoading(false);
      }
    });

  return () => {
    cancelled = true;
  };
}, []);


  useEffect(() => {
    let cancelled = false;

    getRuns()
      .then((data) => {
        if (!cancelled) {
          setDbRuns(data);
          setRunsError("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRunsError(
            error.message || "Unable to load pipeline runs"
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRunsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    const currentState = window.history.state || {};

    if (currentState.pipelineGuardPage !== activePage) {
      window.history.replaceState(
        {
          ...currentState,
          pipelineGuardPage: activePage,
          pipelineGuardDepth: 0,
        },
        ""
      );
    }

    const handlePopState = (event) => {
      const page = event.state?.pipelineGuardPage;

      setActivePage(
        typeof page === "string" ? page : "Overview"
      );

      setSearchOpen(false);
      setNavOpen(false);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const handleNavigation = (page) => {
    if (page !== activePage) {
      const currentState = window.history.state || {};
      const depth = Number(currentState.pipelineGuardDepth) || 0;

      window.history.pushState(
        {
          ...currentState,
          pipelineGuardPage: page,
          pipelineGuardDepth: depth + 1,
        },
        ""
      );

      setActivePage(page);
    }

    setSearchOpen(false);
    setNavOpen(false);
  };

  const handleBackNavigation = () => {
    const currentState = window.history.state || {};
    const depth = Number(currentState.pipelineGuardDepth) || 0;

    if (depth > 0) {
      window.history.back();
    } else if (activePage !== "Overview") {
      handleNavigation("Overview");
    }
  };

  useEffect(() => {
    const handleKeys = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      } else if (event.key === "Escape") {
        setSearchOpen(false);
        setNavOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, []);

  const searchItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return [];

    const pages = [
      "Overview",
      "Threats",
      "Workflow Security",
      "Secrets",
      "Artifacts",
      "Pipelines",
      "Runs",
      "Incidents",
      "Audit Log",
      "Settings",
    ];

    const pageResults = pages.filter((page) =>
      page.toLowerCase().includes(query)
    );

    const incidentResults = incidents
      .filter(
        (incident) =>
          incident.title.toLowerCase().includes(query) ||
          incident.id.toLowerCase().includes(query) ||
          incident.source.toLowerCase().includes(query)
      )
      .map((incident) => incident.title);

    return [...new Set([...pageResults, ...incidentResults])].slice(0, 8);
  }, [searchQuery]);

  const renderPage = () => {
    switch (activePage) {
      case "Threats":
return (
  <ThreatsPage
    onNavigate={handleNavigation}
    events={dbSecurityEvents}
    loading={securityEventsLoading}
    error={securityEventsError}
  />
);
      case "Workflow Security":
        return <WorkflowSecurityPage />;

      case "Secrets":
        return <SecretsPage />;

      case "Artifacts":
        return <ArtifactsPage />;

      case "Pipelines":
        return <PipelinesPage onNavigate={handleNavigation} pipelines={dbPipelines} pipelineLoading={pipelineLoading} pipelineError={pipelineError} />;

      case "Runs":
        return <RunsPage runs={dbRuns} loading={runsLoading} error={runsError} />;

      case "Incidents":
        return (
          <IncidentsPage
            events={dbSecurityEvents}
            loading={securityEventsLoading}
            error={securityEventsError}
            onStatusUpdated={refreshSecurityEvents}
          />
        );

      case "Audit Log":
        return <AuditLogPage />;

      case "Settings":
        return <SettingsPage />;

      case "Overview":
      default:
        return (
          <OverviewPage
            onNavigate={handleNavigation}
            pipelines={dbPipelines}
            pipelineLoading={pipelineLoading}
            pipelineError={pipelineError}
            events={dbSecurityEvents}
            eventsLoading={securityEventsLoading}
            eventsError={securityEventsError}
          />
        );
    }
  };

return (
    <div className="app-shell">
      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Shield size={17} />
          </div>

          <div>
            <strong>PIPELINEGUARD</strong>
            <span>SECURITY CONTROL</span>
          </div>
        </div>

        <div className="workspace">
          <div className="workspace-label">WORKSPACE</div>

          <div className="workspace-select">
            <div className="workspace-avatar">PG</div>

            <div>
              <strong>PipelineGuard</strong>
              <span>Production</span>
            </div>

            <ChevronRight size={12} />
          </div>
        </div>

        <nav className="navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.section}>
              <div className="nav-section">{group.section}</div>

              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.name;

                return (
                  <button
                    key={item.name}
                    className={`nav-item ${active ? "active" : ""}`}
                    onClick={() => handleNavigation(item.name)}
                  >
                    <Icon size={15} />
                    <span>{item.name}</span>

                    {item.badge && (
                      <span className="nav-badge">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className={`nav-item ${
              activePage === "Settings" ? "active" : ""
            }`}
            onClick={() => handleNavigation("Settings")}
          >
            <Settings size={15} />
            <span>Settings</span>
          </button>

          <div className="system-status">
            <span className="status-dot healthy" />
            <div>
              <strong>ENGINE ONLINE</strong>
              <span>v0.1.0 · PHASE 1</span>
            </div>
          </div>
        </div>
      </aside>

      <div
        className={`sidebar-scrim ${navOpen ? "open" : ""}`}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      <main className="main-content">
        <header className="top-header">
          <button
            type="button"
            className="menu-button"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={18} />
          </button>

          <div className="breadcrumb">
            {activePage !== "Overview" && (
              <button
                type="button"
                className="breadcrumb-back"
                onClick={handleBackNavigation}
                aria-label="Go back to previous page"
                title="Go back"
              >
                ←
              </button>
            )}
            <span>PIPELINEGUARD</span>
            <ChevronRight size={11} />
            <strong>{activePage.toUpperCase()}</strong>
          </div>

          <div className="header-actions">
            <button
              className="search-trigger"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={14} />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>

            <div className="header-divider" />

            <div className="header-status">
              <span className="status-dot healthy" />
              <span>ALL SYSTEMS OPERATIONAL</span>
            </div>

            <div className="profile">
              <div className="profile-avatar">HV</div>
            </div>

          </div>
        </header>

        <div className="page-content" key={activePage}>
          {renderPage()}

          <footer className="app-footer">
            <span>PIPELINEGUARD SECURITY CONTROL</span>
            <span>PHASE 1 · DATABASE CONNECTED</span>
          </footer>
        </div>
      </main>

      {searchOpen && (
        <div
          className="search-overlay"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="search-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="search-input-wrapper">
              <Search size={17} />

              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search PipelineGuard..."
              />

              <button onClick={() => setSearchOpen(false)}>
                <X size={15} />
              </button>
            </div>

            {searchQuery && (
              <div className="search-results">
                {searchItems.length > 0 ? (
                  searchItems.map((result) => (
                    <button
                      key={result}
                      onClick={() => {
                        const page = [
                          "Overview",
                          "Threats",
                          "Workflow Security",
                          "Secrets",
                          "Artifacts",
                          "Pipelines",
                          "Runs",
                          "Incidents",
                          "Audit Log",
                          "Settings",
                        ].find((item) => item === result);

                        if (page) {
                          handleNavigation(page);
                        } else {
                          handleNavigation("Incidents");
                        }
                      }}
                    >
                      <Search size={13} />
                      <span>{result}</span>
                      <ChevronRight size={12} />
                    </button>
                  ))
                ) : (
                  <EmptyState
                    icon={Search}
                    title="No results"
                    description="No matching PipelineGuard modules or incidents."
                  />
                )}
              </div>
            )}

            {!searchQuery && (
              <div className="search-hint">
                <Search size={15} />
                <span>
                  Search modules, incidents, pipelines and security events.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    import("./services/api")
      .then(({ getAuditLogs }) => getAuditLogs())
      .then((data) => {
        if (!cancelled) setLogs(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load audit logs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page-content">
      <div className="page-header">
        <div>
          <div className="eyebrow">ACCOUNTABILITY</div>
          <h1>Audit Log</h1>
          <p>Recorded security incident status changes.</p>
        </div>
      </div>

      {loading ? (
        <p>Loading audit records...</p>
      ) : error ? (
        <p role="alert">Could not load audit records: {error}</p>
      ) : logs.length === 0 ? (
        <p>No audit records found.</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Incident ID</th>
                <th>Previous status</th>
                <th>New status</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    {log.changed_at
                      ? new Date(log.changed_at).toLocaleString()
                      : "—"}
                  </td>
                  <td>{log.event_id}</td>
                  <td>{log.previous_status}</td>
                  <td>{log.new_status}</td>
                  <td>{log.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
