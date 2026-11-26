import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { BrandWordmark, Button, Panel, useToast } from "../../ui";
import { prefersReducedMotion } from "../../motion/motion";
import { ConnectRepositoryForm } from "../pipelines/components/ConnectRepositoryForm";
import { ConnectRepositoryDialog } from "../pipelines/components/ConnectRepositoryDialog";
import { LandingNav } from "./components/LandingNav";
import { HeroScanDemo } from "./components/HeroScanDemo";
import { HeroGateSlot } from "./components/HeroGateSlot";
import { IncidentTabsSection } from "./components/IncidentTabsSection";
import { PlaygroundSection } from "./components/PlaygroundSection";
import { HowItWorksSection } from "./components/HowItWorksSection";
import { ArchitectureSection } from "./components/ArchitectureSection";
import { RulesCatalogSection } from "./components/RulesCatalogSection";
import { DashboardPreviewSection } from "./components/DashboardPreviewSection";
import { FaqSection } from "./components/FaqSection";

export function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pushToast } = useToast();
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectOpener, setConnectOpener] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const el = document.getElementById(id);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "start",
        });
      });
    }
  }, [location.hash]);

  const openDialog = (opener?: HTMLElement | null) => {
    setConnectOpener(opener ?? null);
    setConnectOpen(true);
  };

  return (
    <div id="top" className="min-h-screen bg-[var(--pg-canvas)] text-[var(--pg-text)]">
      <LandingNav onOpenConnect={openDialog} />

      <main className="space-y-16 sm:space-y-24 pb-20">
        {/* Hero */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-12 sm:pt-16 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 max-w-[740px] space-y-5">
              <h1 className="pg-display-xl text-[var(--pg-text)] m-0">
                Catch risky workflow changes before they run.
              </h1>
              <p className="pg-body-lg text-[var(--pg-text-muted)] max-w-[40rem] m-0">
                PipelineGuard reads your GitHub Actions workflows, flags unpinned actions, exposed secrets and unverified artifacts, and records every decision in an audit log.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  variant="primary"
                  onClick={(e) => openDialog(e.currentTarget)}
                >
                  Connect repository
                </Button>
                <a href="#playground" className="no-underline">
                  <Button variant="secondary">Scan a workflow here</Button>
                </a>
              </div>
            </div>

            <HeroGateSlot />
          </div>

          <HeroScanDemo />

          <p className="pg-body-sm text-[var(--pg-text-muted)] max-w-[40rem] m-0 pt-3 border-t border-[var(--pg-line)]">
            Twenty-three workflow rules, secret-signature patterns and SHA-256 artifact verification run on every push.
          </p>
        </section>

        <div className="border-t border-[var(--pg-line)]/60 pt-16 sm:pt-20">
          <IncidentTabsSection />
        </div>

        <div className="border-t border-[var(--pg-line)]/60 pt-16 sm:pt-20">
          <PlaygroundSection />
        </div>

        <div className="border-t border-[var(--pg-line)]/60 pt-16 sm:pt-20">
          <HowItWorksSection />
        </div>

        <div className="border-t border-[var(--pg-line)]/60 pt-16 sm:pt-20">
          <ArchitectureSection />
        </div>

        <div className="border-t border-[var(--pg-line)]/60 pt-16 sm:pt-20">
          <RulesCatalogSection />
        </div>

        <div className="border-t border-[var(--pg-line)]/60 pt-16 sm:pt-20">
          <DashboardPreviewSection />
        </div>

        <div className="border-t border-[var(--pg-line)]/60 pt-16 sm:pt-20">
          <FaqSection />
        </div>

        {/* Final Call to Action (centered panel per DESIGN.md layout) */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-8">
          <div className="max-w-[540px] mx-auto space-y-4">
            <div className="text-center space-y-2">
              <h2 className="pg-headline-lg text-[var(--pg-text)] m-0">
                Connect a repository
              </h2>
              <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">
                Inspect workflow triggers before committing changes or open the full operational console.
              </p>
            </div>

            <Panel>
              <ConnectRepositoryForm
                compactIntro
                onSuccess={(createdId) => {
                  pushToast({
                    message: `Repository connected (${createdId}). First scan queued.`,
                    tone: "pass",
                  });
                  navigate("/app/pipelines");
                }}
              />
            </Panel>

            <div className="text-center">
              <NavLink
                to="/app"
                className="pg-body-sm text-[var(--pg-text-muted)] hover:text-[var(--pg-primary)] underline"
              >
                Open dashboard without connecting a repository
              </NavLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--pg-line)] bg-[var(--pg-panel)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <BrandWordmark />
            <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">
              Workflow inspection (PG-WF-001–023), secret leak policies, and SHA-256 verification.
            </p>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-5 pg-body-sm">
            <a href="#rules" className="text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] no-underline">
              Rules
            </a>
            <a href="#playground" className="text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] no-underline">
              Playground
            </a>
            <NavLink to="/app" className="text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] no-underline">
              Dashboard
            </NavLink>
            <a
              href="https://github.com/jeevanL16/pipelineguard"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] no-underline"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>

      <ConnectRepositoryDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        openerEl={connectOpener}
        onConnected={() => navigate("/app/pipelines")}
      />
    </div>
  );
}
