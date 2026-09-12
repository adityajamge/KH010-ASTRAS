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
  village_name: string;
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
  mediator_message: string | null;
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
  mediator_message: string | null;
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

/** POST {API_URL}/api/v1/requests/cancel — withdraw the current open request. */
export function cancelWaterRequest(token: string): Promise<WaterRequestRead> {
  return apiPost<WaterRequestRead>("/api/v1/requests/cancel", token, {});
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
  lang: string = "en",
): Promise<ObjectionResult> {
  return apiPost<ObjectionResult>("/api/v1/mediation/objections", token, {
    reason,
    details: details ?? null,
    lang,
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
// ---------- Jal Vigyani dashboard ----------

export interface DamRead {
  id: number;
  name: string;
  village_id: number;
  total_available: number;
  current_storage: number;
  inflow: number;
  outflow: number;
  water_level: number;
  rainfall_last_24h: number;
  rainfall_forecast: string;
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

export interface FarmerCanalRow {
  farmer_id: number;
  farmer_name: string;
  village: string;
  phone: string;
  canal_id: number | null;
  canal_name: string | null;
}

/** GET {API_URL}/api/v1/jal-vigyani/farmers — unassigned farmers + farmers on this dam's canals. */
export function getAssignableFarmers(token: string): Promise<FarmerCanalRow[]> {
  return authedRequest<FarmerCanalRow[]>("/api/v1/jal-vigyani/farmers", token);
}

/** PATCH {API_URL}/api/v1/jal-vigyani/farmers/{farmerId}/canal — assign (or null to unassign) a farmer's canal. */
export function assignFarmerCanal(
  token: string,
  farmerId: number,
  canalId: number | null,
): Promise<FarmerCanalRow> {
  return apiPost<FarmerCanalRow>(
    `/api/v1/jal-vigyani/farmers/${farmerId}/canal`,
    token,
    { canal_id: canalId },
    "PATCH",
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
  mediator_message: string | null;
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

// ---------- AI Coordinator (website chat) ----------

export interface AssistantMessageOut {
  reply: string;
}

export type AssistantHistoryRole = "user" | "assistant";

export interface AssistantHistoryItem {
  role: AssistantHistoryRole;
  content: string;
  channel: "web" | "twilio";
  created_at: string;
}

/**
 * POST {API_URL}/api/v1/assistant/message — same AI Coordinator, allocation
 * engine and mediation workflow the Twilio channel uses (see
 * backend/app/services/ai_coordinator.py).
 */
/**
 * POST {API_URL}/api/v1/assistant/message. `lang` is the dashboard's
 * selected language ("en"/"hi"/"mr") — when passed, the reply follows it
 * regardless of what language the message itself is typed in.
 */
export function sendAssistantMessage(
  token: string,
  text: string,
  lang?: "en" | "hi" | "mr",
): Promise<AssistantMessageOut> {
  return apiPost<AssistantMessageOut>("/api/v1/assistant/message", token, { text, lang });
}

/** GET {API_URL}/api/v1/assistant/history — this account's website chat history. */
export function getAssistantHistory(token: string): Promise<AssistantHistoryItem[]> {
  return authedRequest<AssistantHistoryItem[]>("/api/v1/assistant/history", token);
}

// ---------- 3D Digital Twin (network state) ----------

export type TwinStatus =
  | "normal"
  | "shortage"
  | "conflict"
  | "pending_mediation"
  | "approved"
  | "delivery_issue";

export interface TwinFarmer {
  farmer_id: number;
  name: string;
  canal_id: number;
  order_index: number;
  position_label: "head" | "middle" | "tail";
  requested: number | null;
  allocated: number | null;
  delivered: number | null;
  shortfall: number | null;
  status: string;
  has_conflict: boolean;
  has_pending_objection: boolean;
  twin_status: TwinStatus;
}

export interface TwinCanal {
  canal_id: number;
  name: string;
  capacity: number;
  current_flow: number;
  water_level: number;
  flow_state: "low" | "normal" | "high";
  release_status: string;
  requested: number;
  approved: number;
  released: number;
  received: number;
  difference: number;
  active_conflicts: number;
  active_anomalies: number;
  farmers: TwinFarmer[];
}

export interface TwinReservoir {
  dam_id: number;
  name: string;
  water_level: number;
  current_storage: number;
  total_available: number;
  inflow: number;
  outflow: number;
  rainfall_last_24h: number;
  status: string;
  status_tone: "ok" | "warn" | "danger" | null;
}

export interface NetworkStateResponse {
  is_simulated: boolean;
  simulation_note: string;
  generated_at: string;
  dam: TwinReservoir;
  canals: TwinCanal[];
  total_active_conflicts: number;
  total_active_anomalies: number;
}

/** GET {API_URL}/api/v1/network/state — feeds the 3D digital twin. */
export function getNetworkState(token: string): Promise<NetworkStateResponse> {
  return authedRequest<NetworkStateResponse>("/api/v1/network/state", token);
}
