import React, { useEffect, useRef } from "react";
import { Search, X, ShieldAlert, GitBranch, Activity, FileText } from "lucide-react";

export function SearchModal({
  isOpen,
  onClose,
  searchQuery,
  setSearchQuery,
  onNavigate,
  events = [],
  pipelines = [],
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const q = searchQuery.toLowerCase().trim();

  const matchedEvents = q
    ? events.filter(
        (e) =>
          (e.description && e.description.toLowerCase().includes(q)) ||
          (e.event_type && e.event_type.toLowerCase().includes(q)) ||
          (e.event_id && e.event_id.toLowerCase().includes(q))
      ).slice(0, 5)
    : [];

  const matchedPipelines = q
    ? pipelines.filter(
        (p) =>
          (p.pipeline_id && p.pipeline_id.toLowerCase().includes(q)) ||
          (p.repo_url && p.repo_url.toLowerCase().includes(q)) ||
          (p.branch && p.branch.toLowerCase().includes(q))
      ).slice(0, 4)
    : [];

  const quickPages = [
    { title: "Overview Dashboard", id: "Overview" },
    { title: "Threat Events Registry", id: "Threats" },
    { title: "Workflow Security Rules", id: "Workflow Security" },
    { title: "Secrets Detection", id: "Secrets" },
    { title: "Artifact Integrity & Hashes", id: "Artifacts" },
    { title: "Pipelines Manager", id: "Pipelines" },
    { title: "Pipeline Runs History", id: "Runs" },
    { title: "Audit Trail Ledger", id: "Audit Log" },
  ].filter((p) => !q || p.title.toLowerCase().includes(q));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4">
      <div className="bg-[#0e1320] border border-[#27354f] rounded-xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#1e293b] gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search threats, rules, pipelines, or pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none"
          />
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Area */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-3">
          {matchedEvents.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Threats ({matchedEvents.length})
              </div>
              <div className="space-y-1">
                {matchedEvents.map((evt) => (
                  <button
                    key={evt.id || evt.event_id}
                    onClick={() => {
                      onNavigate("Threats");
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-[#161f33] hover:bg-[#1e293b] text-xs flex items-center justify-between transition"
                  >
                    <div>
                      <span className="font-semibold text-white mr-2">{evt.event_type}</span>
                      <span className="text-gray-400 truncate">{evt.description}</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-rose-400 bg-rose-950 px-1.5 py-0.5 rounded">
                      {evt.severity}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedPipelines.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-cyan-400" /> Pipelines ({matchedPipelines.length})
              </div>
              <div className="space-y-1">
                {matchedPipelines.map((p) => (
                  <button
                    key={p.id || p.pipeline_id}
                    onClick={() => {
                      onNavigate("Pipelines");
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-[#161f33] hover:bg-[#1e293b] text-xs flex items-center justify-between transition"
                  >
                    <span className="font-medium text-white">{p.pipeline_id}</span>
                    <span className="text-gray-400 font-mono text-[11px]">{p.branch}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {quickPages.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1.5">
                Navigation
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {quickPages.slice(0, 6).map((page) => (
                  <button
                    key={page.id}
                    onClick={() => {
                      onNavigate(page.id);
                      onClose();
                    }}
                    className="text-left px-3 py-2 rounded-lg bg-[#161f33]/60 hover:bg-[#1e293b] text-xs text-gray-300 hover:text-white transition"
                  >
                    {page.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-2.5 border-t border-[#1e293b] bg-[#0a0e17] text-[11px] text-gray-500 flex justify-between px-4">
          <span>Navigate with mouse or Esc to close</span>
          <span className="font-mono">ESC</span>
        </div>
      </div>
    </div>
  );
}
