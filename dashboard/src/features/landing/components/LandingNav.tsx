import React from "react";
import { NavLink } from "react-router-dom";
import { BrandWordmark, Button } from "../../../ui";
import { ThemeSwitch } from "../../shell/ThemeSwitch";

export function LandingNav({
  onOpenConnect,
}: {
  onOpenConnect: (opener?: HTMLElement | null) => void;
}) {
  return (
    <header className="sticky top-0 z-40 h-16 bg-[var(--pg-canvas)] border-b border-[var(--pg-line)]">
      <div className="max-w-[1200px] mx-auto px-3 sm:px-6 h-full flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-6 sm:gap-8 min-w-0">
          <a href="#top" className="no-underline shrink-0" aria-label="PipelineGuard home">
            <BrandWordmark />
          </a>

          <nav aria-label="Landing sections" className="hidden md:flex items-center gap-6">
            <a
              href="#rules"
              className="pg-label-md text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] no-underline transition-colors"
            >
              Rules
            </a>
            <a
              href="#playground"
              className="pg-label-md text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] no-underline transition-colors"
            >
              Playground
            </a>
            <a
              href="#how-it-works"
              className="pg-label-md text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] no-underline transition-colors"
            >
              Docs
            </a>
            <a
              href="https://github.com/jeevanL16/pipelineguard"
              target="_blank"
              rel="noreferrer"
              className="pg-label-md text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] no-underline transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div>
            <ThemeSwitch compact />
          </div>
          <NavLink to="/app" className="no-underline">
            <Button variant="secondary" size="compact">
              Dashboard
            </Button>
          </NavLink>
          <div className="hidden sm:inline-flex">
            <Button
              variant="primary"
              size="compact"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => onOpenConnect(e.currentTarget)}
            >
              Connect repository
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
