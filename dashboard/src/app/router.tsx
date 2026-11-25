import React, { Suspense, lazy, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { ThemeProvider } from "./theme";
import { MotionProvider } from "../motion/MotionProvider";
import { ToastProvider, TooltipProvider, Panel, Skeleton } from "../ui";

const LandingPage = lazy(() =>
  import("../features/landing/LandingPage").then((m) => ({ default: m.LandingPage }))
);
const DashboardShell = lazy(() =>
  import("../features/shell/DashboardShell").then((m) => ({ default: m.DashboardShell }))
);
const OverviewPage = lazy(() =>
  import("../features/overview/OverviewPage").then((m) => ({ default: m.OverviewPage }))
);
const FindingsPage = lazy(() =>
  import("../features/findings/FindingsPage").then((m) => ({ default: m.FindingsPage }))
);
const IncidentsPage = lazy(() =>
  import("../features/incidents/IncidentsPage").then((m) => ({ default: m.IncidentsPage }))
);
const WorkflowsPage = lazy(() =>
  import("../features/workflows/WorkflowsPage").then((m) => ({ default: m.WorkflowsPage }))
);
const SecretsPage = lazy(() =>
  import("../features/secrets/SecretsPage").then((m) => ({ default: m.SecretsPage }))
);
const ArtifactsPage = lazy(() =>
  import("../features/artifacts/ArtifactsPage").then((m) => ({ default: m.ArtifactsPage }))
);
const PipelinesPage = lazy(() =>
  import("../features/pipelines/PipelinesPage").then((m) => ({ default: m.PipelinesPage }))
);
const RunsPage = lazy(() =>
  import("../features/runs/RunsPage").then((m) => ({ default: m.RunsPage }))
);
const AuditLogPage = lazy(() =>
  import("../features/audit/AuditLogPage").then((m) => ({ default: m.AuditLogPage }))
);
const SettingsPage = lazy(() =>
  import("../features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);
const ConnectRepositoryDialog = lazy(() =>
  import("../features/pipelines/components/ConnectRepositoryDialog").then((m) => ({
    default: m.ConnectRepositoryDialog,
  }))
);

function RouteSkeleton() {
  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-4">
      <Skeleton width="220px" height="28px" />
      <Panel className="space-y-3">
        <Skeleton width="100%" height="20px" />
        <Skeleton width="80%" height="20px" />
        <Skeleton width="60%" height="20px" />
      </Panel>
    </div>
  );
}

function DashboardRoutesWrapper() {
  const navigate = useNavigate();
  const [connectOpen, setConnectOpen] = useState(false);
  const [openerEl, setOpenerEl] = useState<HTMLElement | null>(null);

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardShell
        onOpenConnect={(el) => {
          setOpenerEl(el ?? null);
          setConnectOpen(true);
        }}
      />
      <Suspense fallback={null}>
        {connectOpen && (
          <ConnectRepositoryDialog
            open={connectOpen}
            onOpenChange={setConnectOpen}
            openerEl={openerEl}
            onConnected={() => {
              queryClient.invalidateQueries({ queryKey: ["pipelines"] });
              navigate("/app/pipelines");
            }}
          />
        )}
      </Suspense>
    </QueryClientProvider>
  );
}

export function AppRouter() {
  return (
    <ThemeProvider>
      <MotionProvider>
        <TooltipProvider>
          <ToastProvider>
            <BrowserRouter>
              <Suspense fallback={<RouteSkeleton />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />

                  <Route path="/app" element={<DashboardRoutesWrapper />}>
                    <Route index element={<OverviewPage />} />
                    <Route path="findings" element={<FindingsPage />} />
                    <Route path="incidents" element={<IncidentsPage />} />
                    <Route path="workflows" element={<WorkflowsPage />} />
                    <Route path="secrets" element={<SecretsPage />} />
                    <Route path="artifacts" element={<ArtifactsPage />} />
                    <Route path="pipelines" element={<PipelinesPage />} />
                    <Route path="runs" element={<RunsPage />} />
                    <Route path="audit" element={<AuditLogPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ToastProvider>
        </TooltipProvider>
      </MotionProvider>
    </ThemeProvider>
  );
}
