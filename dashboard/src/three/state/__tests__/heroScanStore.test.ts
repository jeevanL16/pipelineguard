import { describe, expect, it, beforeEach } from "vitest";
import {
  getHeroScanState,
  resetHeroScanStoreForTests,
  setHeroScanState,
  subscribeHeroScan,
} from "../heroScanStore";
import { analyzeWorkflowText } from "../../../rules/analyzer";
import { HERO_BROKEN_WORKFLOW } from "../../../rules/sampleWorkflows";

describe("heroScanStore bridge", () => {
  beforeEach(() => {
    resetHeroScanStoreForTests();
  });

  it("tracks findings length from the analyzer without hardcoded tile counts", () => {
    const analysis = analyzeWorkflowText(HERO_BROKEN_WORKFLOW, "ci.yml");
    let notified = 0;
    const unsub = subscribeHeroScan(() => {
      notified += 1;
    });

    setHeroScanState({
      phase: "scanning",
      scanLine: 3,
      totalLines: 15,
      findings: analysis.findings,
      revealedCount: 1,
      fixedCount: 0,
      digest: null,
    });

    expect(notified).toBe(1);
    expect(getHeroScanState().findings.length).toBe(analysis.findings.length);
    expect(getHeroScanState().digest).toBeNull();

    // No-op identical update does not notify subscribers
    setHeroScanState({ scanLine: 3 });
    expect(notified).toBe(1);

    unsub();
  });

  it("records sequential fixedCount steps cleanly", () => {
    const analysis = analyzeWorkflowText(HERO_BROKEN_WORKFLOW, "ci.yml");
    setHeroScanState({
      phase: "rescanning",
      findings: analysis.findings,
      fixedCount: 0,
    });
    for (let i = 1; i <= analysis.findings.length; i++) {
      setHeroScanState({ fixedCount: i });
      expect(getHeroScanState().fixedCount).toBe(i);
    }
    setHeroScanState({ phase: "fixed", digest: "9f2c41ab07de" });
    expect(getHeroScanState().phase).toBe("fixed");
    expect(getHeroScanState().digest).toBe("9f2c41ab07de");
  });
});
