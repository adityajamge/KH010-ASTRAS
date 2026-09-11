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

/** Thrown by authenticated requests; `status` lets callers branch on 404/409/etc. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function authedRequest<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : `API request failed: ${response.status} ${path}`;
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** Authenticated request: pass the token from Clerk's `getToken()`. */
export function apiFetch<T>(path: string, token: string): Promise<T> {
  return authedRequest<T>(path, token);
}

/** Current user + role: GET {API_URL}/api/v1/me (requires sign-in). */
export function getMe(token: string): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/v1/me", token);
}

// ---------- Farmer onboarding ----------

export type PriorityLevel = "normal" | "high" | "critical";

export interface CanalRead {
  id: number;
  name: string;
  capacity: number;
  current_flow: number;
  water_level: number;
  created_at: string;
  updated_at: string;
}

export interface FieldRead {
  id: number;
  farmer_id: number;
  area_acres: number;
  crop: string;
  crop_stage: string;
  priority: PriorityLevel;
  created_at: string;
  updated_at: string;
}

/** The signed-in farmer's profile. Village is fixed (single-village prototype). */
export interface FarmerProfile {
  id: number;
  name: string;
  village_id: number;
  phone: string;
  canal_id: number | null;
  field_id: number | null;
  created_at: string;
  updated_at: string;
  fields: FieldRead[];
}

export interface FarmerOnboardingPayload {
  name: string;
  phone: string;
  canal_id: number | null;
  field: {
    area_acres: number;
    crop: string;
    crop_stage: string;
    priority: PriorityLevel;
  };
}

/**
 * GET {API_URL}/api/v1/farmers/me.
 * Resolves to `null` (rather than throwing) when onboarding hasn't run yet.
 */
export async function getFarmerProfile(
  token: string,
): Promise<FarmerProfile | null> {
  try {
    return await authedRequest<FarmerProfile>("/api/v1/farmers/me", token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** POST {API_URL}/api/v1/farmers/onboard — one-time farmer profile + field intake. */
export function onboardFarmer(
  token: string,
  payload: FarmerOnboardingPayload,
): Promise<FarmerProfile> {
  return authedRequest<FarmerProfile>("/api/v1/farmers/onboard", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** GET {API_URL}/api/v1/canals — options for the onboarding canal picker. */
export function listCanals(token: string): Promise<CanalRead[]> {
  return authedRequest<CanalRead[]>("/api/v1/canals", token);
}
