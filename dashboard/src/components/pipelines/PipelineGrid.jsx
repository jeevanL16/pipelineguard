import React from "react";
import { GitBranch, CheckCircle2, AlertTriangle, ArrowUpRight } from "lucide-react";

export function PipelineGrid({ pipelines = [], loading = false, error = null }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-cyan-400" />
            Monitored CI/CD Pipelines
          </h3>
          <p className="text-xs text-gray-400">
            Pipelines registered for workflow AST scanning and artifact verification
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-[#161f33] border border-[#27354f] text-gray-300 font-mono">
          {pipelines.length} Active
        </span>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-900 text-rose-300 text-xs rounded-lg">
          {error}
        </div>
      )}

      {pipelines.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-[#111827] border border-[#1f293d] rounded-xl">
          {loading ? "Loading pipelines..." : "No pipelines registered yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelines.map((pipe) => {
            const id = pipe.pipeline_id || pipe.id;
            return (
              <div
                key={id}
                className="bg-[#111827] border border-[#1f293d] hover:border-cyan-500/40 transition rounded-xl p-4 flex flex-col justify-between group shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-bold text-white group-hover:text-cyan-400 transition">
                      {pipe.pipeline_id || `pipe-${pipe.id}`}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                        pipe.is_active !== false
                          ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                          : "bg-gray-800 text-gray-400 border border-gray-700"
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {pipe.is_active !== false ? "Protected" : "Paused"}
                    </span>
                  </div>

                  <div className="text-xs text-gray-400 font-mono truncate mb-3">
                    {pipe.repo_url || "Local Git Repository"}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1f293d] flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1.5 font-mono">
                    <GitBranch className="w-3.5 h-3.5 text-gray-500" />
                    {pipe.branch || "main"}
                  </span>
                  <span className="text-[11px] text-gray-500">CI/CD Guard</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
