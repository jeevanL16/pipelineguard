import { z } from "zod";

export const API_BASE_URL = "http://127.0.0.1:8000";
const TOKEN_KEY = "pipelineguard_access_token";

export const ApiPipelineSchema = z.object({
  id: z.number(),
  pipeline_id: z.string(),
  name: z.string(),
  repository: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  status: z.string(),
  created_at: z.string().nullable().optional(),
});
export type ApiPipeline = z.infer<typeof ApiPipelineSchema>;

export const ApiPipelineRunSchema = z.object({
  id: z.number(),
  run_id: z.string(),
  pipeline_id: z.number(),
  branch: z.string().nullable().optional(),
  status: z.string(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  created_at: z.string(),
});
export type ApiPipelineRun = z.infer<typeof ApiPipelineRunSchema>;

export const ApiSecurityEventSchema = z.object({
  id: z.number(),
  event_id: z.string(),
  pipeline_id: z.string().nullable().optional(),
  source: z.string(),
  event_type: z.string(),
  severity: z.string(),
  risk_score: z.number(),
  status: z.string(),
  description: z.string(),
  timestamp: z.string().nullable().optional(),
  created_at: z.string(),
});
export type ApiSecurityEvent = z.infer<typeof ApiSecurityEventSchema>;

export const ApiAuditLogSchema = z.object({
  id: z.number(),
  event_id: z.string(),
  previous_status: z.string().nullable().optional(),
  new_status: z.string(),
  actor: z.string(),
  changed_at: z.string().nullable().optional(),
});
export type ApiAuditLog = z.infer<typeof ApiAuditLogSchema>;

export class ApiError extends Error {
  status: number;
  requestId: string;

  constructor(message: string, status: number, requestId: string) {
    super(message);
    this.status = status;
    this.requestId = requestId;
  }
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export interface TimedResponse<T> {
  data: T;
  status: number;
  durationMs: number;
  requestId: string;
}

export async function apiRequestWithMeta<T>(
  path: string,
  options: RequestInit = {}
): Promise<TimedResponse<T>> {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});
  const requestId = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  headers.set("X-Request-Id", requestId);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const started = performance.now();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const durationMs = Math.round(performance.now() - started);
  const resolvedRequestId = response.headers.get("x-request-id") || requestId;

  if (response.status === 401) {
    clearAccessToken();
    window.dispatchEvent(new Event("pipelineguard:unauthorized"));
    throw new ApiError("Your session has expired. Sign in again.", 401, resolvedRequestId);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg =
      (typeof data.detail === "string" ? data.detail : data.detail?.message) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(msg, response.status, resolvedRequestId);
  }

  const data = (await response.json()) as T;
  return {
    data,
    status: response.status,
    durationMs,
    requestId: resolvedRequestId,
  };
}

export async function login(username: string, password: string) {
  const { data } = await apiRequestWithMeta<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setAccessToken(data.access_token);
  return data;
}

export async function getBackendHealth() {
  return apiRequestWithMeta<{ status: string; service: string }>("/api/health");
}

export async function testBackendConnection() {
  return apiRequestWithMeta<{ message: string; backend: string }>("/api/test");
}

export async function getPipelines(): Promise<ApiPipeline[]> {
  const { data } = await apiRequestWithMeta<ApiPipeline[]>("/api/pipelines");
  if (import.meta.env.DEV) {
    z.array(ApiPipelineSchema).parse(data);
  }
  return data;
}

