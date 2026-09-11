export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }
  return response.json() as Promise<T>;
}

/** Liveness probe: GET {API_URL}/health */
export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

/** Versioned health check: GET {API_URL}/api/v1/health */
export function getVersionedHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/v1/health");
}

export interface MeResponse {
  user_id: string;
  role: string | null;
}

/** Authenticated request: pass the token from Clerk's `getToken()`. */
export async function apiFetch<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }
  return response.json() as Promise<T>;
}

/** Current user + role: GET {API_URL}/api/v1/me (requires sign-in). */
export function getMe(token: string): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/v1/me", token);
}
