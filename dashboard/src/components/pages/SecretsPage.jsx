import React from "react";
import { KeyRound, ShieldAlert, CheckCircle2, Lock } from "lucide-react";

const DETECTOR_PATTERNS = [
  { name: "AWS Access Keys & Secrets", pattern: "AKIA[0-9A-Z]{16}", status: "Active" },
  { name: "GitHub Personal Access Tokens", pattern: "ghp_[0-9a-zA-Z]{36}", status: "Active" },
  { name: "Slack Bot / User Tokens", pattern: "xox[baprs]-[0-9]{10,}", status: "Active" },
  { name: "Generic High-Entropy API Secrets", pattern: "Shannon Entropy >= 4.5", status: "Active" },
  { name: "Private RSA / SSH Keys", pattern: "-----BEGIN (RSA )?PRIVATE KEY-----", status: "Active" },
];

export function SecretsPage({ events = [] }) {
  const secretEvents = events.filter(
    (e) =>
      e.source === "secrets" ||
      (e.event_type && e.event_type.toLowerCase().includes("secret"))
  );

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-cyan-950/40 to-[#0e1320] border border-cyan-900/40 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Pipeline Secret Leak Prevention</h2>
            <p className="text-xs text-gray-400">
              Scans commit diffs, environment blocks, and log streams for exposed credentials
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Lock className="w-4 h-4 text-cyan-400" />
          Active Secret Signatures & Entropy Filters
        </h3>
        <div className="space-y-2">
          {DETECTOR_PATTERNS.map((p, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-lg bg-[#161f33] border border-[#27354f] text-xs"
            >
              <div>
                <span className="font-semibold text-white mr-3">{p.name}</span>
                <span className="font-mono text-gray-400">{p.pattern}</span>
              </div>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {p.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
