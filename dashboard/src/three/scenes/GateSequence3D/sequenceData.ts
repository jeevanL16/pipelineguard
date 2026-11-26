import { analyzeWorkflowText, CI_GATE_THRESHOLD } from "../../../rules/analyzer";
import { parseWorkflowYaml } from "../../../rules/parser";
import { HERO_BROKEN_WORKFLOW, PLAYGROUND_SAMPLES } from "../../../rules/sampleWorkflows";
import { SEVERITY_META } from "../../../rules/severity";
import type { AnalysisResult, Severity, WorkflowFinding } from "../../../rules/schemas";

export interface AstTreeNode {
  id: string;
  kind: "workflow" | "on" | "job" | "step";
  label: string;
  line: number;
  depth: number;
  findingSeverity: Severity | null;
}

export interface GateSequenceSummary {
  workflowPaths: readonly string[];
  astNodes: readonly AstTreeNode[];
  analysis: AnalysisResult;
  canonicalFindings: readonly WorkflowFinding[];
  canonicalPayload: string;
  riskFactors: {
    severityNormalized: number;
    confidenceNormalized: number;
    triggerNormalized: number;
  };
  threshold: number;
}

export function canonicalizeFindings(
  findings: readonly WorkflowFinding[]
): WorkflowFinding[] {
  return [...findings].sort((a, b) => {
    const ruleCmp = a.ruleId.localeCompare(b.ruleId);
    if (ruleCmp !== 0) return ruleCmp;
    const lineCmp = (a.line ?? 0) - (b.line ?? 0);
    if (lineCmp !== 0) return lineCmp;
    return a.id.localeCompare(b.id);
  });
}

export async function computeCanonicalDigestHex(payload: string): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const bytes = new TextEncoder().encode(payload);
  const digestBuf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digestBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

export function buildParsedAstNodes(yamlText: string, file = "ci.yml"): AstTreeNode[] {
  const parsed = parseWorkflowYaml(yamlText, file);
  const analysis = analyzeWorkflowText(yamlText, file);
  if (!parsed.ok || !parsed.workflow) return [];

  const wf = parsed.workflow;
  const lineSeverity = new Map<number, Severity>();
  for (const f of analysis.findings) {
    const lines = f.relatedLines.length > 0 ? f.relatedLines : f.line ? [f.line] : [];
    for (const ln of lines) {
      const prev = lineSeverity.get(ln);
      if (!prev || SEVERITY_META[f.severity].order < SEVERITY_META[prev].order) {
        lineSeverity.set(ln, f.severity);
      }
    }
  }

  const nodes: AstTreeNode[] = [
    {
      id: "ast-workflow",
      kind: "workflow",
      label: wf.name || "workflow",
      line: 1,
      depth: 0,
      findingSeverity: lineSeverity.get(1) ?? null,
    },
    {
      id: "ast-on",
      kind: "on",
      label: "on",
      line: wf.onLine ?? 2,
      depth: 1,
      findingSeverity:
        lineSeverity.get(wf.onLine ?? 2) ??
        Object.values(wf.onTriggerLines)
          .map((ln) => lineSeverity.get(ln))
          .find(Boolean) ??
        null,
    },
  ];

  if (wf.permissionsLine) {
    nodes.push({
      id: "ast-permissions",
      kind: "on",
      label: "permissions",
      line: wf.permissionsLine,
      depth: 1,
      findingSeverity: lineSeverity.get(wf.permissionsLine) ?? null,
    });
  }

  for (const job of wf.jobs) {
    nodes.push({
      id: `ast-job-${job.id}`,
      kind: "job",
      label: job.id,
      line: job.line,
      depth: 1,
      findingSeverity: lineSeverity.get(job.line) ?? null,
    });
    job.steps.forEach((step, idx) => {
      const stepLines = [step.line, step.usesLine, step.runLine, step.refLine].filter(
        (v): v is number => typeof v === "number"
      );
      let sev: Severity | null = null;
      for (const ln of stepLines) {
        const s = lineSeverity.get(ln);
        if (s && (!sev || SEVERITY_META[s].order < SEVERITY_META[sev].order)) {
          sev = s;
        }
      }
      nodes.push({
        id: `ast-step-${job.id}-${idx}`,
        kind: "step",
        label: step.uses ? step.uses.split("@")[0] : step.name || `step-${idx + 1}`,
        line: step.line,
        depth: 2,
        findingSeverity: sev,
      });
    });
  }

  return nodes;
}

export function computeGateSequenceSummary(): GateSequenceSummary {
  const analysis = analyzeWorkflowText(HERO_BROKEN_WORKFLOW, ".github/workflows/ci.yml");
  const astNodes = buildParsedAstNodes(HERO_BROKEN_WORKFLOW, ".github/workflows/ci.yml");
  const workflowPaths = [
    ".github/workflows/ci.yml",
    ...PLAYGROUND_SAMPLES.map((s) => `.github/workflows/${s.filename}`),
  ];

  const canonicalFindings = canonicalizeFindings(analysis.findings);
  const canonicalPayload = JSON.stringify(
    canonicalFindings.map((f) => ({
      ruleId: f.ruleId,
      severity: f.severity,
      line: f.line,
      cwe: f.cwe,
      file: f.file,
    }))
  );

  const highSevCount = analysis.findings.filter(
    (f) => f.severity === "CRITICAL" || f.severity === "HIGH"
  ).length;
  const highConfCount = analysis.findings.filter((f) => f.confidence === "HIGH").length;
  const maxTriggerRisk = /pull_request_target/i.test(HERO_BROKEN_WORKFLOW) ? 1.0 : 0.65;

  return {
    workflowPaths,
    astNodes,
    analysis,
    canonicalFindings,
    canonicalPayload,
    riskFactors: {
      severityNormalized:
        analysis.findings.length > 0 ? Math.min(1, 0.35 + highSevCount * 0.14) : 0,
      confidenceNormalized:
        analysis.findings.length > 0 ? highConfCount / analysis.findings.length : 0,
      triggerNormalized: maxTriggerRisk,
    },
    threshold: CI_GATE_THRESHOLD,
  };
}
