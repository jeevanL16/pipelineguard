import assert from "node:assert/strict";
import { analyzeWorkflowText } from "../src/rules/analyzer.ts";
import {
  HERO_BROKEN_WORKFLOW,
  HERO_FIXED_WORKFLOW,
  PLAYGROUND_SAMPLES,
} from "../src/rules/sampleWorkflows.ts";
import { WORKFLOW_RULES } from "../src/rules/registry.ts";

assert.equal(WORKFLOW_RULES.length, 24, "Expected 24 rules (PG-WF-001..023 + PG-WF-900)");

const broken = analyzeWorkflowText(HERO_BROKEN_WORKFLOW, "ci.yml");
console.log("Hero broken findings:", broken.findings.map((f) => `${f.ruleId}@L${f.line}(${f.severity})`));
assert.ok(broken.findings.some((f) => f.ruleId === "PG-WF-006" && f.line === 3), "PG-WF-006 expected at line 3");
assert.ok(broken.findings.some((f) => f.ruleId === "PG-WF-005" && f.line === 5), "PG-WF-005 expected at line 5");
assert.ok(broken.findings.some((f) => f.ruleId === "PG-WF-020" && f.line === 10), "PG-WF-020 expected at line 10");
assert.ok(broken.findings.some((f) => f.ruleId === "PG-WF-019" && f.line === 13), "PG-WF-019 expected at line 13");
assert.ok(broken.findings.some((f) => f.ruleId === "PG-WF-021" && f.line === 14), "PG-WF-021 expected at line 14");
assert.ok(broken.findings.some((f) => f.ruleId === "PG-WF-001" && f.line === 15), "PG-WF-001 expected at line 15");

const fixed = analyzeWorkflowText(HERO_FIXED_WORKFLOW, "ci.yml");
console.log("Hero fixed findings:", fixed.findings.length, "risk:", fixed.risk);
assert.equal(fixed.findings.length, 0, "Hero fixed workflow must produce zero findings");
assert.equal(fixed.risk.score, 0, "Fixed risk score must be 0");

for (const sample of PLAYGROUND_SAMPLES) {
  const res = analyzeWorkflowText(sample.yaml, sample.filename);
  console.log(`Sample ${sample.id}:`, res.findings.map((f) => `${f.ruleId}@L${f.line}`));
  assert.ok(res.findings.length >= 1, `Expected >=1 finding on ${sample.id}`);
}

const badYaml = analyzeWorkflowText("jobs:\n  build:\n    steps:\n    name: bad-indent", "bad.yml");
console.log("Bad YAML parse error:", badYaml.parseError, "line:", badYaml.parseErrorLine);
assert.ok(badYaml.parseError && badYaml.findings[0]?.ruleId === "PG-WF-900", "Expected PG-WF-900");

const suppressed = analyzeWorkflowText(
  `name: ok\non: [push]\npermissions:\n  contents: read\njobs:\n  b:\n    runs-on: ubuntu-latest\n    steps:\n      # pipelineguard-ignore: PG-WF-019 trusted internal action\n      - uses: vendor/deploy@v1`,
  "sup.yml"
);
assert.equal(suppressed.findings.length, 0, "Suppressed finding should be excluded");
assert.equal(suppressed.suppressedCount, 1, "Suppressed count should be 1");

console.log("ALL RULE ENGINE FIXTURE TESTS PASSED");
