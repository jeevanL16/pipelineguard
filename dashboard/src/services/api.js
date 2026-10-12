const API_BASE_URL = "http://127.0.0.1:8000";

export async function getBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  return response.json();
}

export async function testBackendConnection() {
  const response = await fetch(`${API_BASE_URL}/api/test`);

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  return response.json();
}

export async function getPipelines() {
  const response = await fetch(`${API_BASE_URL}/api/pipelines`);

  if (!response.ok) {
    throw new Error(`Failed to fetch pipelines: ${response.status}`);
  }

  return response.json();
}

export async function getRuns() {
  const response = await fetch(`${API_BASE_URL}/api/runs`);

  if (!response.ok) {
    throw new Error(`Failed to fetch pipeline runs: ${response.status}`);
  }

  return response.json();
}
