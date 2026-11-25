import React from "react";

export function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  variant = "cyan",
  trend,
}) {
  const variantStyles = {
    cyan: "border-cyan-500/20 text-cyan-400 bg-cyan-500/10",
    indigo: "border-indigo-500/20 text-indigo-400 bg-indigo-500/10",
    rose: "border-rose-500/20 text-rose-400 bg-rose-500/10",
    amber: "border-amber-500/20 text-amber-400 bg-amber-500/10",
    emerald: "border-emerald-500/20 text-emerald-400 bg-emerald-500/10",
  }[variant] || "border-cyan-500/20 text-cyan-400 bg-cyan-500/10";

  return (
    <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-5 hover:border-[#374151] transition relative overflow-hidden group">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {title}
          </span>
          <div className="text-2xl font-bold text-white mt-1.5">{value}</div>
          {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg border ${variantStyles}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-3 pt-3 border-t border-[#1f293d] flex items-center gap-1.5 text-xs text-gray-400">
          <span className="text-emerald-400 font-semibold">{trend}</span>
          <span>vs previous 24h</span>
        </div>
      )}
    </div>
  );
}
