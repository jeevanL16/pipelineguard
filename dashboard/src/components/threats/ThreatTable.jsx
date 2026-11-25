import React, { useState } from "react";
import {
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const SEVERITY_COLORS = {
  CRITICAL: "bg-rose-950/80 text-rose-400 border-rose-800",
  HIGH: "bg-amber-950/80 text-amber-400 border-amber-800",
  MEDIUM: "bg-yellow-950/80 text-yellow-400 border-yellow-800",
  LOW: "bg-blue-950/80 text-blue-400 border-blue-800",
  INFO: "bg-gray-800 text-gray-300 border-gray-700",
};

const STATUS_OPTIONS = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"];

export function ThreatTable({
  events = [],
  loading = false,
  error = null,
  onStatusUpdate = () => {},
}) {
  const [filterSeverity, setFilterSeverity] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const filteredEvents = events.filter((e) => {
    const matchSev = filterSeverity === "ALL" || e.severity === filterSeverity;
    const matchStat = filterStatus === "ALL" || e.status === filterStatus;
    return matchSev && matchStat;
  });

  const handleStatusChange = async (eventId, newStatus) => {
    try {
      setUpdatingId(eventId);
      await onStatusUpdate(eventId, newStatus);
    } catch (err) {
      alert("Failed to update status: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="bg-[#111827] border border-[#1f293d] rounded-xl overflow-hidden shadow-lg">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-[#1f293d] flex flex-wrap items-center justify-between gap-4 bg-[#0e1320]/50">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            Security Threat Events
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#1e293b] text-gray-300 font-normal">
              {filteredEvents.length} findings
            </span>
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Detections from workflow AST parsing, secrets engine, and artifact integrity
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-[#161f33] px-2.5 py-1.5 rounded-lg border border-[#27354f]">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-transparent text-gray-200 focus:outline-none text-xs"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-[#161f33] px-2.5 py-1.5 rounded-lg border border-[#27354f]">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent text-gray-200 focus:outline-none text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/40 border-b border-rose-900/50 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table view */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0e1320] text-gray-400 font-semibold uppercase tracking-wider border-b border-[#1f293d]">
            <tr>
              <th className="py-3 px-4">Event ID / Type</th>
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">Risk</th>
              <th className="py-3 px-4">Source</th>
              <th className="py-3 px-4">Pipeline</th>
              <th className="py-3 px-4">Status & Action</th>
              <th className="py-3 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f293d] text-gray-300">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-gray-500">
                  {loading ? "Loading telemetry..." : "No threat events matching filters."}
                </td>
              </tr>
            ) : (
              filteredEvents.map((evt) => {
                const id = evt.event_id || evt.id;
                const isExpanded = expandedId === id;
                const sevClass =
                  SEVERITY_COLORS[evt.severity?.toUpperCase()] || SEVERITY_COLORS.INFO;

                return (
                  <React.Fragment key={id}>
                    <tr className="hover:bg-[#161f33]/50 transition">
                      <td className="py-3 px-4 font-mono font-medium text-white">
                        <div>{evt.event_type || "SECURITY_FINDING"}</div>
                        <div className="text-[10px] text-gray-500">{id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${sevClass}`}
                        >
                          {evt.severity || "INFO"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-mono font-bold ${
                            Number(evt.risk_score) >= 75
                              ? "text-rose-400"
                              : Number(evt.risk_score) >= 50
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {evt.risk_score ?? "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-400">
                        {evt.source || "analyzer"}
                      </td>
                      <td className="py-3 px-4 text-gray-300 font-mono text-[11px]">
                        {evt.pipeline_id || "global"}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          disabled={updatingId === id}
                          value={evt.status || "OPEN"}
                          onChange={(e) => handleStatusChange(id, e.target.value)}
                          className="bg-[#161f33] border border-[#27354f] text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : id)}
                          className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#1e293b]"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Finding Details */}
                    {isExpanded && (
                      <tr className="bg-[#0b0e17] border-y border-[#1f293d]">
                        <td colSpan="7" className="p-4">
                          <div className="bg-[#111827] border border-[#27354f] p-3 rounded-lg space-y-2">
                            <div className="text-xs text-gray-400 font-medium">
                              Finding Description & Remediation:
                            </div>
                            <p className="text-sm text-gray-200">
                              {evt.description || "No specific finding description recorded."}
                            </p>
                            <div className="flex items-center gap-4 text-[11px] text-gray-500 pt-2 border-t border-[#1f293d]">
                              <span>Timestamp: {evt.timestamp || "Recent"}</span>
                              <span>Target: {evt.pipeline_id || "N/A"}</span>
                              <span>Engine: PipelineGuard Detection Rule</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
