import { lookupRule } from "./registry";
import { parseWorkflowYaml, type ParsedJob, type ParsedStep, type ParsedWorkflow } from "./parser";
import { SEVERITY_META } from "./severity";
import type { AnalysisResult, RiskScore, WorkflowFinding } from "./schemas";

export const CI_GATE_THRESHOLD = 70;

const EXPR_RE = /\$\{\{((?:[^{}]|\{(?!\{)|\}(?!\})){0,2000}?)\}\}/g;

const UNTRUSTED_EXACT = new Set([
  "github.event.issue.title",
  "github.event.issue.body",
  "github.event.pull_request.title",
  "github.event.pull_request.body",
  "github.event.pull_request.head.ref",
  "github.event.pull_request.head.label",
  "github.event.comment.body",
  "github.event.review.body",
  "github.event.head_commit.message",
  "github.event.head_commit.author.name",
  "github.event.head_commit.author.email",
  "github.event.head_commit.author.username",
  "github.head_ref",
  "github.event.commits",
]);

const UNTRUSTED_PREFIXES = [
  "github.event.commits[",
  "github.event.inputs.",
  "inputs.",
  "inputs[",
];

const HIGH_RISK_TRIGGERS = new Set(["pull_request_target", "issue_comment", "workflow_run"]);

const WRITE_SCOPES = new Set([
  "actions",
  "checks",
  "contents",
  "deployments",
  "discussions",
  "id-token",
  "issues",
  "packages",
  "pages",
  "pull-requests",
  "repository-projects",
  "security-events",
  "statuses",
]);

const TRIGGER_MULTIPLIERS: Record<string, number> = {
  pull_request_target: 1.4,
  issue_comment: 1.3,
  workflow_run: 1.3,
  pull_request: 1.1,
  push: 1.0,
};

