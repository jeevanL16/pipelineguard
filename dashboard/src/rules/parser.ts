import * as yaml from "js-yaml";

export interface ParsedStep {
  name: string | null;
  uses: string | null;
  run: string | null;
  withInputs: Record<string, unknown>;
  env: Record<string, unknown>;
  line: number;
  usesLine: number | null;
  runLine: number | null;
  refLine: number | null;
}

export interface ParsedJob {
  id: string;
  name: string | null;
  permissions: unknown;
  secrets: unknown;
  line: number;
  steps: ParsedStep[];
}

export interface ParsedWorkflow {
  file: string;
  name: string | null;
  on: unknown;
  onLine: number | null;
  onTriggerLines: Record<string, number>;
  permissions: unknown;
  permissionsLine: number | null;
  jobs: ParsedJob[];
  lines: string[];
}

export interface ParseWorkflowOutput {
  ok: boolean;
  workflow: ParsedWorkflow | null;
  error: string | null;
  errorLine: number | null;
}

/**
 * Finds 1-based line number of a regex or literal needle searching forward from startIdx (0-based).
 */
function findLineFrom(
  lines: string[],
  startIdx: number,
  matcher: RegExp
): number | null {
  for (let i = Math.max(0, startIdx); i < lines.length; i++) {
    if (matcher.test(lines[i])) {
      return i + 1;
    }
  }
  return null;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFriendlyParseError(rawText: string, err: unknown): { message: string; line: number | null } {
  const yamlErr = err as { reason?: string; mark?: { line?: number }; message?: string };
  const rawLine = typeof yamlErr?.mark?.line === "number" ? yamlErr.mark.line + 1 : null;
  const reason = yamlErr?.reason || yamlErr?.message || "Invalid YAML syntax";

  if (/bad indentation/i.test(reason)) {
    return {
      line: rawLine,
      message: rawLine
        ? `Line ${rawLine}: unexpected indentation. Check spacing alignment with surrounding keys.`
        : `Unexpected indentation: ${reason}`,
    };
  }
  if (/sequence entry|expected a list|can not read a block mapping entry/i.test(reason)) {
    const prevText = rawLine && rawLine > 1 ? rawText.split(/\r?\n/)[rawLine - 2] || "" : "";
    const hint = /steps\s*:/.test(prevText)
      ? " Check the indentation under steps:."
      : " Ensure list items begin with '- '.";
    return {
      line: rawLine,
      message: rawLine
        ? `Line ${rawLine}: expected a valid mapping or list item.${hint}`
        : `Malformed YAML structure: ${reason}`,
    };
  }

  return {
    line: rawLine,
    message: rawLine ? `Line ${rawLine}: ${reason}.` : reason,
  };
}

export function parseWorkflowYaml(
  rawText: string,
  file = ".github/workflows/ci.yml"
): ParseWorkflowOutput {
  const lines = rawText.split(/\r?\n/);

  if (!rawText.trim()) {
    return {
      ok: true,
      workflow: {
        file,
        name: null,
        on: null,
        onLine: null,
        onTriggerLines: {},
        permissions: undefined,
        permissionsLine: null,
        jobs: [],
        lines,
      },
      error: null,
      errorLine: null,
    };
  }

  let doc: unknown;
  try {
    doc = yaml.load(rawText, { schema: yaml.CORE_SCHEMA });
  } catch (err) {
    const friendly = findFriendlyParseError(rawText, err);
    return { ok: false, workflow: null, error: friendly.message, errorLine: friendly.line };
  }

  if (doc === null || doc === undefined) {
    return {
      ok: true,
      workflow: {
        file,
        name: null,
        on: null,
        onLine: null,
        onTriggerLines: {},
        permissions: undefined,
        permissionsLine: null,
        jobs: [],
        lines,
      },
      error: null,
      errorLine: null,
    };
  }

  if (typeof doc !== "object" || Array.isArray(doc)) {
    return {
      ok: false,
      workflow: null,
      error: "Line 1: root workflow document must be a YAML mapping.",
      errorLine: 1,
    };
  }

  const root = doc as Record<string, unknown>;
  const onVal = root.on ?? root["true"]; // CORE_SCHEMA keeps "on" as string, fallback for YAML 1.1 quirk
  const onLine = findLineFrom(lines, 0, /^\s*on\s*:/);

  const onTriggerLines: Record<string, number> = {};
  if (onVal && typeof onVal === "object" && !Array.isArray(onVal)) {
    for (const trig of Object.keys(onVal as Record<string, unknown>)) {
      const found = findLineFrom(
        lines,
        onLine ? onLine - 1 : 0,
        new RegExp(`^\\s*${escapeRegex(trig)}\\s*:`)
      );
      if (found) onTriggerLines[trig.toLowerCase()] = found;
    }
  } else if (typeof onVal === "string" && onLine) {
    onTriggerLines[onVal.toLowerCase()] = onLine;
  } else if (Array.isArray(onVal) && onLine) {
    for (const trig of onVal) {
      if (typeof trig === "string") {
        onTriggerLines[trig.toLowerCase()] = onLine;
      }
    }
  }

  const permissionsLine =
    "permissions" in root ? findLineFrom(lines, 0, /^\s*permissions\s*:/) : null;

  const jobsRaw = root.jobs;
  if (jobsRaw !== undefined && (typeof jobsRaw !== "object" || jobsRaw === null || Array.isArray(jobsRaw))) {
    const jobsKeyLine = findLineFrom(lines, 0, /^\s*jobs\s*:/) || 1;
    return {
      ok: false,
      workflow: null,
      error: `Line ${jobsKeyLine}: 'jobs' must be a mapping of job definitions.`,
      errorLine: jobsKeyLine,
    };
  }

  const jobs: ParsedJob[] = [];
  if (jobsRaw && typeof jobsRaw === "object") {
    let searchCursor = (findLineFrom(lines, 0, /^\s*jobs\s*:/) || 1) - 1;
    for (const [jobId, rawJob] of Object.entries(jobsRaw as Record<string, unknown>)) {
      if (!rawJob || typeof rawJob !== "object" || Array.isArray(rawJob)) continue;
      const jobObj = rawJob as Record<string, unknown>;
      const jobLine =
        findLineFrom(lines, searchCursor, new RegExp(`^\\s*${escapeRegex(jobId)}\\s*:`)) ||
        searchCursor + 1;
      searchCursor = jobLine;

      if (jobObj.steps !== undefined && !Array.isArray(jobObj.steps)) {
        const stepsKeyLine = findLineFrom(lines, jobLine - 1, /^\s*steps\s*:/);
        const badLine = stepsKeyLine ? stepsKeyLine + 1 : jobLine;
        return {
          ok: false,
          workflow: null,
          error: `Line ${badLine}: expected a list item. Check the indentation under steps:.`,
          errorLine: badLine,
        };
      }
      const rawSteps = Array.isArray(jobObj.steps) ? jobObj.steps : [];
      const steps: ParsedStep[] = [];
      let stepCursor = jobLine - 1;

      for (const s of rawSteps) {
        if (!s || typeof s !== "object" || Array.isArray(s)) continue;
        const stepObj = s as Record<string, unknown>;
        const stepUses = typeof stepObj.uses === "string" ? stepObj.uses : null;
        const stepRun = typeof stepObj.run === "string" ? stepObj.run : null;
        const stepName = typeof stepObj.name === "string" ? stepObj.name : null;

        let stepLine: number | null = null;
        if (stepName) {
          stepLine = findLineFrom(
            lines,
            stepCursor,
            new RegExp(`^\\s*-\\s*name\\s*:\\s*.*${escapeRegex(stepName.slice(0, 24))}`)
          );
        }
        if (!stepLine && stepUses) {
          stepLine = findLineFrom(
            lines,
            stepCursor,
            new RegExp(`^\\s*-?\\s*uses\\s*:\\s*.*${escapeRegex(stepUses.slice(0, 24))}`)
          );
        }
        if (!stepLine && stepRun) {
          const firstLine = stepRun.split(/\r?\n/).find((l) => l.trim())?.trim() || "";
          stepLine = findLineFrom(
            lines,
            stepCursor,
            firstLine
              ? new RegExp(`run\\s*:.*${escapeRegex(firstLine.slice(0, 20))}`)
              : /^\s*-?\s*run\s*:/
          );
        }
        if (!stepLine) {
          stepLine = findLineFrom(lines, stepCursor, /^\s*-\s+/) || stepCursor + 1;
        }
        stepCursor = stepLine;

        const withInputs =
          stepObj.with && typeof stepObj.with === "object" && !Array.isArray(stepObj.with)
            ? (stepObj.with as Record<string, unknown>)
            : {};

        const usesLine = stepUses
          ? findLineFrom(
              lines,
              stepLine - 1,
              new RegExp(`uses\\s*:\\s*.*${escapeRegex(stepUses.slice(0, 28))}`)
            )
          : null;

        const runLine = stepRun
          ? findLineFrom(
              lines,
              stepLine - 1,
              /^\s*-?\s*run\s*:/
            )
          : null;

        const refVal = typeof withInputs.ref === "string" ? withInputs.ref : null;
        const refLine = refVal
          ? findLineFrom(
              lines,
              stepLine - 1,
              /^\s*ref\s*:/
            )
          : null;

        steps.push({
          name: stepName,
          uses: stepUses,
          run: stepRun,
          withInputs,
          env:
            stepObj.env && typeof stepObj.env === "object" && !Array.isArray(stepObj.env)
              ? (stepObj.env as Record<string, unknown>)
              : {},
          line: stepLine,
          usesLine,
          runLine,
          refLine,
        });
      }

      jobs.push({
        id: jobId,
        name: typeof jobObj.name === "string" ? jobObj.name : null,
        permissions: jobObj.permissions,
        secrets: jobObj.secrets,
        line: jobLine,
        steps,
      });
    }
  }

  return {
    ok: true,
    workflow: {
      file,
      name: typeof root.name === "string" ? root.name : null,
      on: onVal,
      onLine,
      onTriggerLines,
      permissions: root.permissions,
      permissionsLine,
      jobs,
      lines,
    },
    error: null,
    errorLine: null,
  };
}
