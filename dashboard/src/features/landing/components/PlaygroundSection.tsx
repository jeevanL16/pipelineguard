import React, { useEffect, useRef, useState } from "react";
import { analyzeWorkflowText } from "../../../rules/analyzer";
import { PLAYGROUND_SAMPLES } from "../../../rules/sampleWorkflows";
import type { AnalysisResult } from "../../../rules/schemas";
import { Badge, Button, Panel } from "../../../ui";
import { ConnectRepositoryForm } from "../../pipelines/components/ConnectRepositoryForm";
import { useToast } from "../../../ui";

export function PlaygroundSection() {
  const { pushToast } = useToast();
  const [yamlText, setYamlText] = useState(PLAYGROUND_SAMPLES[0].yaml);
  const [result, setResult] = useState<AnalysisResult>(() =>
    analyzeWorkflowText(PLAYGROUND_SAMPLES[0].yaml, "playground.yml")
  );
  const [showConnect, setShowConnect] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const jobIdRef = useRef(0);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // 300ms debounce; offloads workflows >200 lines to Web Worker so typing stays responsive
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!yamlText.trim()) {
        setResult({
          findings: [],
          parseError: null,
          parseErrorLine: null,
          risk: { score: 0, grade: "A" },
          lineCount: 0,
          suppressedCount: 0,
        });
        return;
      }

      const lines = yamlText.split(/\r?\n/).length;
      if (lines > 200 && typeof Worker !== "undefined") {
        if (!workerRef.current) {
          workerRef.current = new Worker(
            new URL("../../../rules/scanner.worker.ts", import.meta.url),
            { type: "module" }
          );
        }
        const id = ++jobIdRef.current;
        const worker = workerRef.current;
        worker.onmessage = (e: MessageEvent<{ id: number; result: AnalysisResult }>) => {
          if (e.data.id === jobIdRef.current) {
            setResult(e.data.result);
          }
        };
        worker.postMessage({ id, yaml: yamlText, file: "playground.yml" });
      } else {
        setResult(analyzeWorkflowText(yamlText, "playground.yml"));
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [yamlText]);

  const lineCount = Math.max(1, yamlText.split(/\r?\n/).length);

  const jumpToLine = (lineNum: number) => {
    const el = textareaRef.current;
    if (!el || lineNum < 1) return;
    const allLines = yamlText.split(/\r?\n/);
    let startIdx = 0;
    for (let i = 0; i < Math.min(lineNum - 1, allLines.length); i++) {
      startIdx += allLines[i].length + 1;
    }
    const endIdx = startIdx + (allLines[lineNum - 1]?.length ?? 0);
    el.focus();
    el.setSelectionRange(startIdx, endIdx);
  };

  return (
    <section id="playground" className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="max-w-[40rem] space-y-2">
          <h2 className="pg-headline-lg text-[var(--pg-text)] m-0">
            Test a workflow before pushing
          </h2>
          <p className="pg-body-md text-[var(--pg-text-muted)] m-0">
            Paste any GitHub Actions YAML. Inspection runs locally in your browser using the shared PipelineGuard rule engine; nothing is uploaded.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PLAYGROUND_SAMPLES.map((s) => (
            <Button
              key={s.id}
              variant="secondary"
              size="compact"
              onClick={() => setYamlText(s.yaml)}
            >
              {s.label}
            </Button>
          ))}
          {yamlText.length > 0 && (
            <Button variant="ghost" size="compact" onClick={() => setYamlText("")}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Line-numbered YAML Editor */}
        <div className="lg:col-span-7 rounded-[14px] border border-[var(--pg-line-strong)] bg-[var(--pg-canvas)] overflow-hidden">
          <div className="px-4 py-2 border-b border-[var(--pg-line)] bg-[var(--pg-panel)] flex items-center justify-between">
            <label
              htmlFor="playground-yaml-input"
              className="pg-code-sm text-[var(--pg-text-muted)]"
            >
              .github/workflows/playground.yml
            </label>
            <span className="pg-code-sm text-[var(--pg-text-muted)] pg-tnum">
              {lineCount} lines
            </span>
          </div>

          <div className="flex h-[320px] relative">
            <div
              ref={gutterRef}
              aria-hidden="true"
              className="w-11 py-3 px-2 text-right select-none overflow-hidden pg-code-md text-[var(--pg-text-muted)] border-r border-[var(--pg-line)] bg-[var(--pg-panel)]"
            >
              {Array.from({ length: lineCount }, (_, idx) => (
                <div key={idx + 1}>{idx + 1}</div>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              id="playground-yaml-input"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              value={yamlText}
              onChange={(e) => setYamlText(e.target.value)}
              onScroll={(e) => {
                if (gutterRef.current) {
                  gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                }
              }}
              placeholder="Paste a GitHub Actions workflow to see what PipelineGuard flags."
              className="flex-1 h-full p-3 bg-transparent text-[var(--pg-text)] pg-code-md resize-none outline-none border-none overflow-auto"
            />
          </div>
        </div>

        {/* Results Panel */}
        <Panel className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--pg-line)]">
            <h3 className="pg-headline-sm text-[var(--pg-text)] m-0">Findings</h3>
            <span className="pg-data-md text-[var(--pg-text-muted)]">
              {!yamlText.trim()
                ? "Ready"
                : result.parseError
                ? "Syntax error"
                : `Risk ${result.risk.score}/100 · Grade ${result.risk.grade}`}
            </span>
          </div>

          {!yamlText.trim() ? (
            <p className="pg-body-sm text-[var(--pg-text-muted)] py-6 m-0">
              Paste a GitHub Actions workflow to see what PipelineGuard flags.
            </p>
          ) : result.parseError ? (
            <div
              role="alert"
              className="rounded-[8px] border border-[var(--pg-critical)] bg-[var(--pg-critical-tint)] p-3.5 space-y-1"
            >
              <div className="pg-label-md text-[var(--pg-critical)]">YAML parse error</div>
              <p className="pg-body-sm text-[var(--pg-text)] m-0">{result.parseError}</p>
            </div>
          ) : result.findings.length === 0 ? (
            <div className="py-4 space-y-2">
              <Badge severity="PASS" label="No workflow findings" />
              <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">
                All checks passed on {lineCount} lines of YAML.
              </p>
            </div>
          ) : (
            <ul className="m-0 p-0 list-none space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {result.findings.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => f.line && jumpToLine(f.line)}
                    className="w-full text-left p-3 rounded-[8px] border border-[var(--pg-line)] bg-[var(--pg-canvas)] hover:bg-[var(--pg-raised)] hover:border-[var(--pg-line-strong)] transition-colors space-y-1 pg-surface-enter cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge severity={f.severity} />
                        <span className="pg-code-sm text-[var(--pg-text)] font-medium">
                          {f.ruleId}
                        </span>
                      </div>
                      {f.line && (
                        <span className="pg-code-sm text-[var(--pg-text-muted)]">Line {f.line}</span>
                      )}
                    </div>
                    <div className="pg-body-sm text-[var(--pg-text)]">{f.message}</div>
                    <div className="pg-body-sm text-[var(--pg-text-muted)]">
                      Fix: {f.fixSummary}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-3 border-t border-[var(--pg-line)] space-y-3">
            {!showConnect ? (
              <div className="flex items-center justify-between gap-3">
                <span className="pg-body-sm text-[var(--pg-text-muted)]">
                  Want automatic checks on push?
                </span>
                <Button variant="secondary" size="compact" onClick={() => setShowConnect(true)}>
                  Connect repository
                </Button>
              </div>
            ) : (
              <ConnectRepositoryForm
                compactIntro
                onCancel={() => setShowConnect(false)}
                onSuccess={() => {
                  setShowConnect(false);
                  pushToast({
                    message: "Repository connected. First scan queued.",
                    tone: "pass",
                  });
                }}
              />
            )}
          </div>
        </Panel>
      </div>
    </section>
  );
}
