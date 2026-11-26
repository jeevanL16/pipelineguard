import { lookupRule } from "../../../rules/registry";
import type { Severity } from "../../../rules/schemas";

export interface IncidentPathNode {
  id: string;
  label: string;
  isGatePoint?: boolean;
  isTerminal?: boolean;
}

export interface IncidentPathSpec {
  id: "unpinned-action" | "exposed-secret" | "tampered-artifact";
  tabLabel: string;
  ruleId: string;
  severity: Severity;
  cwe: string;
  gateActionLabel: string;
  compromisedOutcome: string;
  nodes: readonly IncidentPathNode[];
}

const rule019 = lookupRule("PG-WF-019");
const rule021 = lookupRule("PG-WF-021");

export const INCIDENT_PATHS: readonly IncidentPathSpec[] = [
  {
    id: "unpinned-action",
    tabLabel: "Mutable action tag",
    ruleId: rule019.id,
    severity: rule019.severity,
    cwe: rule019.cwe,
    gateActionLabel: `${rule019.id} blocked`,
    compromisedOutcome: "Retargeted tag executes attacker step inside runner",
    nodes: [
      { id: "tag-ref", label: "Workflow uses @v3 tag" },
      { id: "tag-gate", label: "Commit SHA check", isGatePoint: true },
      { id: "tag-move", label: "Upstream tag retargeted" },
      { id: "tag-exec", label: "Untrusted code runs", isTerminal: true },
    ],
  },
  {
    id: "exposed-secret",
    tabLabel: "Secret written to logs",
    ruleId: rule021.id,
    severity: rule021.severity,
    cwe: rule021.cwe,
    gateActionLabel: `${rule021.id} masked`,
    compromisedOutcome: "Unmasked token leaks into build logs and artifacts",
    nodes: [
      { id: "sec-ref", label: "Shell command prints secret" },
      { id: "sec-gate", label: "Secret pattern scan", isGatePoint: true },
      { id: "sec-log", label: "Raw token printed to log" },
      { id: "sec-leak", label: "Credential exported", isTerminal: true },
    ],
  },
  {
    id: "tampered-artifact",
    tabLabel: "Tampered artifact digest",
    ruleId: "SHA-256",
    severity: "CRITICAL",
    cwe: "CWE-494",
    gateActionLabel: "Digest mismatch blocked",
    compromisedOutcome: "Modified binary promoted to release registry",
    nodes: [
      { id: "art-build", label: "Built binary checksum" },
      { id: "art-gate", label: "SHA-256 verification", isGatePoint: true },
      { id: "art-diff", label: "Tampered package bytes" },
      { id: "art-pub", label: "Corrupted release", isTerminal: true },
    ],
  },
] as const;
