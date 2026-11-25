import {
  Activity,
  AlertTriangle,
  FileClock,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  Package,
  Settings,
  ShieldAlert,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavItemConfig {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  badgeKey?: "openFindings";
}

export interface NavGroupConfig {
  group: string;
  items: readonly NavItemConfig[];
}

/**
 * Canonical grouped sidebar navigation aligned with DESIGN.md Voice & Terminology table.
 */
export const DASHBOARD_NAV_GROUPS: readonly NavGroupConfig[] = [
  {
    group: "Monitor",
    items: [
      { id: "overview", label: "Overview", to: "/app", icon: LayoutDashboard },
      {
        id: "findings",
        label: "Findings",
        to: "/app/findings",
        icon: ShieldAlert,
        badgeKey: "openFindings",
      },
      { id: "incidents", label: "Incidents", to: "/app/incidents", icon: AlertTriangle },
    ],
  },
  {
    group: "Guard",
    items: [
      { id: "workflows", label: "Workflows", to: "/app/workflows", icon: Workflow },
      { id: "secrets", label: "Secrets", to: "/app/secrets", icon: KeyRound },
      { id: "artifacts", label: "Artifacts", to: "/app/artifacts", icon: Package },
    ],
  },
  {
    group: "Pipelines",
    items: [
      { id: "pipelines", label: "Pipelines", to: "/app/pipelines", icon: GitBranch },
      { id: "runs", label: "Runs", to: "/app/runs", icon: Activity },
    ],
  },
  {
    group: "Records",
    items: [{ id: "audit", label: "Audit log", to: "/app/audit", icon: FileClock }],
  },
] as const;

export const SETTINGS_NAV_ITEM: NavItemConfig = {
  id: "settings",
  label: "Settings",
  to: "/app/settings",
  icon: Settings,
};

export const ALL_DASHBOARD_PAGES: readonly NavItemConfig[] = [
  ...DASHBOARD_NAV_GROUPS.flatMap((g) => g.items),
  SETTINGS_NAV_ITEM,
];
