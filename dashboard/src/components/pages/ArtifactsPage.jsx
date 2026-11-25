import React from "react";
import { Package, ShieldCheck, CheckCircle2, FileCheck } from "lucide-react";

export function ArtifactsPage() {
  const verifiedArtifacts = [
    {
      name: "dist/pipelineguard-engine.whl",
      hash: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      status: "VERIFIED",
      pipeline: "pipe-core-build",
    },
    {
      name: "dashboard/dist/assets/index.js",
      hash: "sha256:88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936ffc8150",
      status: "VERIFIED",
      pipeline: "pipe-dashboard-ui",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-950/40 to-[#0e1320] border border-emerald-900/40 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Artifact Provenance & Integrity</h2>
            <p className="text-xs text-gray-400">
              Validates cryptographic digests, build attestation, and SLSA provenance
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-emerald-400" />
          Attested Build Artifacts
        </h3>
        <div className="space-y-2">
          {verifiedArtifacts.map((art, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-lg bg-[#161f33] border border-[#27354f] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="font-semibold text-white mb-1">{art.name}</div>
                <div className="font-mono text-gray-400 text-[11px] truncate max-w-lg">
                  {art.hash}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-cyan-400">{art.pipeline}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {art.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
