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

/** Authenticated JSON POST/PUT/PATCH helper. */
export function apiPost<T>(
  path: string,
  token: string,
  body: unknown,
  method = "POST",
): Promise<T> {
  return authedRequest<T>(path, token, {
    method,
    body: JSON.stringify(body),
  });
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

// ---------- Farmer dashboard (live backend, no mock data) ----------

/** Definitions: available = canal current_flow; remaining = allocated - delivered. */
export interface WaterRequestSubmit {
  quantity_requested: number;
  request_date: string;
  preferred_time: string;
  duration_hours: number;
  crop: string;
  urgency: PriorityLevel;
}

export interface WaterRequestRead {
  id: number;
  farmer_id: number;
  quantity_requested: number;
  request_date: string;
  preferred_time: string;
  duration_hours: number;
  crop: string;
  urgency: PriorityLevel;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AllocationRead {
  id: number;
  request_id: number;
  farmer_id: number;
  allocated_quantity: number;
  allocation_date: string;
  time_start: string;
  time_end: string;
  reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryRead {
  id: number;
  allocation_id: number;
  allocated_quantity: number;
  delivered_quantity: number;
  delivery_status: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduleRead {
  id: number;
  farmer_id: number;
  allocation_id: number;
  date: string;
  start_time: string;
  end_time: string;
  quantity: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardNotification {
  id: number;
  farmer_id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface ActivityItem {
  title: string;
  meta: string;
  created_at: string;
}

export interface WaterAdvisory {
  flow_state: string;
  has_conflict: boolean;
  lines: string[];
}

export interface FarmerDashboardSummary {
  farmer_name: string;
  canal_name: string | null;
  available_water: number;
  allocated_water: number;
  remaining_water: number;
  has_request: boolean;
  current_allocation: AllocationRead | null;
  current_request: WaterRequestRead | null;
  delivery: DeliveryRead | null;
  upcoming_schedules: ScheduleRead[];
  allocations: AllocationRead[];
  requests: WaterRequestRead[];
  notifications: DashboardNotification[];
  recent_activity: ActivityItem[];
  advisory: WaterAdvisory;
}

export interface MediationView {
  has_proposal: boolean;
  requested: number;
  allocated: number;
  reason: string | null;
  status: string | null;
  conflict_code: string | null;
  evidence: string[];
  objection_options: string[];
}

export type ObjectionReason =
  | "NEED_MORE_WATER"
  | "NEED_DIFFERENT_TIME"
  | "CROP_CRITICAL"
  | "EMERGENCY"
  | "OTHER";

/** UI chip label -> API objection reason. */
export const OBJECTION_REASON_BY_LABEL: Record<string, ObjectionReason> = {
  "Need more water": "NEED_MORE_WATER",
  "Need different time": "NEED_DIFFERENT_TIME",
  "Crop critical": "CROP_CRITICAL",
  Emergency: "EMERGENCY",
  Other: "OTHER",
};

export interface ObjectionResult {
  requested: number;
  previous_allocated: number;
  allocated: number;
  changed: boolean;
  reason: string | null;
  evidence: string[];
  conflict_code: string | null;
  urgency: string;
}

export interface AgreementRead {
  agreement_code: string;
  conflict_id: number | null;
  canal_id: number | null;
  status: string;
  version: number;
  final_allocation: Record<string, number>;
  participants: number[];
  reason: string | null;
  approved_by: string | null;
  supersedes_id: number | null;
}

export interface AcceptResult {
  agreement: AgreementRead;
  allocated: number;
}

/** GET {API_URL}/api/v1/dashboard/farmer — everything the dashboard needs. */
export function getFarmerDashboard(token: string): Promise<FarmerDashboardSummary> {
  return apiFetch<FarmerDashboardSummary>("/api/v1/dashboard/farmer", token);
}

/** POST {API_URL}/api/v1/requests — submit a requirement, get a proposal back. */
export function submitWaterRequest(
  token: string,
  payload: WaterRequestSubmit,
): Promise<WaterRequestRead> {
  return apiPost<WaterRequestRead>("/api/v1/requests", token, payload);
}

/** GET {API_URL}/api/v1/mediation/me — current proposal + evidence. */
export function getMediation(token: string): Promise<MediationView> {
  return apiFetch<MediationView>("/api/v1/mediation/me", token);
}

/** POST {API_URL}/api/v1/mediation/objections — object, get revised proposal. */
export function submitObjection(
  token: string,
  reason: ObjectionReason,
  details?: string,
): Promise<ObjectionResult> {
  return apiPost<ObjectionResult>("/api/v1/mediation/objections", token, {
    reason,
    details: details ?? null,
  });
}

/** POST {API_URL}/api/v1/mediation/accept — accept, freeze an agreement. */
export function acceptProposal(token: string): Promise<AcceptResult> {
  return apiPost<AcceptResult>("/api/v1/mediation/accept", token, {});
}

// ---------- Dam dashboard (live backend, no mock data) ----------

export interface DamStatCard {
  label: string;
  value: string;
  tone: "ok" | "warn" | "danger" | null;
}

export interface CanalReleaseRow {
  canal: string;
  requested: number;
  approved: number;
  released: number;
  received: number;
  difference: number;
  status: string;
}

export interface RainfallRead {
  last_24h: number;
  forecast: string;
  catchment: string;
}

export interface FlowStageRead {
  label: string;
  value: number;
  note: string | null;
}

export interface FlowChainRead {
  stages: FlowStageRead[];
  unaccounted: number;
  alert: boolean;
  alert_note: string | null;
}

export interface DamDashboardSummary {
  dam_name: string;
  stats: DamStatCard[];
  releases: CanalReleaseRow[];
  rainfall: RainfallRead;
  flow_chain: FlowChainRead;
}

export interface DamSupplyUpdate {
  total_available?: number;
  current_storage?: number;
  inflow?: number;
  outflow?: number;
  water_level?: number;
  rainfall_last_24h?: number;
  rainfall_forecast?: string;
}

/** GET {API_URL}/api/v1/dashboard/dam — supply state, releases, rainfall. */
export function getDamDashboard(token: string): Promise<DamDashboardSummary> {
  return apiFetch<DamDashboardSummary>("/api/v1/dashboard/dam", token);
}

/** PATCH {API_URL}/api/v1/dam — publish supply-side state. */
export function publishSupplyState(
  token: string,
  payload: DamSupplyUpdate,
): Promise<unknown> {
  return authedRequest("/api/v1/dam", token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