function isUntrustedExpr(expr: string): boolean {
  const s = expr.trim();
  if (UNTRUSTED_EXACT.has(s)) return true;
  if (UNTRUSTED_PREFIXES.some((p) => s.startsWith(p))) return true;
  for (const target of UNTRUSTED_EXACT) {
    const re = new RegExp(`\\b${target.replace(/\./g, "\\.")}\\b`);
    if (re.test(s)) return true;
  }
  for (const prefix of UNTRUSTED_PREFIXES) {
    const clean = prefix.replace(/[.\[\s]+$/g, "");
    const re = new RegExp(`\\b${clean.replace(/\./g, "\\.")}[.\\[]`);
    if (re.test(s)) return true;
  }
  return false;
}

function collectExpressions(value: unknown, baseLine: number | null): Array<{ text: string; line: number | null }> {
  const found: Array<{ text: string; line: number | null }> = [];
  if (typeof value === "string") {
    const lines = value.split(/\r?\n/);
    lines.forEach((lineText, idx) => {
      let match: RegExpExecArray | null;
      const re = new RegExp(EXPR_RE.source, "g");
      while ((match = re.exec(lineText)) !== null) {
        const offset = lines.length > 1 ? idx + 1 : 0;
        found.push({
          text: match[1].trim(),
          line: baseLine ? baseLine + offset : null,
        });
      }
    });
  } else if (Array.isArray(value)) {
    for (const item of value) {
      found.push(...collectExpressions(item, baseLine));
    }
  } else if (value && typeof value === "object") {
    for (const val of Object.values(value)) {
      found.push(...collectExpressions(val, baseLine));
    }
  }
  return found;
}

function extractTriggers(onVal: unknown): Set<string> {
  if (typeof onVal === "string") return new Set([onVal.toLowerCase()]);
  if (Array.isArray(onVal)) return new Set(onVal.filter(Boolean).map((v) => String(v).toLowerCase()));
  if (onVal && typeof onVal === "object") {
    return new Set(Object.keys(onVal).map((k) => k.toLowerCase()));
  }
  return new Set();
}

function checkWritePermissions(permissions: unknown): { broad: boolean; reason: string } {
  if (!permissions) return { broad: false, reason: "" };
  if (typeof permissions === "string") {
    if (permissions.toLowerCase() === "write-all" || permissions.toLowerCase() === "write_all") {
      return { broad: true, reason: `permissions: ${permissions}` };
    }
    return { broad: false, reason: "" };
  }
  if (typeof permissions === "object" && !Array.isArray(permissions)) {
    for (const [scope, level] of Object.entries(permissions)) {
      if (typeof level === "string" && level.toLowerCase() === "write" && WRITE_SCOPES.has(scope)) {
        return { broad: true, reason: `${scope}: write` };
      }
    }
  }
  return { broad: false, reason: "" };
}

function isActionPinned(uses: string): boolean {
  const s = uses.trim();
  if (!s) return false;
  if (/^\.{1,2}\//.test(s)) return true;
  if (/^docker:\/\//i.test(s)) {
    return /^docker:\/\/[^\s@]{1,250}@sha256:[0-9a-fA-F]{64}$/i.test(s);
  }
  const atIdx = s.lastIndexOf("@");
  if (atIdx !== -1) {
    const ref = s.slice(atIdx + 1).trim();
    return /^[0-9a-fA-F]{40}$/.test(ref);
  }
  return false;
}

function buildFinding(
  ruleId: string,
  workflow: ParsedWorkflow,
  opts: {
    line: number | null;
    relatedLines?: number[];
    job?: ParsedJob | null;
    step?: ParsedStep | null;
    snippet: string;
    message: string;
    confidence?: "HIGH" | "MEDIUM" | "LOW";
  }
): WorkflowFinding {
  const rule = lookupRule(ruleId);
  const line = opts.line;
  const related = opts.relatedLines && opts.relatedLines.length > 0 ? opts.relatedLines : line ? [line] : [];
  return {
    id: `${ruleId}:${line ?? 0}:${opts.snippet.slice(0, 24)}`,
    ruleId: rule.id,
    title: rule.title,
    severity: rule.severity,
    action: rule.action,
    cwe: rule.cwe,
    file: workflow.file,
    line,
    relatedLines: related,
    jobId: opts.job?.id ?? null,
    stepName: opts.step?.name ?? null,
    snippet: opts.snippet,
    message: opts.message,
    fixSummary: rule.fixSummary,
    remediation: rule.remediation,
    confidence: opts.confidence ?? "HIGH",
  };
}

function isSuppressed(lines: string[], line: number | null, ruleId: string): boolean {
  if (!line || line < 1 || line > lines.length) return false;
  const re = new RegExp(`#\\s*pipelineguard[-:]ignore:?\\s*${ruleId}\\b\\s*:?\\s*(\\S.*)?$`, "i");
  const candidates = [lines[line - 1], line > 1 ? lines[line - 2] : ""];
  return candidates.some((text) => {
    const m = re.exec(text);
    return Boolean(m && m[1] && m[1].trim().length > 0);
  });
}

export function calculateRisk(findings: WorkflowFinding[], triggers: Set<string>): RiskScore {
  if (findings.length === 0) return { score: 0, grade: "A" };
  const confMult: Record<string, number> = { HIGH: 1.0, MEDIUM: 0.8, LOW: 0.5 };
  const weights = findings.map((f) => {
    const sevWeight = SEVERITY_META[f.severity].weight;
    return sevWeight * (confMult[f.confidence] ?? 1.0);
  });
  const maxW = Math.max(...weights);
  const sumW = weights.reduce((a, b) => a + b, 0);
  const baseScore = Math.min(maxW, 40) + Math.min(0.6 * sumW, 40);
  let trigMult = 1.0;
  for (const t of triggers) {
    if ((TRIGGER_MULTIPLIERS[t] ?? 1.0) > trigMult) {
      trigMult = TRIGGER_MULTIPLIERS[t];
    }
  }
  const score = Math.min(100, Math.max(0, Math.round(baseScore * trigMult)));
  const grade =
    score <= 15 ? "A" : score <= 35 ? "B" : score <= 55 ? "C" : score <= 75 ? "D" : "F";
  return { score, grade };
}

export function analyzeWorkflowText(
  rawText: string,
  file = ".github/workflows/ci.yml"
): AnalysisResult {
  const lineCount = rawText ? rawText.split(/\r?\n/).length : 0;
  const parsed = parseWorkflowYaml(rawText, file);

  if (!parsed.ok || !parsed.workflow) {
    const f = buildFinding("PG-WF-900", { file, name: null, on: null, onLine: null, onTriggerLines: {}, permissions: null, permissionsLine: null, jobs: [], lines: [] }, {
      line: parsed.errorLine,
      snippet: parsed.error || "Parse error",
      message: parsed.error || "Workflow parse error.",
    });
    return {
      findings: [f],
      parseError: parsed.error,
      parseErrorLine: parsed.errorLine,
      risk: calculateRisk([f], new Set()),
      lineCount,
      suppressedCount: 0,
    };
  }

  const wf = parsed.workflow;
  if (!rawText.trim()) {
    return {
      findings: [],
      parseError: null,
      parseErrorLine: null,
      risk: { score: 0, grade: "A" },
      lineCount: 0,
      suppressedCount: 0,
    };
  }

  const triggers = extractTriggers(wf.on);
  const highRisk = Array.from(triggers).some((t) => HIGH_RISK_TRIGGERS.has(t));
  const findings: WorkflowFinding[] = [];

  // PG-WF-004: Missing top-level permissions
  if (wf.permissions === undefined && wf.jobs.length > 0) {
    findings.push(
      buildFinding("PG-WF-004", wf, {
        line: wf.onLine || 1,
        snippet: "permissions: <not set>",
        message: "No top-level permissions: block defined; token defaults to broad write scope.",
      })
    );
  }

  // PG-WF-005: Overly broad top-level permissions
  const topPerm = checkWritePermissions(wf.permissions);
  if (topPerm.broad) {
    findings.push(
      buildFinding("PG-WF-005", wf, {
        line: wf.permissionsLine || 1,
        snippet: topPerm.reason,
        message: `Top-level '${topPerm.reason}' grants write access across jobs.`,
      })
    );
  }

  // PG-WF-018: schedule persistence
  if (triggers.has("schedule")) {
    findings.push(
      buildFinding("PG-WF-018", wf, {
        line: wf.onTriggerLines.schedule || wf.onLine || 1,
        snippet: "on:\n  schedule:",
        message: "Cron schedule trigger runs unattended; pin every dependency and restrict permissions.",
        confidence: "MEDIUM",
      })
    );
  }

  for (const job of wf.jobs) {
    // Job-level permissions
    const jobPerm = checkWritePermissions(job.permissions);
    if (jobPerm.broad) {
      findings.push(
        buildFinding("PG-WF-005", wf, {
          line: job.line,
          job,
          snippet: `jobs.${job.id}.permissions: ${jobPerm.reason}`,
          message: `Job '${job.id}' permission '${jobPerm.reason}' grants write access.`,
          confidence: "MEDIUM",
        })
      );
    }

    // PG-WF-007: secrets: inherit
    if (typeof job.secrets === "string" && job.secrets.toLowerCase() === "inherit") {
      findings.push(
        buildFinding("PG-WF-007", wf, {
          line: job.line,
          job,
          snippet: "secrets: inherit",
          message: `Job '${job.id}' passes all caller secrets via secrets: inherit.`,
        })
      );
    }

    for (const step of job.steps) {
      // Supply chain + checkout rules
      if (step.uses) {
        const uses = step.uses.trim();
        const usesLine = step.usesLine || step.line;

        // PG-WF-006: pull_request_target + head ref checkout
        if (triggers.has("pull_request_target") && /^actions\/checkout(?:@|$)/i.test(uses)) {
          const refVal = typeof step.withInputs.ref === "string" ? step.withInputs.ref : "";
          if (/github\.(?:head_ref|event\.pull_request\.head\.(?:ref|sha))/i.test(refVal)) {
            const triggerLine = wf.onTriggerLines.pull_request_target || wf.onLine || 3;
            const refLine = step.refLine || step.line;
            findings.push(
              buildFinding("PG-WF-006", wf, {
                line: triggerLine,
                relatedLines: [triggerLine, refLine],
                job,
                step,
                snippet: `pull_request_target + ref: ${refVal}`,
                message: "pull_request_target runs untrusted PR head code with write token access.",
              })
            );
          }
        }

        // PG-WF-019: Action not pinned to SHA
        if (!isActionPinned(uses)) {
          findings.push(
            buildFinding("PG-WF-019", wf, {
              line: usesLine,
              job,
              step,
              snippet: `uses: ${uses}`,
              message: `Action '${uses}' is pinned to a mutable tag or branch rather than a 40-char commit SHA.`,
            })
          );
        }

        // PG-WF-020: actions/checkout without persist-credentials: false
        if (/^actions\/checkout(?:@|$)/i.test(uses)) {
          const pc = step.withInputs["persist-credentials"] ?? step.withInputs.persist_credentials;
          const isDisabled =
            pc === false || (typeof pc === "string" && pc.replace(/['"]/g, "").trim().toLowerCase() === "false");
          if (!isDisabled) {
            findings.push(
              buildFinding("PG-WF-020", wf, {
                line: usesLine,
                job,
                step,
                snippet: `uses: ${uses}`,
                message: "Checkout leaves GITHUB_TOKEN in git config because persist-credentials: false is not set.",
              })
            );
          }
        }

        // PG-WF-002: actions/github-script injection
        if (/^actions\/github-script(?:@|$)/i.test(uses)) {
          const untrusted = collectExpressions(step.withInputs, step.line).filter((e) =>
            isUntrustedExpr(e.text)
          );
          for (const expr of untrusted) {
            findings.push(
              buildFinding("PG-WF-002", wf, {
                line: expr.line || usesLine,
                job,
                step,
                snippet: `script: ... \${{ ${expr.text} }}`,
                message: `Untrusted expression '\${{ ${expr.text} }}' interpolated in actions/github-script.`,
                confidence: highRisk ? "HIGH" : "MEDIUM",
              })
            );
          }
        }
      }

      // Run step checks
      if (step.run) {
        const runLine = step.runLine || step.line;
        const normalizedRun = step.run.replace(/\\\r?\n\s*/g, " ");

        // PG-WF-001 & PG-WF-003
        const untrusted = collectExpressions(step.run, runLine).filter((e) =>
          isUntrustedExpr(e.text)
        );
        for (const expr of untrusted) {
          findings.push(
            buildFinding("PG-WF-001", wf, {
              line: expr.line || runLine,
              job,
              step,
              snippet: step.run.trim().slice(0, 120),
              message: `Untrusted context '\${{ ${expr.text} }}' interpolated directly into shell command.`,
              confidence: highRisk ? "HIGH" : "MEDIUM",
            })
          );
        }
        if (
          untrusted.length > 0 &&
          /(?:>>|printf\b[^#\n]{0,120}>>)\s*["']?\$(?:GITHUB_ENV|GITHUB_OUTPUT|GITHUB_PATH)["']?/i.test(
            step.run
          )
        ) {
          for (const expr of untrusted) {
            findings.push(
              buildFinding("PG-WF-003", wf, {
                line: expr.line || runLine,
                job,
                step,
                snippet: step.run.trim().slice(0, 120),
                message: `Untrusted expression '\${{ ${expr.text} }}' written to GITHUB_ENV/GITHUB_OUTPUT/GITHUB_PATH.`,
                confidence: highRisk ? "HIGH" : "MEDIUM",
              })
            );
          }
        }

        // PG-WF-008: curl|bash / wget|sh
        const pipeMatch =
          /\b(?:curl|wget)\b[^|#\n]{0,300}\|[^|#\n]{0,80}\b(?:bash|sh|zsh|ash|dash|fish)\b/i.exec(
            normalizedRun
          );
        if (pipeMatch) {
          findings.push(
            buildFinding("PG-WF-008", wf, {
              line: runLine,
              job,
              step,
              snippet: pipeMatch[0],
              message: "Remote script downloaded and piped straight into a shell interpreter.",
            })
          );
        }

        // PG-WF-009: base64 | shell
        const b64Match =
          /\bbase64\b[^|#\n]{0,150}(?:-d|--decode|-D)[^|#\n]{0,150}\|[^|#\n]{0,80}\b(?:bash|sh|zsh)\b/i.exec(
            normalizedRun
          );
        if (b64Match) {
          findings.push(
            buildFinding("PG-WF-009", wf, {
              line: runLine,
              job,
              step,
              snippet: b64Match[0],
              message: "Base64-decoded payload piped into a shell interpreter.",
            })
          );
        }

        // PG-WF-010: eval
        const evalMatch = /\beval\s+["']?\$|\beval\s+["']?`|\b(?:bash|sh)\b[^#\n]{0,80}-c\s+["']?\$[A-Za-z_]/i.exec(
          normalizedRun
        );
        if (evalMatch) {
          findings.push(
            buildFinding("PG-WF-010", wf, {
              line: runLine,
              job,
              step,
              snippet: evalMatch[0],
              message: "Shell eval executes variable or subshell text.",
            })
          );
        }

        // PG-WF-011: Reverse shell
        const revMatch =
          /\bbash\b[^#\n]{0,200}>&\s*\/dev\/(?:tcp|udp)\/|\bncat?\b[^#\n]{0,100}-e\b|\bpython[23]?\b[^#\n]{0,200}socket\.connect\(/i.exec(
            normalizedRun
          );
        if (revMatch) {
          findings.push(
            buildFinding("PG-WF-011", wf, {
              line: runLine,
              job,
              step,
              snippet: revMatch[0],
              message: "Reverse-shell indicator detected in run step.",
            })
          );
        }

        // PG-WF-021: Secret echoed in run
        const echoSecret = /\becho\b[^#\n]{0,200}\$\{\{[^}]{0,100}secrets\./i.exec(normalizedRun);
        if (echoSecret) {
          findings.push(
            buildFinding("PG-WF-021", wf, {
              line: runLine,
              job,
              step,
              snippet: step.run.trim().slice(0, 120),
              message: "A secret expression is written via echo in the job log.",
            })
          );
        }

        // PG-WF-022: download + chmod +x
        if (/\b(?:curl|wget)\b/i.test(normalizedRun) && /\bchmod\b[^#\n]{0,80}\+x\b/i.test(normalizedRun)) {
          findings.push(
            buildFinding("PG-WF-022", wf, {
              line: runLine,
              job,
              step,
              snippet: step.run.trim().slice(0, 120),
              message: "Downloaded binary marked executable without checksum verification.",
              confidence: "MEDIUM",
            })
          );
        }

        // PG-WF-023: cryptominer
        const minerMatch = /\b(?:xmrig|xmr-stak|cpuminer|minerd|ethminer|lolminer)\b/i.exec(normalizedRun);
        if (minerMatch) {
          findings.push(
            buildFinding("PG-WF-023", wf, {
              line: runLine,
              job,
              step,
              snippet: minerMatch[0],
              message: `Known cryptominer binary '${minerMatch[0]}' invoked in step.`,
            })
          );
        }

        // Network rules PG-WF-012..015
        const rawIp = /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?:[:/][^\s"']{0,200})?/i.exec(step.run);
        if (rawIp) {
          findings.push(
            buildFinding("PG-WF-012", wf, {
              line: runLine,
              job,
              step,
              snippet: rawIp[0],
              message: `Download from raw IP address '${rawIp[0]}'.`,
              confidence: "MEDIUM",
            })
          );
        }

        const exfil =
          /(?:https?:\/\/)?(?:pastebin\.com|transfer\.sh|ngrok\.io|webhook\.site|pipedream\.net|canarytokens\.com|interactsh\.com)/i.exec(
            step.run
          );
        if (exfil) {
          findings.push(
            buildFinding("PG-WF-013", wf, {
              line: runLine,
              job,
              step,
              snippet: exfil[0],
              message: `Known exfiltration or C2 service contacted: '${exfil[0]}'.`,
            })
          );
        }

        const httpOnly = /\bhttp:\/\/(?!(?:localhost|127\.0\.0\.1|::1))[A-Za-z0-9][^\s"']{1,120}/i.exec(
          step.run
        );
        if (httpOnly) {
          findings.push(
            buildFinding("PG-WF-014", wf, {
              line: runLine,
              job,
              step,
              snippet: httpOnly[0],
              message: `Unencrypted http:// download '${httpOnly[0]}'.`,
              confidence: "MEDIUM",
            })
          );
        }

        const insecure = /\bcurl\b[^\n]{0,200}(?:\s-k\b|\s--insecure\b)/i.exec(step.run);
        if (insecure) {
          findings.push(
            buildFinding("PG-WF-015", wf, {
              line: runLine,
              job,
              step,
              snippet: insecure[0],
              message: "curl invoked with -k / --insecure disabling TLS verification.",
            })
          );
        }

        // Modification rules PG-WF-016..017
        if (/\.github[/\\]workflows[/\\]/i.test(step.run) && /(?:>>?|tee|cp|mv|install|cat)/i.test(step.run)) {
          findings.push(
            buildFinding("PG-WF-016", wf, {
              line: runLine,
              job,
              step,
              snippet: step.run.trim().slice(0, 120),
              message: "Run step writes files under .github/workflows/.",
            })
          );
        }

        if (
          /\bgit\b[^#\n]{0,100}(?:push|commit)\b/i.test(step.run) &&
          /\$(?:GITHUB_TOKEN|\{\{\s*(?:secrets\.GITHUB_TOKEN|github\.token)\s*\}\})/i.test(step.run)
        ) {
          findings.push(
            buildFinding("PG-WF-017", wf, {
              line: runLine,
              job,
              step,
              snippet: step.run.trim().slice(0, 120),
              message: "Run step runs git commit/push with GITHUB_TOKEN.",
              confidence: "MEDIUM",
            })
          );
        }
      }
    }
  }

  let suppressedCount = 0;
  const active: WorkflowFinding[] = [];
  for (const f of findings) {
    if (isSuppressed(wf.lines, f.line, f.ruleId)) {
      suppressedCount += 1;
    } else {
      active.push(f);
    }
  }

  // Deterministic order by primary line, then severity weight, then ruleId
  active.sort((a, b) => {
    const la = a.line ?? 0;
    const lb = b.line ?? 0;
    if (la !== lb) return la - lb;
    const sa = SEVERITY_META[a.severity].order;
    const sb = SEVERITY_META[b.severity].order;
    if (sa !== sb) return sa - sb;
    return a.ruleId.localeCompare(b.ruleId);
  });

  return {
    findings: active,
    parseError: null,
    parseErrorLine: null,
    risk: calculateRisk(active, triggers),
    lineCount,
    suppressedCount,
  };
}
