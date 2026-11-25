import React, { useActionState, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Select } from "../../../ui";
import { SeverityShapeIcon } from "../../../ui/Badge";
import {
  createPipeline,
  getPipelines,
  resolveRepositoryUrl,
  type RepositoryResolution,
} from "../../../services/api";
import { ConnectRepositorySchema } from "../schemas";

type FieldKey = "repositoryUrl" | "pipelineId" | "branch";

interface FormActionResult {
  submitError: string | null;
  fieldErrors: Partial<Record<FieldKey, string>>;
  networkFailure?: boolean;
}

export function ConnectRepositoryForm({
  autoFocus = false,
  onCancel,
  onSuccess,
  onDirtyChange,
  compactIntro = false,
}: {
  autoFocus?: boolean;
  onCancel?: () => void;
  onSuccess?: (createdPipelineId: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  compactIntro?: boolean;
}) {
  const [existingIds, setExistingIds] = useState<string[]>([]);

  useEffect(() => {
    getPipelines()
      .then((list) => setExistingIds(list.map((p) => p.pipeline_id.toLowerCase())))
      .catch(() => {});
  }, []);

  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [branch, setBranch] = useState("main");

  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState<RepositoryResolution | null>(null);
  const [revealedFields, setRevealedFields] = useState(false);

  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [everHadError, setEverHadError] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [idConfirmed, setIdConfirmed] = useState<string | null>(null);
  const [summaryErrors, setSummaryErrors] = useState<Array<{ key: FieldKey; message: string }>>([]);

  const urlRef = useRef<HTMLInputElement | null>(null);
  const idRef = useRef<HTMLInputElement | null>(null);
  const branchRef = useRef<HTMLInputElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onDirtyChange?.(
      Boolean(repositoryUrl.trim() || (revealedFields && pipelineId.trim()))
    );
  }, [repositoryUrl, pipelineId, revealedFields, onDirtyChange]);

  useEffect(() => {
    if (autoFocus) {
      urlRef.current?.focus();
    }
  }, [autoFocus]);

  const validateSingleField = (
    key: FieldKey,
    val: string
  ): string | null => {
    if (key === "repositoryUrl") {
      const r = ConnectRepositorySchema.shape.repositoryUrl.safeParse(val);
      return r.success ? null : r.error.issues[0]?.message || "Invalid repository URL.";
    }
    if (key === "pipelineId") {
      const r = ConnectRepositorySchema.shape.pipelineId.safeParse(val);
      if (!r.success) {
        return r.error.issues[0]?.message || "Invalid pipeline ID.";
      }
      const trimmed = val.trim();
      const duplicate = existingIds.includes(trimmed.toLowerCase());
      if (duplicate) {
        return `Pipeline ID '${trimmed}' already exists. Choose another identifier.`;
      }
      return null;
    }
    const r = ConnectRepositorySchema.shape.branch.safeParse(val);
    return r.success ? null : r.error.issues[0]?.message || "Invalid branch name.";
  };

  const handleFieldBlur = async (key: FieldKey, currentValue: string) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    const err = validateSingleField(key, currentValue);
    setFieldErrors((prev) => ({ ...prev, [key]: err ?? undefined }));
    if (err) {
      setEverHadError((prev) => ({ ...prev, [key]: true }));
      setIdConfirmed(null);
      return;
    }
    if (key === "pipelineId" && everHadError.pipelineId) {
      setIdConfirmed("Available");
    }
    if (key === "repositoryUrl" && currentValue.trim() && !resolution) {
      await runResolve(currentValue);
    }
  };

  const handleFieldChange = (key: FieldKey, nextVal: string) => {
    if (key === "repositoryUrl") {
      setRepositoryUrl(nextVal);
      if (resolution) setResolution(null);
    }
    if (key === "pipelineId") setPipelineId(nextVal);
    if (key === "branch") setBranch(nextVal);

    if (touched[key] && fieldErrors[key]) {
      const nextErr = validateSingleField(key, nextVal);
      setFieldErrors((prev) => ({ ...prev, [key]: nextErr ?? undefined }));
      if (!nextErr && key === "pipelineId") {
        setIdConfirmed("Available");
      }
    }
  };

  const runResolve = async (urlToCheck: string) => {
    const urlErr = validateSingleField("repositoryUrl", urlToCheck);
    if (urlErr) {
      setFieldErrors((prev) => ({ ...prev, repositoryUrl: urlErr }));
      setEverHadError((prev) => ({ ...prev, repositoryUrl: true }));
      return null;
    }

    setResolving(true);
    try {
      const res = await resolveRepositoryUrl(urlToCheck);
      setResolution(res);
      setRevealedFields(true);
      setPipelineId((prev) => prev || res.suggestedId);
      setBranch((prev) => (prev === "main" && res.defaultBranch ? res.defaultBranch : prev));
      return res;
    } finally {
      setResolving(false);
    }
  };

  const [actionState, formAction, isPending] = useActionState<FormActionResult, FormData>(
    async () => {
      // Progressive step 1: if URL entered and secondary fields haven't resolved yet, resolve first
      if (!revealedFields) {
        const urlErr = validateSingleField("repositoryUrl", repositoryUrl);
        if (urlErr) {
          setTouched((p) => ({ ...p, repositoryUrl: true }));
          setEverHadError((p) => ({ ...p, repositoryUrl: true }));
          setFieldErrors({ repositoryUrl: urlErr });
          setSummaryErrors([]);
          requestAnimationFrame(() => urlRef.current?.focus());
          return { submitError: null, fieldErrors: { repositoryUrl: urlErr } };
        }
        await runResolve(repositoryUrl);
        requestAnimationFrame(() => idRef.current?.focus());
        return { submitError: null, fieldErrors: {} };
      }

      // Progressive step 2: validate all fields with shared Zod schema + uniqueness
      const errs: Partial<Record<FieldKey, string>> = {};
      const errUrl = validateSingleField("repositoryUrl", repositoryUrl);
      const errId = validateSingleField("pipelineId", pipelineId);
      const errBranch = validateSingleField("branch", branch);
      if (errUrl) errs.repositoryUrl = errUrl;
      if (errId) errs.pipelineId = errId;
      if (errBranch) errs.branch = errBranch;

      const entries = (Object.entries(errs) as Array<[FieldKey, string]>).map(
        ([key, message]) => ({ key, message })
      );

      if (entries.length > 0) {
        setTouched({ repositoryUrl: true, pipelineId: true, branch: true });
        setFieldErrors(errs);
        if (errUrl) setEverHadError((p) => ({ ...p, repositoryUrl: true }));
        if (errId) setEverHadError((p) => ({ ...p, pipelineId: true }));
        if (errBranch) setEverHadError((p) => ({ ...p, branch: true }));

        if (entries.length === 1) {
          setSummaryErrors([]);
          const target = entries[0].key;
          requestAnimationFrame(() => {
            if (target === "repositoryUrl") urlRef.current?.focus();
            else if (target === "pipelineId") idRef.current?.focus();
            else branchRef.current?.focus();
          });
        } else {
          setSummaryErrors(entries);
          requestAnimationFrame(() => summaryRef.current?.focus());
        }
        return { submitError: null, fieldErrors: errs };
      }

      setSummaryErrors([]);
      setFieldErrors({});

      try {
        const cleanId = pipelineId.trim();
        await createPipeline({
          pipeline_id: cleanId,
          name: cleanId,
          repository: repositoryUrl.trim(),
          branch: branch.trim() || "main",
          status: "ACTIVE",
        });
        setExistingIds((prev) => [...prev, cleanId.toLowerCase()]);
        onDirtyChange?.(false);
        onSuccess?.(cleanId);
        setRepositoryUrl("");
        setPipelineId("");
        setBranch("main");
        setResolution(null);
        setRevealedFields(false);
        setTouched({});
        setEverHadError({});
        return { submitError: null, fieldErrors: {} };
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Could not reach the backend API. Check that FastAPI is running and try again.";
        return {
          submitError: msg,
          fieldErrors: {},
          networkFailure: true,
        };
      }
    },
    { submitError: null, fieldErrors: {} }
  );

  const focusField = (key: FieldKey) => {
    if (key === "repositoryUrl") urlRef.current?.focus();
    else if (key === "pipelineId") idRef.current?.focus();
    else branchRef.current?.focus();
  };

  return (
    <form action={formAction} noValidate className="space-y-4">
      {!compactIntro && (
        <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">
          Enter a repository URL first. PipelineGuard checks workflow configuration before saving.
        </p>
      )}

      {/* Multi-error top summary (shown only when 2+ fields have validation errors) */}
      {summaryErrors.length >= 2 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-[8px] border border-[var(--pg-critical)] bg-[var(--pg-critical-tint)] p-3.5 space-y-1.5 outline-none"
        >
          <div className="pg-label-md text-[var(--pg-critical)]">
            Fix {summaryErrors.length} fields before connecting
          </div>
          <ul className="m-0 pl-4 space-y-1 pg-body-sm text-[var(--pg-text)]">
            {summaryErrors.map((e) => (
              <li key={e.key}>
                <button
                  type="button"
                  onClick={() => focusField(e.key)}
                  className="underline text-left text-[var(--pg-text)] hover:text-[var(--pg-primary)] bg-transparent cursor-pointer"
                >
                  {e.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Server/network failure alert with Try again */}
      {actionState.submitError && (
        <div
          role="alert"
          className="rounded-[8px] border border-[var(--pg-critical)] bg-[var(--pg-critical-tint)] p-3.5 flex items-start justify-between gap-3"
        >
          <div className="pg-body-sm text-[var(--pg-text)]">
            {actionState.submitError}
          </div>
          {actionState.networkFailure && (
            <button
              type="submit"
              className="pg-label-sm text-[var(--pg-primary)] underline shrink-0 bg-transparent cursor-pointer"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Step 1: Repository URL */}
      <Field
        ref={urlRef}
        id="connect-repo-url"
        name="repositoryUrl"
        label="Repository URL"
        type="url"
        inputMode="url"
        autoCapitalize="off"
        autoComplete="url"
        spellCheck={false}
        disabled={isPending}
        placeholder="https://github.com/org/payments-api"
        value={repositoryUrl}
        error={fieldErrors.repositoryUrl}
        onChange={(e) => handleFieldChange("repositoryUrl", e.target.value)}
        onBlur={() => handleFieldBlur("repositoryUrl", repositoryUrl)}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (pasted) {
            setTimeout(() => runResolve(pasted), 20);
          }
        }}
      />

      {/* Resolving state */}
      {resolving && (
        <div className="flex items-center gap-2 pg-body-sm text-[var(--pg-text-muted)]">
          <Loader2 size={14} strokeWidth={1.5} className="animate-spin text-[var(--pg-primary)]" />
          <span>Checking repository metadata…</span>
        </div>
      )}

      {/* Resolved evidence box before commitment */}
      {!resolving && resolution && (
        <div
          className={`rounded-[8px] border px-3.5 py-2.5 space-y-1.5 pg-body-sm ${
            resolution.notFoundOrEmpty
              ? "border-[var(--pg-line-strong)] bg-[var(--pg-high-tint)] text-[var(--pg-text)]"
              : "border-[var(--pg-line)] bg-[var(--pg-raised)] text-[var(--pg-text)]"
          }`}
        >
          {resolution.notFoundOrEmpty ? (
            <div>
              No workflows found in <span className="pg-code-sm">.github/workflows</span> on{" "}
              <span className="pg-code-sm">{resolution.defaultBranch}</span>. Pick another branch or add a workflow file.
            </div>
          ) : resolution.workflows.length > 0 ? (
            <>
              <div className="flex items-center gap-1.5 text-[var(--pg-pass)]">
                <SeverityShapeIcon shape="check" />
                <span>
                  Found {resolution.workflows.length} workflow
                  {resolution.workflows.length === 1 ? "" : "s"} in{" "}
                  <span className="pg-code-sm">.github/workflows</span> on{" "}
                  <span className="pg-code-sm">{resolution.defaultBranch}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {resolution.workflows.map((wf) => (
                  <span
                    key={wf}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[var(--pg-panel)] border border-[var(--pg-line)] pg-code-sm text-[var(--pg-text)]"
                  >
                    <SeverityShapeIcon shape="check" className="text-[var(--pg-pass)]" />
                    {wf}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-[var(--pg-pass)]">
              <SeverityShapeIcon shape="check" />
              <span>
                Parsed{" "}
                <span className="pg-code-sm">
                  {resolution.owner}/{resolution.repo}
                </span>
                . Confirm pipeline ID and branch below.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Progressive disclosure of Pipeline ID & Branch */}
      {revealedFields && (
        <div className="space-y-4 pt-1 pg-surface-enter">
          <Field
            ref={idRef}
            id="connect-pipeline-id"
            name="pipelineId"
            label="Pipeline ID"
            hint="Lowercase letters, digits, and hyphens, 3 to 48 characters."
            placeholder="pipe-payments-api"
            autoCapitalize="off"
            spellCheck={false}
            disabled={isPending}
            value={pipelineId}
            error={fieldErrors.pipelineId}
            confirmedMessage={idConfirmed}
            onChange={(e) => handleFieldChange("pipelineId", e.target.value)}
            onBlur={() => handleFieldBlur("pipelineId", pipelineId)}
          />

          <div className="space-y-1.5">
            {resolution && resolution.branches.length > 1 ? (
              <>
                <label
                  htmlFor="connect-branch-select"
                  className="block pg-label-md text-[var(--pg-text)]"
                >
                  Branch
                </label>
                <Select
                  id="connect-branch-select"
                  value={branch}
                  disabled={isPending}
                  onValueChange={(val) => handleFieldChange("branch", val)}
                  options={resolution.branches.map((b) => ({ value: b, label: b }))}
                  className="w-full"
                />
              </>
            ) : (
              <Field
                ref={branchRef}
                id="connect-branch"
                name="branch"
                label="Branch"
                placeholder="main"
                autoCapitalize="off"
                spellCheck={false}
                disabled={isPending}
                value={branch}
                error={fieldErrors.branch}
                onChange={(e) => handleFieldChange("branch", e.target.value)}
                onBlur={() => handleFieldBlur("branch", branch)}
              />
            )}
          </div>
        </div>
      )}

      <div className="pt-2 flex items-center justify-end gap-3">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          pending={isPending}
          pendingText="Connecting…"
        >
          Connect repository
        </Button>
      </div>
    </form>
  );
}
