import React, { Suspense, lazy, useMemo, useState } from "react";
import { z } from "zod";
import { Badge, Button, Field, Panel, Seal } from "../../ui";
import { useScene3DMode } from "../../three/core/useScene3DMode";
import { useFindingsQuery } from "../findings/queries";

const LedgerArtifactScene3D = lazy(() =>
  import("../../three/scenes/LedgerChain3D").then((m) => ({
    default: m.LedgerArtifactScene3D,
  }))
);

const Sha256Schema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{64}$/, "Expected hash must be 64 hexadecimal SHA-256 characters.");

interface VerificationRecord {
  artifactName: string;
  outcome: "MATCH" | "MISMATCH" | "ERROR";
  decision: "PASS" | "BLOCK";
  expectedHash: string;
  actualHash: string | null;
  error?: string;
}

async function computeBufferSha256(buf: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ArtifactsPage() {
  const eventsQuery = useFindingsQuery();
  const artifactFindings = useMemo(() => {
    const events = eventsQuery.data ?? [];
    return events.filter(
      (e) =>
        e.source?.toLowerCase().includes("artifact") ||
        e.event_type?.toLowerCase().includes("artifact") ||
        e.event_type?.toLowerCase().includes("tamper")
    );
  }, [eventsQuery.data]);

  const [artifactName, setArtifactName] = useState("build-artifact.txt");
  const [payloadText, setPayloadText] = useState("pipelineguard-release-v2.0\n");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expectedHash, setExpectedHash] = useState("");
  const [hashError, setHashError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationRecord | null>(null);
  const [history, setHistory] = useState<Array<VerificationRecord & { checkedAt: string }>>([]);
  const sceneMode = useScene3DMode();

  const fillActualHashForDemo = async () => {
    const buf = selectedFile
      ? await selectedFile.arrayBuffer()
      : new TextEncoder().encode(payloadText).buffer;
    const hex = await computeBufferSha256(buf);
    setExpectedHash(hex);
    setHashError(null);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Sha256Schema.safeParse(expectedHash);
    if (!parsed.success) {
      setHashError(parsed.error.issues[0]?.message || "Invalid SHA-256 digest.");
      return;
    }
    setHashError(null);
    setVerifying(true);
    try {
      const normalizedExpected = expectedHash.trim().toLowerCase();
      const buf = selectedFile
        ? await selectedFile.arrayBuffer()
        : new TextEncoder().encode(payloadText).buffer;
      const actual = await computeBufferSha256(buf);
      const name = selectedFile ? selectedFile.name : artifactName || "inline-payload";

      const outcomeRecord: VerificationRecord =
        actual === normalizedExpected
          ? {
              artifactName: name,
              outcome: "MATCH",
              decision: "PASS",
              expectedHash: normalizedExpected,
              actualHash: actual,
            }
          : {
              artifactName: name,
              outcome: "MISMATCH",
              decision: "BLOCK",
              expectedHash: normalizedExpected,
              actualHash: actual,
            };
      setResult(outcomeRecord);
      setHistory((prev) => [
        { ...outcomeRecord, checkedAt: new Date().toLocaleTimeString() },
        ...prev.slice(0, 9),
      ]);
    } catch (err) {
      setResult({
        artifactName: selectedFile?.name || artifactName,
        outcome: "ERROR",
        decision: "BLOCK",
        expectedHash,
        actualHash: null,
        error: err instanceof Error ? err.message : "Unable to read artifact bytes.",
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="pg-body-sm text-[var(--pg-text-muted)] m-0 max-w-[40rem]">
        SHA-256 artifact integrity verifier computed locally via Web Crypto API using the fail-closed model from{" "}
        <span className="pg-code-sm text-[var(--pg-text)]">security/artifacts/artifact_verifier.py</span>.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <Panel className="lg:col-span-7">
          <form onSubmit={handleVerify} className="space-y-4">
            <h2 className="pg-headline-sm text-[var(--pg-text)] m-0">
              Verify artifact SHA-256 digest
            </h2>

            <div className="space-y-1.5">
              <label
                htmlFor="artifact-file-input"
                className="block pg-label-md text-[var(--pg-text)]"
              >
                Artifact file (optional, overrides text payload)
              </label>
              <input
                id="artifact-file-input"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  if (file) setArtifactName(file.name);
                }}
                className="block w-full pg-body-sm text-[var(--pg-text-muted)] file:mr-3 file:py-2 file:px-3 file:rounded-[8px] file:border file:border-[var(--pg-line-strong)] file:bg-[var(--pg-raised)] file:text-[var(--pg-text)] file:cursor-pointer"
              />
            </div>

            {!selectedFile && (
              <div className="space-y-1.5">
                <label
                  htmlFor="artifact-payload-text"
                  className="block pg-label-md text-[var(--pg-text)]"
                >
                  Or inline artifact content
                </label>
                <textarea
                  id="artifact-payload-text"
                  rows={3}
                  value={payloadText}
                  onChange={(e) => setPayloadText(e.target.value)}
                  className="w-full p-3 rounded-[8px] bg-[var(--pg-canvas)] border border-[var(--pg-line-strong)] text-[var(--pg-text)] pg-code-sm"
                />
              </div>
            )}

            <Field
              id="artifact-expected-hash"
              label="Trusted expected SHA-256 hash"
              placeholder="64 hexadecimal characters"
              value={expectedHash}
              error={hashError}
              spellCheck={false}
              autoCapitalize="off"
              onChange={(e) => {
                setExpectedHash(e.target.value);
                if (hashError && Sha256Schema.safeParse(e.target.value).success) {
                  setHashError(null);
                }
              }}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Button variant="secondary" size="compact" onClick={fillActualHashForDemo}>
                Compute hash from input
              </Button>
              <Button
                type="submit"
                variant="primary"
                pending={verifying}
                pendingText="Hashing…"
              >
                Verify digest
              </Button>
            </div>
          </form>
        </Panel>

        <Panel className="lg:col-span-5 space-y-4">
          <h2 className="pg-headline-sm text-[var(--pg-text)] m-0">Verification outcome</h2>

          {!result ? (
            <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">
              Select an artifact or enter text plus a trusted SHA-256 hash to run a fail-closed digest comparison.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="pg-code-sm text-[var(--pg-text)]">{result.artifactName}</span>
                {result.outcome === "MATCH" ? (
                  <Badge severity="PASS" label="MATCH · PASS" />
                ) : (
                  <Badge severity="CRITICAL" label={`${result.outcome} · BLOCK`} />
                )}
              </div>

              {result.outcome === "MATCH" && result.actualHash && (
                <div>
                  <Seal digest={result.actualHash} label="Verified" animate />
                </div>
              )}

              {result.actualHash && (() => {
                const matched = result.outcome === "MATCH";
                const digest = result.actualHash;
                const ledgerFallback = (
                  <div className="h-[140px] rounded-[8px] border border-[var(--pg-line)] bg-[var(--pg-canvas)] p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <span className="pg-label-sm text-[var(--pg-text-muted)]">Ledger block</span>
                      <Badge
                        severity={matched ? "PASS" : "CRITICAL"}
                        label={matched ? "Chain locked · Pass" : "Mismatch · Blocked"}
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-2 items-center">
                      {[0, 1, 2, 3].map((idx) => (
                        <div
                          key={idx}
                          className={`h-8 rounded-[4px] border flex items-center justify-center pg-code-sm text-[11px] ${
                            idx === 3
                              ? matched
                                ? "border-[var(--pg-pass)] bg-[var(--pg-pass-tint)] text-[var(--pg-pass)]"
                                : "border-[var(--pg-critical)] bg-[var(--pg-critical-tint)] text-[var(--pg-critical)]"
                              : "border-[var(--pg-line)] bg-[var(--pg-panel)] text-[var(--pg-text-muted)]"
                          }`}
                        >
                          {idx === 3 ? digest.slice(0, 6) : `blk-${idx + 1}`}
                        </div>
                      ))}
                    </div>
                    <div className="pg-code-sm text-[var(--pg-text-muted)]">
                      sha256:{digest.slice(0, 12)}
                    </div>
                  </div>
                );

                return sceneMode === "fallback" ? (
                  ledgerFallback
                ) : (
                  <Suspense fallback={ledgerFallback}>
                    <LedgerArtifactScene3D
                      digest={digest}
                      matched={matched}
                      mode={sceneMode}
                      fallback={ledgerFallback}
                    />
                  </Suspense>
                );
              })()}

              <div className="space-y-1.5 pt-2 border-t border-[var(--pg-line)] pg-body-sm">
                <div>
                  <span className="text-[var(--pg-text-muted)]">Expected: </span>
                  <span className="pg-code-sm text-[var(--pg-text)] break-all">
                    {result.expectedHash}
                  </span>
                </div>
                {result.actualHash && (
                  <div>
                    <span className="text-[var(--pg-text-muted)]">Computed: </span>
                    <span className="pg-code-sm text-[var(--pg-text)] break-all">
                      {result.actualHash}
                    </span>
                  </div>
                )}
                {result.error && (
                  <p className="text-[var(--pg-critical)] m-0">{result.error}</p>
                )}
              </div>
            </div>
          )}

          {artifactFindings.length > 0 && (
            <div className="pt-3 border-t border-[var(--pg-line)] space-y-2">
              <div className="pg-label-sm text-[var(--pg-text-muted)]">
                Recorded tamper events ({artifactFindings.length})
              </div>
              {artifactFindings.map((evt) => (
                <div
                  key={evt.event_id}
                  className="p-2.5 rounded-[8px] border border-[var(--pg-line)] bg-[var(--pg-canvas)] pg-body-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="pg-code-sm text-[var(--pg-text)]">{evt.event_id}</span>
                    <Badge severity={evt.severity} />
                  </div>
                  <p className="text-[var(--pg-text-muted)] m-0 mt-1">{evt.description}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {history.length > 0 && (
        <Panel padding="none" className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--pg-line)] flex items-center justify-between">
            <h2 className="pg-headline-sm text-[var(--pg-text)] m-0">Session verification log</h2>
            <span className="pg-data-md text-[var(--pg-text-muted)]">{history.length} checked</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="border-b border-[var(--pg-line)] bg-[var(--pg-panel)]">
                <tr>
                  <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Artifact</th>
                  <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Outcome</th>
                  <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Computed digest</th>
                  <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--pg-line)]">
                {history.map((item, idx) => (
                  <tr key={`${item.artifactName}-${idx}`} className="hover:bg-[var(--pg-raised)] transition-colors">
                    <td className="py-2.5 px-4 pg-code-sm text-[var(--pg-text)]">{item.artifactName}</td>
                    <td className="py-2.5 px-4">
                      <Badge
                        severity={item.outcome === "MATCH" ? "PASS" : "CRITICAL"}
                        label={`${item.outcome} · ${item.decision}`}
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      {item.actualHash ? (
                        item.outcome === "MATCH" ? (
                          <Seal digest={item.actualHash} label="Verified" />
                        ) : (
                          <span className="pg-code-sm text-[var(--pg-text-muted)]">
                            {item.actualHash.slice(0, 12)}
                          </span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 px-4 pg-data-md text-[var(--pg-text-muted)]">{item.checkedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
