import React from "react";
import { Activity, Play, CheckCircle2, XCircle, Clock } from "lucide-react";

export function RunTable({ runs = [], loading = false, error = null }) {
  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
      case "SUCCESS":
        return "bg-emerald-950/80 text-emerald-400 border-emerald-800";
      case "FAILED":
        return "bg-rose-950/80 text-rose-400 border-rose-800";
      case "RUNNING":
        return "bg-cyan-950/80 text-cyan-400 border-cyan-800 animate-pulse";
      default:
        return "bg-gray-800 text-gray-300 border-gray-700";
    }
  };

  return (
    <div className="bg-[#111827] border border-[#1f293d] rounded-xl overflow-hidden shadow-lg">
      <div className="p-4 border-b border-[#1f293d] flex items-center justify-between bg-[#0e1320]/50">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Pipeline Runs History
          </h3>
          <p className="text-xs text-gray-400">
            Audit of pipeline workflow executions, trigger contexts, and calculated risk scores
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-[#161f33] border border-[#27354f] text-gray-300 font-mono">
          {runs.length} Runs Recorded
        </span>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border-b border-rose-900 text-rose-300 text-xs">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0e1320] text-gray-400 font-semibold uppercase tracking-wider border-b border-[#1f293d]">
            <tr>
              <th className="py-3 px-4">Run ID</th>
              <th className="py-3 px-4">Pipeline</th>
              <th className="py-3 px-4">Trigger</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Risk Index</th>
              <th className="py-3 px-4">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f293d] text-gray-300">
            {runs.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-8 text-center text-gray-500">
                  {loading ? "Loading pipeline runs..." : "No pipeline runs recorded yet."}
                </td>
              </tr>
            ) : (
              runs.map((r) => {
                const id = r.run_id || r.id;
                return (
                  <tr key={id} className="hover:bg-[#161f33]/50 transition">
                    <td className="py-3 px-4 font-mono font-medium text-white">{id}</td>
                    <td className="py-3 px-4 font-mono text-cyan-400">
                      {r.pipeline_id || "global"}
                    </td>
                    <td className="py-3 px-4 text-gray-400 capitalize">
                      {r.trigger_event || "push"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(
                          r.status
                        )}`}
                      >
                        {r.status || "COMPLETED"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-mono font-bold ${
                          Number(r.risk_score) >= 70
                            ? "text-rose-400"
                            : Number(r.risk_score) >= 40
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {r.risk_score ?? "20"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono">
                      {r.duration || "1m 45s"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
