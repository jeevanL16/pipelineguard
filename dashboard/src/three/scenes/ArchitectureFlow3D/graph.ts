import { CI_GATE_THRESHOLD } from "../../../rules/analyzer";
import { WORKFLOW_RULES } from "../../../rules/registry";
import { SECRET_PATTERN_RULES } from "../../../rules/sampleWorkflows";

export type NodeKind =
  | "source"
  | "ingest"
  | "detect"
  | "score"
  | "event"
  | "store"
  | "surface";

export interface GraphNode {
  id: string;
  layer: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  row: number;
  kind: NodeKind;
  label: string;
  role: string;
  count?: () => number;
}

export interface GraphEdge {
  from: string;
  to: string;
  trace?: boolean;
}

export const LAYER_NAMES: readonly string[] = [
  "Sources",
  "Ingest",
  "Detect",
  "Score",
  "Events",
  "Store",
  "Surfaces",
];

export const ARCH_NODES: readonly GraphNode[] = [
  // Layer 0: Sources
  {
    id: "repo-source",
    layer: 0,
    row: 0,
    kind: "source",
    label: "GitHub repository",
    role: "Resolves repository metadata, default branches, and .github/workflows paths.",
  },
  {
    id: "yaml-source",
    layer: 0,
    row: 1,
    kind: "source",
    label: "Workflow YAML",
    role: "Workflow trigger, job, permission, and step definitions inspected before execution.",
  },
  {
    id: "secret-source",
    layer: 0,
    row: 2,
    kind: "source",
    label: "Secrets & logs",
    role: "Log output and config expressions checked for unmasked credentials.",
  },
  {
    id: "artifact-source",
    layer: 0,
    row: 3,
    kind: "source",
    label: "Build artifacts",
    role: "Produced binary bytes hashed client-side or in CI via SHA-256.",
  },

  // Layer 1: Ingest
  {
    id: "wf-parser",
    layer: 1,
    row: 1.5,
    kind: "ingest",
    label: "Workflow parser",
    role: "Parses YAML into line-mapped triggers, permissions, jobs, and shell steps.",
  },

  // Layer 2: Detect
  {
    id: "wf-rules",
    layer: 2,
    row: 0.5,
    kind: "detect",
    label: "Rule engine",
    role: "Evaluates active AST and pattern workflow rules with CWE metadata.",
    count: () => WORKFLOW_RULES.filter((r) => r.category !== "system").length,
  },
  {
    id: "secret-detectors",
    layer: 2,
    row: 1.75,
    kind: "detect",
    label: "Secret detectors",
    role: "Masks and flags exposed private keys, cloud tokens, and high-entropy credentials.",
    count: () => SECRET_PATTERN_RULES.length,
  },
  {
    id: "artifact-verifier",
    layer: 2,
    row: 3,
    kind: "detect",
    label: "Artifact verifier",
    role: "Enforces fail-closed SHA-256 digest equality before artifact promotion.",
  },

  // Layer 3: Score
  {
    id: "risk-scorer",
    layer: 3,
    row: 1.5,
    kind: "score",
    label: "Risk scorer",
    role: "Combines severity weights, confidence, and trigger exposure into a 0–100 score and A–F grade.",
  },

  // Layer 4: Events
  {
    id: "security-event",
    layer: 4,
    row: 1.5,
    kind: "event",
    label: "Security event",
    role: "Normalizes findings, line references, and redacted snippets into structured event records.",
  },

  // Layer 5: Store
  {
    id: "audit-store",
    layer: 5,
    row: 1.5,
    kind: "store",
    label: "Findings & audit store",
    role: "Persists pipeline runs, open findings, and append-only analyst status transitions.",
  },

  // Layer 6: Surfaces
  {
    id: "surface-dashboard",
    layer: 6,
    row: 0,
    kind: "surface",
    label: "Dashboard (/app)",
    role: "Interactive triage queue, evidence drawer, and filterable findings workspace.",
  },
  {
    id: "surface-ci-gate",
    layer: 6,
    row: 1.15,
    kind: "surface",
    label: "CI gate threshold",
    role: "Blocks workflow promotion when deterministic risk meets or exceeds threshold.",
    count: () => CI_GATE_THRESHOLD,
  },
  {
    id: "surface-incidents",
    layer: 6,
    row: 2.3,
    kind: "surface",
    label: "Incident triage",
    role: "Ranked queue surfacing open critical and high findings for rapid containment.",
  },
  {
    id: "surface-reports",
    layer: 6,
    row: 3.3,
    kind: "surface",
    label: "CLI & audit reports",
    role: "Structured runner exit codes, SARIF summaries, and signed status records.",
  },
] as const;

export const ARCH_EDGES: readonly GraphEdge[] = [
  { from: "repo-source", to: "wf-parser" },
  { from: "yaml-source", to: "wf-parser", trace: true },
  { from: "secret-source", to: "wf-parser" },
  { from: "secret-source", to: "secret-detectors" },
  { from: "artifact-source", to: "artifact-verifier" },

  { from: "wf-parser", to: "wf-rules", trace: true },
  { from: "wf-parser", to: "secret-detectors" },

  { from: "wf-rules", to: "risk-scorer", trace: true },
  { from: "secret-detectors", to: "risk-scorer" },
  { from: "artifact-verifier", to: "risk-scorer" },

  { from: "risk-scorer", to: "security-event", trace: true },
  { from: "security-event", to: "audit-store", trace: true },

  { from: "audit-store", to: "surface-dashboard", trace: true },
  { from: "audit-store", to: "surface-ci-gate", trace: true },
  { from: "audit-store", to: "surface-incidents" },
  { from: "audit-store", to: "surface-reports" },
] as const;

export function getArchNode(id: string): GraphNode | undefined {
  return ARCH_NODES.find((n) => n.id === id);
}

export function getConnectedNodeAndEdgeSet(nodeId: string | null): {
  nodeIds: Set<string>;
  edgeIndices: Set<number>;
} {
  const nodeIds = new Set<string>();
  const edgeIndices = new Set<number>();
  if (!nodeId) return { nodeIds, edgeIndices };
  nodeIds.add(nodeId);
  ARCH_EDGES.forEach((edge, idx) => {
    if (edge.from === nodeId || edge.to === nodeId) {
      edgeIndices.add(idx);
      nodeIds.add(edge.from);
      nodeIds.add(edge.to);
    }
  });
  return { nodeIds, edgeIndices };
}

export function getTraceSets(): {
  nodeIds: Set<string>;
  edgeIndices: Set<number>;
} {
  const nodeIds = new Set<string>();
  const edgeIndices = new Set<number>();
  ARCH_EDGES.forEach((edge, idx) => {
    if (edge.trace) {
      edgeIndices.add(idx);
      nodeIds.add(edge.from);
      nodeIds.add(edge.to);
    }
  });
  return { nodeIds, edgeIndices };
}
