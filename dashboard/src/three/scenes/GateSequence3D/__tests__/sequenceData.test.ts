import { describe, expect, it } from "vitest";
import {
  buildParsedAstNodes,
  canonicalizeFindings,
  computeCanonicalDigestHex,
  computeGateSequenceSummary,
} from "../sequenceData";
import { analyzeWorkflowText, CI_GATE_THRESHOLD } from "../../../../rules/analyzer";
import { HERO_BROKEN_WORKFLOW, PLAYGROUND_SAMPLES } from "../../../../rules/sampleWorkflows";

describe("GateSequence3D real data derivation", () => {
  it("builds non-empty AST tree nodes from the parsed sample document", () => {
    const astNodes = buildParsedAstNodes(HERO_BROKEN_WORKFLOW, "ci.yml");
    expect(astNodes.length).toBeGreaterThanOrEqual(6);
    expect(astNodes[0].kind).toBe("workflow");
    expect(astNodes.some((n) => n.kind === "job")).toBe(true);
    expect(astNodes.some((n) => n.kind === "step")).toBe(true);
    expect(astNodes.some((n) => n.findingSeverity === "CRITICAL" || n.findingSeverity === "HIGH")).toBe(true);
  });

  it("canonicalizes findings deterministically by ruleId then line and yields stable 12-hex digest", async () => {
    const res = analyzeWorkflowText(HERO_BROKEN_WORKFLOW, "ci.yml");
    const canonA = canonicalizeFindings(res.findings);
    const canonB = canonicalizeFindings([...res.findings].reverse());
    expect(canonA.map((f) => f.id)).toEqual(canonB.map((f) => f.id));

    for (let i = 1; i < canonA.length; i++) {
      const cmp = canonA[i - 1].ruleId.localeCompare(canonA[i].ruleId);
      expect(cmp).toBeLessThanOrEqual(0);
    }

    const summary = computeGateSequenceSummary();
    const hex1 = await computeCanonicalDigestHex(summary.canonicalPayload);
    const hex2 = await computeCanonicalDigestHex(summary.canonicalPayload);
    if (hex1 !== null) {
      expect(hex1).toMatch(/^[0-9a-f]{12}$/);
      expect(hex1).toBe(hex2);
    }
  });

  it("derives workflow path count and threshold directly from shared modules", () => {
    const summary = computeGateSequenceSummary();
    expect(summary.workflowPaths.length).toBe(PLAYGROUND_SAMPLES.length + 1);
    expect(summary.threshold).toBe(CI_GATE_THRESHOLD);
    expect(summary.analysis.risk.score).toBeGreaterThan(CI_GATE_THRESHOLD);
  });
});
