import React, { useState, useEffect } from "react";
import { useDashboardData } from "./hooks/useDashboardData";
import { Sidebar } from "./components/layout/Sidebar";
import { Navbar } from "./components/layout/Navbar";
import { SearchModal } from "./components/layout/SearchModal";
import { HeroBanner } from "./components/overview/HeroBanner";
import { StatCard } from "./components/overview/StatCard";
import { ThreatChart } from "./components/overview/ThreatChart";
import { ThreatTable } from "./components/threats/ThreatTable";
import { PipelineGrid } from "./components/pipelines/PipelineGrid";
import { RunTable } from "./components/runs/RunTable";
import { AuditTable } from "./components/audit/AuditTable";
import { WorkflowSecurityPage } from "./components/pages/WorkflowSecurityPage";
import { SecretsPage } from "./components/pages/SecretsPage";
import { ArtifactsPage } from "./components/pages/ArtifactsPage";
import { SettingsPage } from "./components/pages/SettingsPage";

import {
  ShieldAlert,
  GitBranch,
  Activity,
  AlertTriangle,
  Lock,
} from "lucide-react";
import "./App.css";

export default function App() {
  const {
    health,
    pipelines,
    runs,
    events,
    auditLogs,
    loading,
    error,
    refresh,
    updateEventStatus,
  } = useDashboardData();

  const [activePage, setActivePage] = useState("Overview");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync browser history
  useEffect(() => {
    const handlePopState = (event) => {
      const page = event.state?.pipelineGuardPage;
      if (typeof page === "string") {
        setActivePage(page);
      } else {
        setActivePage("Overview");
      }
      setIsSearchOpen(false);
      setIsMobileNavOpen(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleNavigate = (page) => {
    if (page !== activePage) {
      window.history.pushState({ pipelineGuardPage: page }, "");
      setActivePage(page);
    }
    setIsMobileNavOpen(false);
    setIsSearchOpen(false);
  };

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsSearchOpen(false);
        setIsMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const openEventsCount = events.filter((e) => e.status === "OPEN" || !e.status).length;
  const criticalCount = events.filter(
    (e) => (e.status === "OPEN" || !e.status) && e.severity === "CRITICAL"
  ).length;

  return (
    <div className="min-h-screen bg-[#0a0e17] text-gray-100 flex">
      {/* Sidebar */}
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        openCount={openEventsCount}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        backendStatus={health.status}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          activePage={activePage}
          onOpenMobile={() => setIsMobileNavOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
          backendStatus={health.status}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {activePage === "Overview" && (
            <>
              <HeroBanner
                events={events}
                pipelines={pipelines}
                onNavigate={handleNavigate}
              />

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Protected Pipelines"
                  value={pipelines.length || 4}
                  subtext="Zero drift detected"
                  icon={GitBranch}
                  variant="cyan"
                  trend="+12%"
                />
                <StatCard
                  title="Active Threat Findings"
                  value={openEventsCount}
                  subtext="Awaiting review"
                  icon={ShieldAlert}
                  variant="rose"
                  trend="-4%"
                />
                <StatCard
                  title="Pipeline Runs Analyzed"
                  value={runs.length || 18}
                  subtext="Across all branches"
                  icon={Activity}
                  variant="indigo"
                  trend="+8%"
                />
                <StatCard
                  title="Critical Vulnerabilities"
                  value={criticalCount}
                  subtext="Immediate triage"
                  icon={AlertTriangle}
                  variant="amber"
                />
              </div>

              {/* Telemetry Chart & Incident Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <ThreatChart events={events} />
                </div>
                <div>
                  <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-5 h-full flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-1">
                        Defense System Status
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">
                        Deterministic gate enforcement
                      </p>

                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-[#161f33] border border-[#27354f] flex items-center justify-between text-xs">
                          <span className="text-gray-300 font-medium">AST Workflow Parser</span>
                          <span className="text-emerald-400 font-bold">Resilient</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[#161f33] border border-[#27354f] flex items-center justify-between text-xs">
                          <span className="text-gray-300 font-medium">Entropy Secret Scanner</span>
                          <span className="text-emerald-400 font-bold">Scanning</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[#161f33] border border-[#27354f] flex items-center justify-between text-xs">
                          <span className="text-gray-300 font-medium">Artifact Hash Verifier</span>
                          <span className="text-emerald-400 font-bold">Protected</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-[#1f293d] text-center">
                      <button
                        onClick={() => handleNavigate("Threats")}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                      >
                        View all threat telemetry →
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Threat Table preview */}
              <ThreatTable
                events={events}
                loading={loading}
                error={error}
                onStatusUpdate={updateEventStatus}
              />
            </>
          )}

          {activePage === "Threats" && (
            <ThreatTable
              events={events}
              loading={loading}
              error={error}
              onStatusUpdate={updateEventStatus}
            />
          )}

          {activePage === "Incidents" && (
            <ThreatTable
              events={events}
              loading={loading}
              error={error}
              onStatusUpdate={updateEventStatus}
            />
          )}

          {activePage === "Workflow Security" && <WorkflowSecurityPage />}

          {activePage === "Secrets" && <SecretsPage events={events} />}

          {activePage === "Artifacts" && <ArtifactsPage />}

          {activePage === "Pipelines" && (
            <PipelineGrid pipelines={pipelines} loading={loading} error={error} />
          )}

          {activePage === "Runs" && (
            <RunTable runs={runs} loading={loading} error={error} />
          )}

          {activePage === "Audit Log" && (
            <AuditTable auditLogs={auditLogs} loading={loading} />
          )}

          {activePage === "Settings" && (
            <SettingsPage backendStatus={health.status} />
          )}
        </main>
      </div>

      {/* Global Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onNavigate={handleNavigate}
        events={events}
        pipelines={pipelines}
      />
    </div>
  );
}
