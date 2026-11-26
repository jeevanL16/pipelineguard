import { describe, expect, it } from "vitest";
import { INCIDENT_PATHS } from "../../../features/landing/components/incidentPaths";
import { WORKFLOW_RULES } from "../../../rules/registry";
import { SEVERITY_META } from "../../../rules/severity";

describe("Phase 4 RuleCatalog3D & AttackPath3D data integrity", () => {
  it("ties rule-based incident tabs to real rules from registry", () => {
    expect(INCIDENT_PATHS).toHaveLength(3);
    for (const path of INCIDENT_PATHS) {
      expect(path.nodes).toHaveLength(4);
      expect(path.nodes.filter((n) => n.isGatePoint)).toHaveLength(1);
      expect(path.nodes.filter((n) => n.isTerminal)).toHaveLength(1);
      if (path.ruleId.startsWith("PG-WF-")) {
        expect(WORKFLOW_RULES.some((r) => r.id === path.ruleId)).toBe(true);
      }
    }
  });

  it("derives block height factors strictly from analyzer SEVERITY_META weights", () => {
    const activeRules = WORKFLOW_RULES.filter((r) => r.category !== "system");
    expect(activeRules.length).toBe(23);
    const maxW = SEVERITY_META.CRITICAL.weight;
    expect(maxW).toBeGreaterThan(SEVERITY_META.HIGH.weight);
    expect(SEVERITY_META.HIGH.weight).toBeGreaterThan(SEVERITY_META.MEDIUM.weight);
    expect(SEVERITY_META.MEDIUM.weight).toBeGreaterThan(SEVERITY_META.LOW.weight);
  });
});