export async function createPipeline(payload: {
  pipeline_id: string;
  name: string;
  repository?: string;
  branch?: string;
  status?: string;
}): Promise<ApiPipeline> {
  const { data } = await apiRequestWithMeta<ApiPipeline>("/api/pipelines", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data;
}

export async function getRuns(): Promise<ApiPipelineRun[]> {
  const { data } = await apiRequestWithMeta<ApiPipelineRun[]>("/api/runs");
  if (import.meta.env.DEV) {
    z.array(ApiPipelineRunSchema).parse(data);
  }
  return data;
}

export async function getSecurityEvents(): Promise<ApiSecurityEvent[]> {
  const { data } = await apiRequestWithMeta<ApiSecurityEvent[]>("/api/events");
  if (import.meta.env.DEV) {
    z.array(ApiSecurityEventSchema).parse(data);
  }
  return data;
}

export async function updateSecurityEventStatus(
  eventId: string,
  newStatus: string
): Promise<ApiSecurityEvent> {
  const { data } = await apiRequestWithMeta<ApiSecurityEvent>(
    `/api/events/${encodeURIComponent(eventId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    }
  );
  return data;
}

export async function getAuditLogs(): Promise<ApiAuditLog[]> {
  const { data } = await apiRequestWithMeta<ApiAuditLog[]>("/api/audit-logs");
  if (import.meta.env.DEV) {
    z.array(ApiAuditLogSchema).parse(data);
  }
  return data;
}

export interface RepositoryResolution {
  owner: string;
  repo: string;
  suggestedId: string;
  defaultBranch: string;
  branches: string[];
  workflows: string[];
  source: "backend" | "github-public" | "fallback";
  notFoundOrEmpty?: boolean;
}

export function parseGitHubOwnerRepo(rawUrl: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(rawUrl.trim());
    if (!/github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.replace(/\.git$/i, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

export function suggestPipelineId(repoName: string): string {
  const clean = repoName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const candidate = clean.startsWith("pipe-") ? clean : `pipe-${clean || "repo"}`;
  return candidate.slice(0, 48);
}

/**
 * Resolves a repository URL by trying the backend /api/repositories/resolve endpoint first.
 * Since the backend endpoint is optional per DESIGN.md, falls back cleanly to URL parsing
 * (+ optional GitHub public metadata lookup when reachable).
 */
export async function resolveRepositoryUrl(rawUrl: string): Promise<RepositoryResolution> {
  const parsed = parseGitHubOwnerRepo(rawUrl);
  const fallbackName = parsed?.repo || "repository";
  const suggestedId = suggestPipelineId(fallbackName);

  // 1. Try optional backend endpoint
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/repositories/resolve?url=${encodeURIComponent(rawUrl.trim())}`
    );
    if (res.ok) {
      const json = await res.json();
      return {
        owner: json.owner || parsed?.owner || "org",
        repo: json.repo || fallbackName,
        suggestedId: json.suggested_id || suggestedId,
        defaultBranch: json.default_branch || "main",
        branches: Array.isArray(json.branches) ? json.branches : ["main"],
        workflows: Array.isArray(json.workflows) ? json.workflows : [],
        source: "backend",
        notFoundOrEmpty: Array.isArray(json.workflows) && json.workflows.length === 0,
      };
    }
  } catch {
    // Proceed to client-side fallback
  }

  // 2. If GitHub HTTPS URL, inspect public GitHub repo metadata & .github/workflows without credentials
  if (parsed) {
    try {
      const repoRes = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`,
        { headers: { Accept: "application/vnd.github+json" } }
      );
      if (repoRes.ok) {
        const repoJson = (await repoRes.json()) as { default_branch?: string };
        const defaultBranch = repoJson.default_branch || "main";
        const wfRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/contents/.github/workflows?ref=${encodeURIComponent(defaultBranch)}`,
          { headers: { Accept: "application/vnd.github+json" } }
        );
        let workflows: string[] = [];
        if (wfRes.ok) {
          const items = (await wfRes.json()) as Array<{ name?: string; type?: string }>;
          if (Array.isArray(items)) {
            workflows = items
              .filter((i) => i.type === "file" && i.name && /\.ya?ml$/i.test(i.name))
              .map((i) => i.name as string);
          }
        }
        const branchesRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/branches?per_page=10`,
          { headers: { Accept: "application/vnd.github+json" } }
        );
        let branches = [defaultBranch];
        if (branchesRes.ok) {
          const brJson = (await branchesRes.json()) as Array<{ name?: string }>;
          if (Array.isArray(brJson) && brJson.length > 0) {
            const names = brJson.map((b) => b.name).filter(Boolean) as string[];
            branches = Array.from(new Set([defaultBranch, ...names]));
          }
        }
        return {
          owner: parsed.owner,
          repo: parsed.repo,
          suggestedId,
          defaultBranch,
          branches,
          workflows,
          source: "github-public",
          notFoundOrEmpty: workflows.length === 0,
        };
      }
    } catch {
      // Offline / private / rate-limited -> fall back gracefully to manual 3-field completion
    }
  }

  return {
    owner: parsed?.owner || "repository",
    repo: parsed?.repo || "pipeline",
    suggestedId,
    defaultBranch: "main",
    branches: ["main", "develop", "production"],
    workflows: [],
    source: "fallback",
    notFoundOrEmpty: false,
  };
}
