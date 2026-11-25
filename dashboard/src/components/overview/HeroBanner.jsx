import React from "react";
import { ShieldAlert, ShieldCheck, AlertTriangle, ArrowRight } from "lucide-react";

export function HeroBanner({ events = [], pipelines = [], onNavigate }) {
  const openEvents = events.filter((e) => e.status === "OPEN" || !e.status);
  const criticalCount = openEvents.filter((e) => e.severity === "CRITICAL").length;
  const highCount = openEvents.filter((e) => e.severity === "HIGH").length;

  const avgRisk =
    events.length > 0
      ? Math.round(
          events.reduce((sum, e) => sum + (Number(e.risk_score) || 0), 0) /
            events.length
        )
      : 24;

  const isSevere = criticalCount > 0 || avgRisk > 70;
  const isModerate = highCount > 0 || (avgRisk > 40 && avgRisk <= 70);

  const bannerColor = isSevere
    ? "from-rose-950/40 via-[#161224] to-[#0e1320] border-rose-900/50"
    : isModerate
    ? "from-amber-950/40 via-[#1a1720] to-[#0e1320] border-amber-900/50"
    : "from-emerald-950/30 via-[#0f1d24] to-[#0e1320] border-emerald-900/40";

  return (
    <div
      className={`rounded-2xl p-6 bg-gradient-to-r ${bannerColor} border relative overflow-hidden shadow-xl mb-6`}
    >
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isSevere
                  ? "bg-rose-500 animate-ping"
                  : isModerate
                  ? "bg-amber-500 animate-pulse"
                  : "bg-emerald-400 animate-pulse"
              }`}
            />
            <span className="text-gray-300 font-medium">
              {isSevere
                ? "Active Security Incidents Detected"
                : isModerate
                ? "Monitoring Active Pipeline Surface"
                : "All Monitored Workflows Resilient"}
            </span>
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight">
            Pipeline Security Operations Center
          </h2>
          <p className="text-gray-400 text-sm max-w-xl">
            Real-time enforcement across workflow injections, secret leak prevention,
            and software supply chain provenance verification.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/5">
          <div className="text-center px-3 border-r border-white/10">
            <span className="text-xs text-gray-400 uppercase font-semibold">Mean Risk</span>
            <div
              className={`text-2xl font-bold ${
                isSevere ? "text-rose-400" : isModerate ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {avgRisk}
              <span className="text-xs text-gray-500 font-normal">/100</span>
            </div>
          </div>

          <div className="text-center px-3">
            <span className="text-xs text-gray-400 uppercase font-semibold">Open Findings</span>
            <div className="text-2xl font-bold text-white">{openEvents.length}</div>
          </div>

          <button
            onClick={() => onNavigate("Threats")}
            className="ml-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition transform hover:-translate-y-0.5"
          >
            Review Threats
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
