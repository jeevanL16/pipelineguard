import React from "react";
import { FileClock, User, ArrowRight } from "lucide-react";

export function AuditTable({ auditLogs = [], loading = false }) {
  return (
    <div className="bg-[#111827] border border-[#1f293d] rounded-xl overflow-hidden shadow-lg">
      <div className="p-4 border-b border-[#1f293d] flex items-center justify-between bg-[#0e1320]/50">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileClock className="w-5 h-5 text-cyan-400" />
            Audit Ledger Trail
          </h3>
          <p className="text-xs text-gray-400">
            Immutable log of threat status overrides, incident resolutions, and actors
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-[#161f33] border border-[#27354f] text-gray-300 font-mono">
          {auditLogs.length} Records
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0e1320] text-gray-400 font-semibold uppercase tracking-wider border-b border-[#1f293d]">
            <tr>
              <th className="py-3 px-4">Log ID</th>
              <th className="py-3 px-4">Event ID</th>
              <th className="py-3 px-4">Transition</th>
              <th className="py-3 px-4">Actor</th>
              <th className="py-3 px-4">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f293d] text-gray-300">
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-gray-500">
                  {loading ? "Loading audit records..." : "No status transitions logged yet."}
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#161f33]/50 transition">
                  <td className="py-3 px-4 font-mono font-medium text-gray-400">#{log.id}</td>
                  <td className="py-3 px-4 font-mono text-cyan-400 font-semibold">
                    {log.event_id}
                  </td>
                  <td className="py-3 px-4">
                    <div className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                        {log.previous_status || "OPEN"}
                      </span>
                      <ArrowRight className="w-3 h-3 text-gray-500" />
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                        {log.new_status}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 flex items-center gap-1.5 text-gray-300 font-medium">
                    <User className="w-3.5 h-3.5 text-gray-500" />
                    {log.actor || "admin"}
                  </td>
                  <td className="py-3 px-4 text-gray-500 font-mono">
                    {log.changed_at ? new Date(log.changed_at).toLocaleString() : "Just now"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
