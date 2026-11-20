const API_BASE_URL = "http://127.0.0.1:8000";
const TOKEN_KEY = "pipelineguard_access_token";

export function getAccessToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function login(username, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || `Login failed: ${response.status}`);
  }

  if (!data.access_token) {
    throw new Error("The server did not return an access token.");
  }

  setAccessToken(data.access_token);
  return data;
}

async function apiRequest(path, options = {}) {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAccessToken();
    window.dispatchEvent(new Event("pipelineguard:unauthorized"));
    throw new Error("Your session has expired. Please log in again.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.detail?.message ||
      data.detail ||
      `Backend request failed: ${response.status}`
    );
  }

  return response.json();
}

export async function getBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  return response.json();
}

export async function testBackendConnection() {
  return apiRequest("/api/test");
}

export async function getPipelines() {
  return apiRequest("/api/pipelines");
}

export async function getRuns() {
  return apiRequest("/api/runs");
}

export async function getSecurityEvents() {
  return apiRequest("/api/events");
}

export async function updateSecurityEventStatus(eventId, newStatus) {
  return apiRequest(
    `/api/events/${encodeURIComponent(eventId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    }
  );
}

export async function getAuditLogs() {
  return apiRequest("/api/audit-logs");
}
