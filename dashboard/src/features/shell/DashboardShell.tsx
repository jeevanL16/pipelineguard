import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { BrandWordmark, Tooltip } from "../../ui";
import {
  ALL_DASHBOARD_PAGES,
  DASHBOARD_NAV_GROUPS,
  SETTINGS_NAV_ITEM,
} from "./navConfig";
import { TopBar } from "./TopBar";
import { CommandPalette } from "./CommandPalette";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBackendHealth,
  getPipelines,
  getSecurityEvents,
} from "../../services/api";
import { syncCriticalFavicon } from "../../app/theme";
import { runViewTransition } from "../../motion/motion";

const COLLAPSED_KEY = "pg-sidebar-collapsed";

export interface DashboardOutletContext {
  openConnectDialog: (openerEl?: HTMLElement | null) => void;
}

export function DashboardShell({
  onOpenConnect,
}: {
  onOpenConnect: (openerEl?: HTMLElement | null) => void;
}) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const cmdTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Health polling every 15s, paused when tab hidden, 2 failures -> Degraded
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      try {
        const res = await getBackendHealth();
        setConsecutiveFailures(0);
        setLastUpdatedAt(Date.now());
        return res;
      } catch (err) {
        setConsecutiveFailures((n) => n + 1);
        throw err;
      }
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    retry: 0,
  });

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const data = await getSecurityEvents();
      setLastUpdatedAt(Date.now());
      return data;
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines"],
    queryFn: getPipelines,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const events = eventsQuery.data ?? [];
  const pipelines = pipelinesQuery.data ?? [];

  const openEventsCount = events.filter(
    (e) => e.status === "OPEN" || e.status === "INVESTIGATING"
  ).length;

  const hasOpenCritical = events.some(
    (e) =>
      (e.status === "OPEN" || e.status === "INVESTIGATING") &&
      e.severity?.toUpperCase() === "CRITICAL"
  );

  useEffect(() => {
    syncCriticalFavicon(hasOpenCritical);
    return () => syncCriticalFavicon(false);
  }, [hasOpenCritical]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const activeConfig =
    ALL_DASHBOARD_PAGES.find((item) =>
      item.to === "/app"
        ? location.pathname === "/app" || location.pathname === "/app/"
        : location.pathname.startsWith(item.to)
    ) ?? ALL_DASHBOARD_PAGES[0];

  const handleManualRefresh = () => {
    queryClient.invalidateQueries();
  };

  const isFetching =
    healthQuery.isFetching || eventsQuery.isFetching || pipelinesQuery.isFetching;
  const isDegraded = consecutiveFailures >= 2;

  const renderNavContent = (isCompactRail: boolean, onItemClick?: () => void) => (
    <div className="flex flex-col h-full justify-between">
      <div>
        <div
          className={`h-14 flex items-center border-b border-[var(--pg-line)] ${
            isCompactRail ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          <NavLink
            to="/"
            onClick={() => onItemClick?.()}
            aria-label="PipelineGuard landing page"
            className="no-underline rounded-[8px] p-1"
          >
            <BrandWordmark compact={isCompactRail} />
          </NavLink>

          {!isCompactRail && (
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label="Collapse sidebar"
              className="hidden sm:inline-flex p-1.5 rounded-[8px] text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] hover:bg-[var(--pg-raised)] cursor-pointer"
            >
              <PanelLeftClose size={16} strokeWidth={1.5} />
            </button>
          )}
        </div>

        <nav aria-label="Dashboard sections" className="p-2 space-y-4">
          {DASHBOARD_NAV_GROUPS.map((group) => (
            <div key={group.group} className="space-y-1">
              {!isCompactRail && (
                <div className="px-2.5 pt-1 pb-0.5 pg-label-sm text-[var(--pg-text-muted)]">
                  {group.group}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const badgeCount =
                  item.badgeKey === "openFindings" ? openEventsCount : 0;

                const linkEl = (
                  <NavLink
                    key={item.id}
                    to={item.to}
                    end={item.to === "/app"}
                    aria-label={isCompactRail ? item.label : undefined}
                    onClick={() => onItemClick?.()}
                    className={({ isActive }) =>
                      `flex items-center ${
                        isCompactRail ? "justify-center px-0" : "justify-between px-2.5"
                      } h-9 rounded-[8px] pg-label-md no-underline transition-colors duration-120 ${
                        isActive
                          ? "bg-[var(--pg-raised)] text-[var(--pg-text)]"
                          : "text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] hover:bg-[var(--pg-raised)]/50"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            size={16}
                            strokeWidth={1.5}
                            className={
                              isActive
                                ? "text-[var(--pg-primary)] shrink-0"
                                : "text-current shrink-0"
                            }
                          />
                          {!isCompactRail && <span className="truncate">{item.label}</span>}
                        </span>

                        {!isCompactRail && badgeCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-[4px] bg-[var(--pg-panel)] border border-[var(--pg-line)] text-[var(--pg-text)] pg-label-sm pg-tnum">
                            {badgeCount}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );

                return isCompactRail ? (
                  <Tooltip key={item.id} content={item.label}>
                    {linkEl}
                  </Tooltip>
                ) : (
                  linkEl
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <div className="p-2 border-t border-[var(--pg-line)] space-y-1">
        {isCompactRail && (
          <Tooltip content="Expand sidebar">
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label="Expand sidebar"
              className="hidden sm:flex w-full h-9 items-center justify-center rounded-[8px] text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] hover:bg-[var(--pg-raised)] cursor-pointer"
            >
              <PanelLeftOpen size={16} strokeWidth={1.5} />
            </button>
          </Tooltip>
        )}

        <NavLink
          to={SETTINGS_NAV_ITEM.to}
          aria-label={isCompactRail ? SETTINGS_NAV_ITEM.label : undefined}
          onClick={() => onItemClick?.()}
          className={({ isActive }) =>
            `flex items-center ${
              isCompactRail ? "justify-center px-0" : "gap-2.5 px-2.5"
            } h-9 rounded-[8px] pg-label-md no-underline transition-colors duration-120 ${
              isActive
                ? "bg-[var(--pg-raised)] text-[var(--pg-text)]"
                : "text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] hover:bg-[var(--pg-raised)]/50"
            }`
          }
        >
          <SETTINGS_NAV_ITEM.icon size={16} strokeWidth={1.5} />
          {!isCompactRail && <span>{SETTINGS_NAV_ITEM.label}</span>}
        </NavLink>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[var(--pg-canvas)] text-[var(--pg-text)]">
      {/* Desktop & tablet sidebar (56px collapsed / 232px expanded) */}
      <aside
        className="hidden sm:block shrink-0 sticky top-0 h-screen border-r border-[var(--pg-line)] bg-[var(--pg-panel)] transition-[width] duration-200 ease-out"
        style={{
          width: collapsed ? "var(--pg-sidebar-collapsed-w)" : "var(--pg-sidebar-w)",
        }}
      >
        {renderNavContent(collapsed)}
      </aside>

      {/* Mobile drawer navigation (< 640px) via accessible Radix Dialog */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 z-50 sm:hidden"
            style={{ backgroundColor: "var(--pg-scrim)" }}
          />
          <DialogPrimitive.Content
            className="fixed top-0 left-0 bottom-0 z-50 w-[232px] bg-[var(--pg-panel)] border-r border-[var(--pg-line)] sm:hidden outline-none"
            style={{ boxShadow: "var(--pg-overlay-shadow)" }}
          >
            <DialogPrimitive.Title className="sr-only">Navigation menu</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Dashboard sections
            </DialogPrimitive.Description>
            <div className="relative h-full">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="absolute top-3 right-3 p-1.5 rounded-[8px] text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] z-10 cursor-pointer"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
              {renderNavContent(false, () => setMobileOpen(false))}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          pageTitle={activeConfig.label}
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenCommandPalette={() => setPaletteOpen(true)}
          commandButtonRef={cmdTriggerRef}
          onRefresh={handleManualRefresh}
          isFetching={isFetching}
          isDegraded={isDegraded}
          lastUpdatedAt={lastUpdatedAt}
        />

        <main className="flex-1 w-full p-4 sm:p-6 space-y-6">
          <Outlet context={{ openConnectDialog: onOpenConnect } satisfies DashboardOutletContext} />
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        events={events}
        pipelines={pipelines}
        onOpenConnect={() => onOpenConnect(cmdTriggerRef.current)}
        onRefreshAll={handleManualRefresh}
      />
    </div>
  );
}
