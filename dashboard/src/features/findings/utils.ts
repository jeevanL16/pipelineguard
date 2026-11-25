import { lookupRule } from "../../rules/registry";
import type { Rule } from "../../rules/schemas";
import type { ApiSecurityEvent } from "../../services/api";

const EVENT_TYPE_RULE_MAP: Record<string, string> = {
  COMMAND_INJECTION: "PG-WF-001",
  SCRIPT_INJECTION: "PG-WF-001",
  GITHUB_SCRIPT_INJECTION: "PG-WF-002",
  GITHUB_ENV_INJECTION: "PG-WF-003",
  MISSING_PERMISSIONS: "PG-WF-004",
  EXCESSIVE_PERMISSIONS: "PG-WF-005",
  PWN_REQUEST: "PG-WF-006",
  SECRETS_INHERIT: "PG-WF-007",
  CURL_PIPE_SHELL: "PG-WF-008",
  SUPPLY_CHAIN_UNPINNED: "PG-WF-019",
  CHECKOUT_PERSIST_CREDS: "PG-WF-020",
  SECRET_ECHO: "PG-WF-021",
};

export function inferRuleForEvent(evt: ApiSecurityEvent): Rule | null {
  const direct = /PG-WF-\d{3}/i.exec(`${evt.event_type} ${evt.description}`);
  if (direct) {
    return lookupRule(direct[0].toUpperCase());
  }
  const mappedId = EVENT_TYPE_RULE_MAP[(evt.event_type || "").toUpperCase()];
  if (mappedId) {
    return lookupRule(mappedId);
  }
  return null;
}

export function buildEvidenceYamlForEvent(evt: ApiSecurityEvent, rule: Rule | null): {
  code: string;
  flaggedLine: number;
  fixDiffRemoved: string;
  fixDiffAdded: string;
} {
  if (rule?.example) {
    const lines = rule.example.split("\n");
    const code = [
      `# Source: ${evt.source} | Pipeline: ${evt.pipeline_id || "global"}`,
      ...lines,
    ].join("\n");
    return {
      code,
      flaggedLine: 2,
      fixDiffRemoved: `- ${lines[0]}`,
      fixDiffAdded: `+ ${rule.fixSummary}`,
    };
  }

  return {
    code: [
      `# Event ${evt.event_id} (${evt.source})`,
      `# Type: ${evt.event_type}`,
      evt.description,
    ].join("\n"),
    flaggedLine: 3,
    fixDiffRemoved: `- ${evt.event_type} detected in ${evt.pipeline_id || "workflow"}`,
    fixDiffAdded: `+ Remediate source finding and re-run inspection`,
  };
}

export function formatShortAge(iso?: string | null): string {
  if (!iso) return "0m";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "0m";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function formatIsoDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatIsoDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
