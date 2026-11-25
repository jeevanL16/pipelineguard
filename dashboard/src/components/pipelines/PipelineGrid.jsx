import React, { useState } from "react";
import { GitBranch, CheckCircle2, Plus, X, Globe, GitFork, Shield } from "lucide-react";

export function PipelineGrid({
  pipelines = [],
  loading = false,
  error = null,
  onAddPipeline = async () => {},
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pipelineId, setPipelineId] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pipelineId.trim() || !repoUrl.trim()) {
      setFormError("Pipeline ID and Repository URL are required");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      await onAddPipeline({
        pipeline_id: pipelineId.trim(),
        name: pipelineId.trim(),
        repository: repoUrl.trim(),
        branch: branch.trim() || "main",
        status: "ACTIVE",
      });
      setIsModalOpen(false);
      setPipelineId("");
      setRepoUrl("");
      setBranch("main");
    } catch (err) {
      setFormError(err.message || "Failed to register pipeline");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111827] border border-[#1f293d] p-4 rounded-xl shadow-sm">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-cyan-400" />
            Monitored CI/CD Pipelines
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#161f33] border border-[#27354f] text-gray-300 font-mono">
              {pipelines.length} Active
            </span>
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Repositories connected to the PipelineGuard AST and secrets scanning daemon
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs shadow-lg shadow-cyan-500/20 transition transform hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" />
          Connect New Repository
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-900 text-rose-300 text-xs rounded-lg">
          {error}
        </div>
      )}

      {pipelines.length === 0 ? (
        <div className="p-12 text-center bg-[#111827] border border-[#1f293d] rounded-xl space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#161f33] border border-[#27354f] flex items-center justify-center mx-auto text-gray-400">
            <GitBranch className="w-6 h-6 text-cyan-400" />
          </div>
          <h4 className="text-sm font-semibold text-white">No Connected Pipelines Yet</h4>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Connect a GitHub Actions repository or pipeline to start continuous workflow AST scanning and secret leak detection.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-[#161f33] hover:bg-[#1e293b] text-cyan-400 border border-cyan-500/30 text-xs font-medium transition"
          >
            + Connect First Repository
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelines.map((pipe) => {
            const id = pipe.pipeline_id || pipe.id;
            return (
              <div
                key={id}
                className="bg-[#111827] border border-[#1f293d] hover:border-cyan-500/40 transition rounded-xl p-5 flex flex-col justify-between group shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-sm font-bold text-white group-hover:text-cyan-400 transition truncate">
                      {pipe.pipeline_id || `pipe-${pipe.id}`}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 flex-shrink-0 ${
                        pipe.is_active !== false
                          ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                          : "bg-gray-800 text-gray-400 border border-gray-700"
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {pipe.is_active !== false ? "Protected" : "Paused"}
                    </span>
                  </div>

                  <div className="text-xs text-gray-400 font-mono truncate mb-4 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    <span className="truncate">{pipe.repository || pipe.repo_url || "Local Git Repository"}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1f293d] flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1.5 font-mono">
                    <GitFork className="w-3.5 h-3.5 text-cyan-500" />
                    {pipe.branch || "main"}
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium">SQLite Verified</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connect New Repository Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1320] border border-[#27354f] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#1e293b]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Connect New Pipeline</h3>
                  <p className="text-xs text-gray-400">Register repository for CI security</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Pipeline Identifier <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. payment-service-api"
                  value={pipelineId}
                  onChange={(e) => setPipelineId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#161f33] border border-[#27354f] text-white text-xs placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Repository URL <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. https://github.com/my-org/payment-service"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#161f33] border border-[#27354f] text-white text-xs placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Default Branch
                </label>
                <input
                  type="text"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#161f33] border border-[#27354f] text-white text-xs placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 border-t border-[#1e293b] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#161f33] hover:bg-[#1e293b] text-gray-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-medium transition disabled:opacity-50 shadow-md shadow-cyan-500/20"
                >
                  {submitting ? "Registering..." : "Connect Repository"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
