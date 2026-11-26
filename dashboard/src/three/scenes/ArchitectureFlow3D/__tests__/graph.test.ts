import { describe, expect, it } from "vitest";
import { ARCH_EDGES, ARCH_NODES, getArchNode, getTraceSets } from "../graph";
import { WORKFLOW_RULES } from "../../../../rules/registry";
import { SECRET_PATTERN_RULES } from "../../../../rules/sampleWorkflows";
import { CI_GATE_THRESHOLD } from "../../../../rules/analyzer";

describe("ArchitectureFlow3D graph integrity", () => {
  it("contains only valid edge endpoints flowing strictly forward across layers", () => {
    for (const edge of ARCH_EDGES) {
      const fromNode = getArchNode(edge.from);
      const toNode = getArchNode(edge.to);
      expect(fromNode, `Missing source node: ${edge.from}`).toBeDefined();
      expect(toNode, `Missing target node: ${edge.to}`).toBeDefined();
      expect(toNode!.layer).toBeGreaterThan(fromNode!.layer);
    }
  });

  it("maintains a continuous trace path from layer 0 to layer 6", () => {
    const traceEdges = ARCH_EDGES.filter((e) => e.trace);
    expect(traceEdges.length).toBeGreaterThanOrEqual(6);

    const { nodeIds } = getTraceSets();
    const layersPresent = new Set<number>();
    nodeIds.forEach((id) => {
      const n = getArchNode(id);
      if (n) layersPresent.add(n.layer);
    });
    expect(layersPresent).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]));

    // Every trace target except layer 0 must be reachable from a trace edge, and every non-layer-6 source must continue
    for (const e of traceEdges) {
      const fromLayer = getArchNode(e.from)!.layer;
      const toLayer = getArchNode(e.to)!.layer;
      if (fromLayer > 0) {
        expect(traceEdges.some((prev) => prev.to === e.from)).toBe(true);
      }
      if (toLayer < 6) {
        expect(traceEdges.some((next) => next.from === e.to)).toBe(true);
      }
    }
  });

  it("derives counts strictly from shared rules and analyzer constants", () => {
    const ruleEngine = ARCH_NODES.find((n) => n.id === "wf-rules");
    const secretNode = ARCH_NODES.find((n) => n.id === "secret-detectors");
    const gateNode = ARCH_NODES.find((n) => n.id === "surface-ci-gate");

    expect(ruleEngine?.count?.()).toBe(
      WORKFLOW_RULES.filter((r) => r.category !== "system").length
    );
    expect(secretNode?.count?.()).toBe(SECRET_PATTERN_RULES.length);
    expect(gateNode?.count?.()).toBe(CI_GATE_THRESHOLD);
  });
});
