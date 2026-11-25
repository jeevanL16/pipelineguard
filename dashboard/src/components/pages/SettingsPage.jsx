import React, { useState } from "react";
import { Settings, Server, Database, Shield, CheckCircle2, Lock } from "lucide-react";
import { getBackendHealth, testBackendConnection } from "../../services/api";

export function SettingsPage({ backendStatus = "ok" }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await getBackendHealth();
      setTestResult({ success: true, message: `Connected: status=${res.status}` });
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">System Configuration</h2>
            <p className="text-xs text-gray-400">
              Backend runtime environment, API endpoints, and authentication mode
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-[#161f33] border border-[#27354f] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-indigo-400" />
              <div>
                <div className="text-sm font-semibold text-white">FastAPI Backend Endpoint</div>
                <div className="text-xs font-mono text-gray-400">http://127.0.0.1:8000</div>
              </div>
            </div>
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/40 text-xs font-medium transition disabled:opacity-50"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg text-xs font-mono border ${
                testResult.success
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  : "bg-rose-950/60 border-rose-800 text-rose-300"
              }`}
            >
              {testResult.message}
            </div>
          )}

          <div className="p-4 rounded-lg bg-[#161f33] border border-[#27354f] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-sm font-semibold text-white">Database Engine</div>
                <div className="text-xs text-gray-400">SQLite (pipelineguard.db) with thread-safety</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
              Active
            </span>
          </div>

          <div className="p-4 rounded-lg bg-[#161f33] border border-[#27354f] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-sm font-semibold text-white">Authentication Protocol</div>
                <div className="text-xs text-gray-400">
                  JWT Bearer Token + Localhost Loopback Read Bypass
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-400 border border-indigo-800">
              admin / admin123
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
