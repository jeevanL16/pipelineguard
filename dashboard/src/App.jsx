import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  GitBranch,
  Clock,
  Server,
  LockKeyhole,
  Package,
  ShieldCheck
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from "recharts";

import "./App.css";

const incidents = [
  {
    id: "INC-001",
    severity: "HIGH",
    threat: "Workflow Injection",
    source: "GitHub Actions",
    risk: 90,
    status: "OPEN",
    time: "2 min ago"
  },
  {
    id: "INC-002",
    severity: "HIGH",
    threat: "Secret Exposure",
    source: "Gitleaks",
    risk: 95,
    status: "OPEN",
    time: "8 min ago"
  },
  {
    id: "INC-003",
    severity: "MEDIUM",
    threat: "Dependency Change",
    source: "GitHub Actions",
    risk: 55,
    status: "REVIEW",
    time: "21 min ago"
  },
  {
    id: "INC-004",
    severity: "HIGH",
    threat: "Artifact Tampering",
    source: "Artifact Guard",
    risk: 88,
    status: "BLOCKED",
    time: "34 min ago"
  },
  {
    id: "INC-005",
    severity: "LOW",
    threat: "Configuration Change",
    source: "Pipeline Guard",
    risk: 25,
    status: "RESOLVED",
    time: "1 hr ago"
  }
];

const activityData = [
  { name: "10:00", threats: 2 },
  { name: "11:00", threats: 4 },
  { name: "12:00", threats: 3 },
  { name: "13:00", threats: 6 },
  { name: "14:00", threats: 4 },
  { name: "15:00", threats: 7 },
  { name: "16:00", threats: 5 }
];

const severityData = [
  { name: "High", value: 3 },
  { name: "Medium", value: 2 },
  { name: "Low", value: 2 }
];

function StatCard({ icon: Icon, title, value, subtitle }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">
        <Icon size={21} />
      </div>

      <div>
        <p className="stat-title">{title}</p>
        <h2>{value}</h2>
        <p className="stat-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  return (
    <span className={`severity ${severity.toLowerCase()}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`status ${status.toLowerCase()}`}>
      {status}
    </span>
  );
}

function App() {
  return (
    <div className="app">

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={25} />
          </div>

          <div>
            <h1>PipelineGuard</h1>
            <span>Security Platform</span>
          </div>
        </div>

        <nav className="navigation">

          <a className="nav-item active">
            <Activity size={19} />
            Overview
          </a>

          <a className="nav-item">
            <AlertTriangle size={19} />
            Incidents
            <span className="nav-count">7</span>
          </a>

          <a className="nav-item">
            <GitBranch size={19} />
            Pipelines
          </a>

          <a className="nav-item">
            <LockKeyhole size={19} />
            Secrets
          </a>

          <a className="nav-item">
            <Package size={19} />
            Artifacts
          </a>

          <a className="nav-item">
            <Server size={19} />
            Infrastructure
          </a>

        </nav>

        <div className="system-status">
          <div className="online-dot"></div>

          <div>
            <strong>System Operational</strong>
            <span>All services running</span>
          </div>
        </div>

      </aside>

      <main className="main">

        <header className="topbar">

          <div>
            <p className="breadcrumb">Security Operations / Overview</p>
            <h2>Security Dashboard</h2>
          </div>

          <div className="header-right">

            <div className="live-status">
              <span></span>
              LIVE
            </div>

            <div className="user">
              <div className="avatar">VH</div>

              <div>
                <strong>Security Admin</strong>
                <small>PipelineGuard</small>
              </div>
            </div>

          </div>

        </header>

        <section className="content">

          <div className="stats-grid">

            <StatCard
              icon={GitBranch}
              title="Pipelines"
              value="24"
              subtitle="+4 today"
            />

            <StatCard
              icon={AlertTriangle}
              title="Active Threats"
              value="7"
              subtitle="3 high severity"
            />

            <StatCard
              icon={ShieldAlert}
              title="Blocked"
              value="12"
              subtitle="This month"
            />

            <StatCard
              icon={CheckCircle}
              title="Risk Score"
              value="87/100"
              subtitle="Current environment"
            />

          </div>

          <div className="charts-grid">

            <section className="panel">

              <div className="panel-header">
                <div>
                  <h3>Security Activity</h3>
                  <p>Threat events detected over time</p>
                </div>

                <div className="panel-badge">
                  <Activity size={15} />
                  Last 7 hours
                </div>
              </div>

              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityData}>

                    <defs>
                      <linearGradient
                        id="threatGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopOpacity={0.3}
                        />

                        <stop
                          offset="100%"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      opacity={0.15}
                    />

                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip />

                    <Area
                      type="monotone"
                      dataKey="threats"
                      strokeWidth={2}
                      fill="url(#threatGradient)"
                    />

                  </AreaChart>
                </ResponsiveContainer>
              </div>

            </section>

            <section className="panel">

              <div className="panel-header">

                <div>
                  <h3>Threat Distribution</h3>
                  <p>Current severity breakdown</p>
                </div>

              </div>

              <div className="severity-chart">

                <ResponsiveContainer width="100%" height="100%">

                  <PieChart>

                    <Pie
                      data={severityData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                    >

                      {severityData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                        />
                      ))}

                    </Pie>

                    <Tooltip />

                  </PieChart>

                </ResponsiveContainer>

                <div className="chart-center">
                  <strong>7</strong>
                  <span>Threats</span>
                </div>

              </div>

              <div className="legend">

                <div>
                  <span className="legend-dot high"></span>
                  HIGH
                  <strong>3</strong>
                </div>

                <div>
                  <span className="legend-dot medium"></span>
                  MEDIUM
                  <strong>2</strong>
                </div>

                <div>
                  <span className="legend-dot low"></span>
                  LOW
                  <strong>2</strong>
                </div>

              </div>

            </section>

          </div>

          <section className="panel incidents-panel">

            <div className="panel-header">

              <div>
                <h3>Recent Security Incidents</h3>
                <p>Latest events detected by PipelineGuard</p>
              </div>

              <button className="view-all">
                View all incidents
              </button>

            </div>

            <div className="table-wrapper">

              <table>

                <thead>
                  <tr>
                    <th>Incident</th>
                    <th>Severity</th>
                    <th>Threat</th>
                    <th>Source</th>
                    <th>Risk</th>
                    <th>Status</th>
                    <th>Detected</th>
                  </tr>
                </thead>

                <tbody>

                  {incidents.map((incident) => (

                    <tr key={incident.id}>

                      <td className="incident-id">
                        {incident.id}
                      </td>

                      <td>
                        <SeverityBadge
                          severity={incident.severity}
                        />
                      </td>

                      <td>
                        <strong>{incident.threat}</strong>
                      </td>

                      <td className="muted">
                        {incident.source}
                      </td>

                      <td>
                        <div className="risk">
                          <span>{incident.risk}</span>

                          <div className="risk-bar">
                            <div
                              style={{
                                width: `${incident.risk}%`
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td>
                        <StatusBadge
                          status={incident.status}
                        />
                      </td>

                      <td className="muted">
                        <Clock size={14} />
                        {incident.time}
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </section>

        </section>

      </main>

    </div>
  );
}

export default App;
