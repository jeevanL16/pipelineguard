import React, { useActionState, useRef, useState } from "react";
import { z } from "zod";
import { Badge, Button, Field, Panel, useToast } from "../../ui";
import {
  API_BASE_URL,
  ApiError,
  clearAccessToken,
  getAccessToken,
  getBackendHealth,
  login,
  testBackendConnection,
} from "../../services/api";
import { ThemeSwitch } from "../shell/ThemeSwitch";

interface ConnectionCheckRow {
  request: string;
  status: string;
  responseMs: string;
  requestId: string;
  ok: boolean;
}

const LoginSchema = z.object({
  username: z.string().trim().min(1, "Enter your dashboard username."),
  password: z.string().min(1, "Enter your dashboard password."),
});

export function SettingsPage() {
  const { pushToast } = useToast();
  const [testing, setTesting] = useState(false);
  const [rows, setRows] = useState<ConnectionCheckRow[]>([]);
  const [hasToken, setHasToken] = useState(() => Boolean(getAccessToken()));

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const userInputRef = useRef<HTMLInputElement | null>(null);
  const passInputRef = useRef<HTMLInputElement | null>(null);

  const runConnectionTest = async () => {
    setTesting(true);
    const checks: ConnectionCheckRow[] = [];

    try {
      const h = await getBackendHealth();
      checks.push({
        request: `GET ${API_BASE_URL}/api/health`,
        status: `${h.status} OK (${h.data.status})`,
        responseMs: `${h.durationMs} ms`,
        requestId: h.requestId,
        ok: true,
      });
    } catch (err) {
      checks.push({
        request: `GET ${API_BASE_URL}/api/health`,
        status: err instanceof ApiError ? `${err.status} Error` : "Network error",
        responseMs: "—",
        requestId: err instanceof ApiError ? err.requestId : "—",
        ok: false,
      });
    }

    try {
      const t = await testBackendConnection();
      checks.push({
        request: `GET ${API_BASE_URL}/api/test`,
        status: `${t.status} OK`,
        responseMs: `${t.durationMs} ms`,
        requestId: t.requestId,
        ok: true,
      });
    } catch (err) {
      checks.push({
        request: `GET ${API_BASE_URL}/api/test`,
        status: err instanceof ApiError ? `${err.status} Error` : "Network error",
        responseMs: "—",
        requestId: err instanceof ApiError ? err.requestId : "—",
        ok: false,
      });
    }

    setRows(checks);
    setTesting(false);
  };

  const [, authFormAction, authPending] = useActionState(async () => {
    const check = LoginSchema.safeParse({ username, password });
    if (!check.success) {
      const nextErrs: { username?: string; password?: string } = {};
      for (const issue of check.error.issues) {
        const key = issue.path[0];
        if (key === "username" && !nextErrs.username) nextErrs.username = issue.message;
        if (key === "password" && !nextErrs.password) nextErrs.password = issue.message;
      }
      setFieldErrors(nextErrs);
      setAuthError(check.error.issues[0]?.message || "Enter valid credentials.");
      requestAnimationFrame(() => {
        if (nextErrs.username) userInputRef.current?.focus();
        else if (nextErrs.password) passInputRef.current?.focus();
      });
      return null;
    }
    setFieldErrors({});
    setAuthError(null);
    try {
      await login(check.data.username, check.data.password);
      setHasToken(true);
      setPassword("");
      pushToast({ message: "Signed in with JWT token.", tone: "pass" });
      return null;
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed.");
      return null;
    }
  }, null);

  return (
    <div className="max-w-[820px] space-y-6">
      {/* Backend Connection Diagnostics (plain rows per DESIGN.md) */}
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="pg-headline-sm text-[var(--pg-text)] m-0">
              Backend connection diagnostics
            </h2>
            <p className="pg-body-sm text-[var(--pg-text-muted)] m-0 mt-1">
              Target endpoint <span className="pg-code-sm text-[var(--pg-text)]">{API_BASE_URL}</span> (SQLite WAL store).
            </p>
          </div>
          <Button
            variant="secondary"
            size="compact"
            pending={testing}
            pendingText="Testing…"
            onClick={runConnectionTest}
          >
            Run connection test
          </Button>
        </div>

        {rows.length > 0 && (
          <div className="overflow-x-auto border border-[var(--pg-line)] rounded-[8px]">
            <table className="w-full border-collapse text-left">
              <thead className="border-b border-[var(--pg-line)] bg-[var(--pg-canvas)]">
                <tr>
                  <th className="py-2 px-3 pg-label-sm text-[var(--pg-text-muted)]">Request</th>
                  <th className="py-2 px-3 pg-label-sm text-[var(--pg-text-muted)]">Status</th>
                  <th className="py-2 px-3 pg-label-sm text-[var(--pg-text-muted)]">Response time</th>
                  <th className="py-2 px-3 pg-label-sm text-[var(--pg-text-muted)]">Request ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--pg-line)]">
                {rows.map((r) => (
                  <tr key={r.request}>
                    <td className="py-2 px-3 pg-code-sm text-[var(--pg-text)]">{r.request}</td>
                    <td className="py-2 px-3">
                      <Badge severity={r.ok ? "PASS" : "CRITICAL"} label={r.status} />
                    </td>
                    <td className="py-2 px-3 pg-data-md text-[var(--pg-text)]">{r.responseMs}</td>
                    <td className="py-2 px-3 pg-code-sm text-[var(--pg-text-muted)]">{r.requestId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Theme & Interface */}
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="pg-headline-sm text-[var(--pg-text)] m-0">Appearance</h2>
            <p className="pg-body-sm text-[var(--pg-text-muted)] m-0 mt-1">
              Dark is the reference dashboard theme; System follows OS preference.
            </p>
          </div>
          <ThemeSwitch />
        </div>
      </Panel>

      {/* Optional JWT Authentication (when accessing non-loopback or explicit session) */}
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="pg-headline-sm text-[var(--pg-text)] m-0">Dashboard authentication</h2>
            <p className="pg-body-sm text-[var(--pg-text-muted)] m-0 mt-1">
              Localhost loopback auto-authenticates reads and writes; sign in below to store an explicit Bearer JWT token.
            </p>
          </div>
          <Badge
            severity={hasToken ? "PASS" : "INFO"}
            label={hasToken ? "JWT active" : "Loopback session"}
          />
        </div>

        {hasToken ? (
          <div>
            <Button
              variant="secondary"
              size="compact"
              onClick={() => {
                clearAccessToken();
                setHasToken(false);
                pushToast({ message: "Cleared stored JWT session.", tone: "neutral" });
              }}
            >
              Sign out
            </Button>
          </div>
        ) : (
          <form action={authFormAction} noValidate className="space-y-4 max-w-[380px]">
            {authError && (
              <div
                role="alert"
                className="p-3 rounded-[8px] border border-[var(--pg-critical)] bg-[var(--pg-critical-tint)] pg-body-sm text-[var(--pg-critical)]"
              >
                {authError}
              </div>
            )}

            <Field
              ref={userInputRef}
              id="settings-auth-user"
              label="Username"
              autoComplete="username"
              disabled={authPending}
              value={username}
              error={fieldErrors.username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (fieldErrors.username && e.target.value.trim()) {
                  setFieldErrors((p) => ({ ...p, username: undefined }));
                }
              }}
            />

            <Field
              ref={passInputRef}
              id="settings-auth-pass"
              label="Password"
              type="password"
              autoComplete="current-password"
              disabled={authPending}
              value={password}
              error={fieldErrors.password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password && e.target.value.length > 0) {
                  setFieldErrors((p) => ({ ...p, password: undefined }));
                }
              }}
            />

            <Button type="submit" variant="primary" pending={authPending} pendingText="Signing in…">
              Sign in
            </Button>
          </form>
        )}
      </Panel>
    </div>
  );
}
