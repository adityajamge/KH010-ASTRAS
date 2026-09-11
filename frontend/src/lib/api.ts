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
  dam_id: number | null;
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

// ---------- Jal Vigyani dashboard ----------

export interface DamRead {
  id: number;
  name: string;
  village_id: number;
  total_available: number;
  current_storage: number;
  inflow: number;
  outflow: number;
  created_at: string;
  updated_at: string;
}

export interface JalVigyaniOverview {
  dam: DamRead;
  canals: CanalRead[];
  farmer_count: number;
  active_conflicts: number;
  active_anomalies: number;
  under_delivery_count: number;
}

/** GET {API_URL}/api/v1/jal-vigyani/overview — dam + canals + summary counts. */
export function getJalVigyaniOverview(token: string): Promise<JalVigyaniOverview> {
  return authedRequest<JalVigyaniOverview>("/api/v1/jal-vigyani/overview", token);
}

export interface FarmerAllocationSummary {
  farmer_id: number;
  farmer_name: string;
  requested: number | null;
  allocated: number | null;
  delivered: number | null;
  shortfall: number | null;
  status: string;
}

/** GET {API_URL}/api/v1/jal-vigyani/farmer-allocations */
export function getFarmerAllocations(
  token: string,
): Promise<FarmerAllocationSummary[]> {
  return authedRequest<FarmerAllocationSummary[]>(
    "/api/v1/jal-vigyani/farmer-allocations",
    token,
  );
}

export type DeliveryStatus =
  | "on_track"
  | "complete"
  | "under_delivery"
  | "over_delivery"
  | "investigation_required";

export interface UnderDeliveryRow {
  delivery_id: number;
  farmer_id: number;
  farmer_name: string;
  allocated_quantity: number;
  delivered_quantity: number;
  shortfall: number;
  status: DeliveryStatus;
}

/** GET {API_URL}/api/v1/jal-vigyani/under-delivery */
export function getUnderDelivery(token: string): Promise<UnderDeliveryRow[]> {
  return authedRequest<UnderDeliveryRow[]>("/api/v1/jal-vigyani/under-delivery", token);
}

export type ScheduleStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface CanalScheduleRow {
  schedule_id: number;
  farmer_id: number;
  farmer_name: string;
  date: string;
  start_time: string;
  end_time: string;
  quantity: number;
  status: ScheduleStatus;
}

/** GET {API_URL}/api/v1/jal-vigyani/schedule */
export function getCanalSchedule(token: string): Promise<CanalScheduleRow[]> {
  return authedRequest<CanalScheduleRow[]>("/api/v1/jal-vigyani/schedule", token);
}

export interface SensorReading {
  id: number;
  canal_id: number;
  location: string;
  flow: number;
  water_level: number;
  recorded_at: string;
}

export interface SensorReadingPayload {
  canal_id: number;
  location: string;
  flow: number;
  water_level: number;
}

/** GET {API_URL}/api/v1/monitoring/sensor-readings */
export function listSensorReadings(
  token: string,
  canalId?: number,
): Promise<SensorReading[]> {
  const qs = canalId !== undefined ? `?canal_id=${canalId}` : "";
  return authedRequest<SensorReading[]>(`/api/v1/monitoring/sensor-readings${qs}`, token);
}

/** POST {API_URL}/api/v1/monitoring/sensor-readings — JV-US-02 record a flow measurement. */
export function recordSensorReading(
  token: string,
  payload: SensorReadingPayload,
): Promise<SensorReading> {
  return authedRequest<SensorReading>("/api/v1/monitoring/sensor-readings", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type AnomalyStatus =
  | "investigation_required"
  | "investigating"
  | "resolved"
  | "dismissed";

export interface Anomaly {
  id: number;
  canal_id: number;
  code: string;
  location: string;
  expected_value: number;
  measured_value: number;
  difference: number;
  status: AnomalyStatus;
  possible_causes: string[];
  created_at: string;
  updated_at: string;
}

export interface AnomalyPayload {
  canal_id: number;
  code: string;
  location: string;
  expected_value: number;
  measured_value: number;
  difference: number;
  possible_causes: string[];
}

/** GET {API_URL}/api/v1/monitoring/anomalies */
export function listAnomalies(token: string): Promise<Anomaly[]> {
  return authedRequest<Anomaly[]>("/api/v1/monitoring/anomalies", token);
}

/** POST {API_URL}/api/v1/monitoring/anomalies — JV-US-03 report an infrastructure/flow issue. */
export function reportAnomaly(
  token: string,
  payload: AnomalyPayload,
): Promise<Anomaly> {
  return authedRequest<Anomaly>("/api/v1/monitoring/anomalies", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** PATCH {API_URL}/api/v1/monitoring/anomalies/{id}/status */
export function updateAnomalyStatus(
  token: string,
  anomalyId: number,
  status: AnomalyStatus,
): Promise<Anomaly> {
  return authedRequest<Anomaly>(
    `/api/v1/monitoring/anomalies/${anomalyId}/status`,
    token,
    { method: "PATCH", body: JSON.stringify({ status }) },
  );
}

export type ConflictStatus =
  | "detected"
  | "under_review"
  | "negotiation"
  | "approved"
  | "revision_requested"
  | "escalated"
  | "resolved";

export interface Conflict {
  id: number;
  conflict_code: string;
  canal_id: number;
  status: ConflictStatus;
  total_demand: number;
  available_water: number;
  shortage: number;
  priority: PriorityLevel;
  proposal: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConflictParticipantDetail {
  farmer_id: number;
  farmer_name: string;
  request_id: number | null;
}

export interface ObjectionDetail {
  id: number;
  farmer_id: number;
  farmer_name: string;
  reason: string;
  details: string | null;
  status: string;
}

export interface ConflictDetail {
  id: number;
  conflict_code: string;
  canal_id: number;
  status: ConflictStatus;
  total_demand: number;
  available_water: number;
  shortage: number;
  priority: PriorityLevel;
  proposal: string | null;
  participants: ConflictParticipantDetail[];
  objections: ObjectionDetail[];
}

/** GET {API_URL}/api/v1/conflicts */
export function listConflicts(token: string): Promise<Conflict[]> {
  return authedRequest<Conflict[]>("/api/v1/conflicts", token);
}

/** GET {API_URL}/api/v1/conflicts/{id} — detail behind the "Review" action. */
export function getConflict(
  token: string,
  conflictId: number,
): Promise<ConflictDetail> {
  return authedRequest<ConflictDetail>(`/api/v1/conflicts/${conflictId}`, token);
}

export type ConflictAction = "approve" | "request_revision" | "escalate";

/** POST {API_URL}/api/v1/conflicts/{id}/decision */
export function decideConflict(
  token: string,
  conflictId: number,
  action: ConflictAction,
  note?: string,
): Promise<Conflict> {
  return authedRequest<Conflict>(`/api/v1/conflicts/${conflictId}/decision`, token, {
    method: "POST",
    body: JSON.stringify({ action, note: note ?? null }),
  });
}
