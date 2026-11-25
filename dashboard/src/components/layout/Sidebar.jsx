import React from "react";
import {
  LayoutDashboard,
  ShieldAlert,
  Workflow,
  KeyRound,
  Package,
  GitBranch,
  Activity,
  AlertTriangle,
  FileClock,
  Settings,
  X,
  ShieldCheck,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "Overview", label: "Overview", icon: LayoutDashboard },
  { id: "Threats", label: "Threat Events", icon: ShieldAlert, badge: true },
  { id: "Workflow Security", label: "Workflow Guard", icon: Workflow },
  { id: "Secrets", label: "Secrets Scanner", icon: KeyRound },
  { id: "Artifacts", label: "Artifact Integrity", icon: Package },
  { id: "Pipelines", label: "Pipelines", icon: GitBranch },
  { id: "Runs", label: "Pipeline Runs", icon: Activity },
  { id: "Incidents", label: "Incident Desk", icon: AlertTriangle },
  { id: "Audit Log", label: "Audit Ledger", icon: FileClock },
  { id: "Settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  activePage,
  onNavigate,
  openCount = 0,
  isMobileOpen = false,
  onCloseMobile = () => {},
  backendStatus = "ok",
}) {
  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-[#0e1320] border-r border-[#1e293b] flex flex-col z-50 transition-transform duration-200 ease-in-out ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#1e293b]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-wide flex items-center gap-1.5">
                PipelineGuard
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  v2.0
                </span>
              </span>
              <p className="text-[11px] text-gray-400 font-medium">CI/CD Defense Engine</p>
            </div>
          </div>
          <button
            className="md:hidden text-gray-400 hover:text-white"
            onClick={onCloseMobile}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-3 pb-2">
            Security Control
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-cyan-500/15 to-indigo-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-[#161f33]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? "text-cyan-400" : "text-gray-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && openCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-950/80 text-rose-400 border border-rose-800/80">
                    {openCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer / System Status */}
        <div className="p-4 border-t border-[#1e293b] bg-[#0a0e17]">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === "ok"
                    ? "bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse"
                    : "bg-amber-400"
                }`}
              />
              Backend: {backendStatus === "ok" ? "Connected" : "Degraded"}
            </span>
            <span className="text-[10px] bg-[#1e293b] px-2 py-0.5 rounded text-gray-300">
              SQLite
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
