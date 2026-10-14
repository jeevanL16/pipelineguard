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

function OverviewPage({ onNavigate, pipelines, pipelineLoading, pipelineError }) {
  return (
    <>
      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span>PIPELINES</span>
            <GitBranch size={16} />
          </div>
          <div className="metric-value">24</div>
          <div className="metric-bottom">
            <span className="positive">+12.4%</span>
            <span>vs last week</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span>ACTIVE THREATS</span>
            <ShieldAlert size={16} />
          </div>
          <div className="metric-value">07</div>
          <div className="metric-bottom">
            <span className="critical-text">03 critical</span>
            <span>requiring attention</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span>BLOCKED</span>
            <Ban size={16} />
          </div>
          <div className="metric-value">12</div>
          <div className="metric-bottom">
            <span className="positive">100%</span>
            <span>automated response</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span>RISK INDEX</span>
            <Activity size={16} />
          </div>
          <div className="metric-value">87.4</div>
          <div className="metric-bottom">
            <span className="warning-text">HIGH</span>
            <span>current exposure</span>
          </div>
        </div>
      </section>

      <section className="main-grid">
        <div className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <div className="panel-label">SECURITY TELEMETRY</div>
              <h2>Event activity</h2>
              <p>Security events detected across monitored pipelines.</p>
            </div>

            <div className="live-pill">
              <span className="live-dot" />
              LIVE STREAM
            </div>
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient
                    id="activityGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#8b8b83"
                      stopOpacity={0.12}
                    />
                    <stop
                      offset="100%"
                      stopColor="#8b8b83"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#1a1e20"
                />

                <XAxis
                  dataKey="time"
                  tick={{ fill: "#4f544f", fontSize: 8 }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  tick={{ fill: "#4f544f", fontSize: 8 }}
                  axisLine={false}
                  tickLine={false}
                  width={25}
                />

                <Tooltip
                  contentStyle={{
                    background: "#0c0f11",
                    border: "1px solid #292d30",
                    borderRadius: "6px",
                    color: "#c9cac4",
                    fontSize: "10px",
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="events"
                  stroke="#8b8b83"
                  strokeWidth={1.5}
                  fill="url(#activityGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel risk-panel">
          <div className="panel-heading">
            <div>
              <div className="panel-label">RISK ENGINE</div>
              <h2>Risk index</h2>
              <p>Current pipeline exposure.</p>
            </div>
          </div>

          <div className="risk-display">
            <div className="risk-ring">
              <div className="risk-ring-inner">
                <strong>87.4</strong>
                <span>/100</span>
              </div>
            </div>

            <div className="risk-state">
              <span />
              HIGH EXPOSURE
            </div>

            <p>
              Three critical security events currently require investigation.
            </p>
          </div>

          <div className="risk-breakdown">
            <div>
              <span>WORKFLOW</span>
              <strong>91</strong>
            </div>
            <div>
              <span>SECRETS</span>
              <strong>94</strong>
            </div>
            <div>
              <span>ARTIFACTS</span>
              <strong>77</strong>
            </div>
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
                  <span className={`status-dot ${pipeline.status?.toUpperCase() === "ACTIVE" ? "healthy" : pipeline.status?.toLowerCase()}`} />
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
            <p>Latest events requiring monitoring or response.</p>
          </div>

          <button
            className="text-button"
            onClick={() => onNavigate("Threats")}
          >
            Threat center
            <ChevronRight size={12} />
          </button>
        </div>

        <ThreatList
          items={incidents.slice(0, 4)}
          onIncident={() => onNavigate("Incidents")}
        />
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
        <section className="panel">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSelectedIncident(null)}
          >
            Back to incidents
          </button>
          <h2>{selectedIncident.title}</h2>
          <p>{selectedIncident.description}</p>
          <p><strong>ID:</strong> {selectedIncident.id}</p>
          <p><strong>Source:</strong> {selectedIncident.source}</p>
          <p><strong>Severity:</strong> {selectedIncident.severity}</p>
          <p><strong>Risk score:</strong> {selectedIncident.risk}/100</p>
          <p><strong>Status:</strong> {selectedIncident.status}</p>
          <p><strong>Reported:</strong> {selectedIncident.time}</p>

          <div style={{ marginTop: "20px", maxWidth: "360px" }}>
            <label htmlFor="incident-status">
              <strong>Update incident status</strong>
            </label>
            <select
              id="incident-status"
              value={newStatus || selectedIncident.status}
              onChange={(event) => {
                setNewStatus(event.target.value);
                setStatusError("");
                setStatusSuccess("");
              }}
              disabled={statusSaving}
              style={{
                display: "block",
                width: "100%",
                padding: "10px",
                marginTop: "8px",
                background: "var(--panel-background, #171717)",
                color: "inherit",
                border: "1px solid var(--border-color, #303030)",
                borderRadius: "8px",
              }}
            >
              <option value="OPEN">OPEN</option>
              <option value="INVESTIGATING">INVESTIGATING</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
            </select>

            <button
              type="button"
              className="secondary-button"
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
              style={{ marginTop: "10px" }}
            >
              {statusSaving ? "Saving..." : "Save status"}
            </button>

            {statusError && (
              <p role="alert" style={{ color: "#f87171" }}>
                {statusError}
              </p>
            )}
            {statusSuccess && (
              <p role="status" style={{ color: "#4ade80" }}>
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

          <div className="incident-list">
            {incidentEvents.map((incident) => (
              <button
                key={incident.id}
                type="button"
                className="incident-row"
                onClick={() => setSelectedIncident(incident)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                  width: "100%",
                  padding: "16px",
                  marginTop: "10px",
                  textAlign: "left",
                  cursor: "pointer",
                  background: "transparent",
                  color: "inherit",
                  border: "1px solid var(--border-color, #303030)",
                  borderRadius: "10px"
                }}
              >
                <span>
                  <strong>{incident.title}</strong>
                  <br />
                  <small>{incident.id} · {incident.source}</small>
                  <br />
                  <small>{incident.severity}</small>
                </span>
                <span>
                  <strong>{incident.risk}/100</strong>
                  <br />
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
          Phase 1 uses local mock state. PostgreSQL integration will replace
          this configuration layer in Phase 2.
        </span>
      </div>
    </section>
  );
}

/* =========================================================
   APP
========================================================= */

export default function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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


  const handleNavigation = (page) => {
    setActivePage(page);
    setSearchOpen(false);
  };

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
        return <OverviewPage onNavigate={handleNavigation} pipelines={dbPipelines} pipelineLoading={pipelineLoading} pipelineError={pipelineError} />;
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
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

      <main className="main-content">
        <header className="top-header">
          <div className="breadcrumb">
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
              <kbd>⌘ K</kbd>
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

        <div className="page-content">
          {renderPage()}

          <footer className="app-footer">
            <span>PIPELINEGUARD SECURITY CONTROL</span>
            <span>PHASE 1 · MOCK DATA</span>
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
