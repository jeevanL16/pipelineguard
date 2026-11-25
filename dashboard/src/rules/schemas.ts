import { z } from "zod";

export const SeveritySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const BadgeToneSchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO", "PASS"]);
export type BadgeTone = z.infer<typeof BadgeToneSchema>;

export const ActionSchema = z.enum(["BLOCK", "WARN"]);
export type Action = z.infer<typeof ActionSchema>;

export const RuleCategorySchema = z.enum([
  "injection",
  "permissions",
  "commands",
  "network",
  "modification",
  "supply_chain",
  "system",
]);
export type RuleCategory = z.infer<typeof RuleCategorySchema>;

export const RuleSchema = z.object({
  id: z.string().regex(/^PG-WF-\d{3}$/),
  title: z.string().min(1),
  description: z.string().min(1),
  severity: SeveritySchema,
  action: ActionSchema,
  cwe: z.string().min(1),
  category: RuleCategorySchema,
  example: z.string(),
  fixSummary: z.string(),
  remediation: z.string().min(1),
  references: z.array(z.string()).default([]),
});
export type Rule = z.infer<typeof RuleSchema>;

export const WorkflowFindingSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  title: z.string(),
  severity: SeveritySchema,
  action: ActionSchema,
  cwe: z.string(),
  file: z.string(),
  line: z.number().int().positive().nullable(),
  relatedLines: z.array(z.number().int().positive()).default([]),
  jobId: z.string().nullable(),
  stepName: z.string().nullable(),
  snippet: z.string(),
  message: z.string(),
  fixSummary: z.string(),
  remediation: z.string(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
});
export type WorkflowFinding = z.infer<typeof WorkflowFindingSchema>;

export const RiskScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  grade: z.enum(["A", "B", "C", "D", "F"]),
});
export type RiskScore = z.infer<typeof RiskScoreSchema>;

export const AnalysisResultSchema = z.object({
  findings: z.array(WorkflowFindingSchema),
  parseError: z.string().nullable(),
  parseErrorLine: z.number().int().positive().nullable(),
  risk: RiskScoreSchema,
  lineCount: z.number().int().nonnegative(),
  suppressedCount: z.number().int().nonnegative(),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const FindingStatusSchema = z.enum([
  "OPEN",
  "INVESTIGATING",
  "RESOLVED",
  "FALSE_POSITIVE",
]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;
