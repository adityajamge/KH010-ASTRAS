import { useState, type FormEvent } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { DashboardShell, JAL_VIGYANI_NAV } from "../../components/DashboardShell";
import { Pill, statusTone } from "../../components/dashboard/Pill";
import { StatGrid } from "../../components/dashboard/StatGrid";
import { DigitalTwin3D } from "../../components/twin/DigitalTwin3D";
import type { StatCardData } from "../../lib/mockData";
import { useAuthedData } from "../../lib/useAuthedData";
import { useLanguage } from "../../lib/i18n";
import { formatStatus } from "../../lib/format";
import {
  ApiError,
  assignFarmerCanal,
  decideConflict,
  getAssignableFarmers,
  getCanalSchedule,
  getConflict,
  getFarmerAllocations,
  getJalVigyaniOverview,
  getUnderDelivery,
  listAnomalies,
  listConflicts,
  listSensorReadings,
  recordSensorReading,
  reportAnomaly,
  updateAnomalyStatus,
  type Anomaly,
  type CanalRead,
  type Conflict,
  type ConflictAction,
  type ConflictDetail,
  type FarmerCanalRow,
  type JalVigyaniOverview,
  type SensorReading,
} from "../../lib/api";

type PillTone = "neutral" | "success" | "warn" | "danger" | "primary";

function conflictTone(status: string): PillTone {
  switch (status) {
    case "approved":
    case "resolved":
      return "success";
    case "revision_requested":
    case "negotiation":
      return "warn";
    case "escalated":
      return "danger";
    default:
      return "neutral";
  }
}

function anomalyTone(status: string): PillTone {
  switch (status) {
    case "resolved":
      return "success";
    case "investigating":
      return "warn";
    case "dismissed":
      return "neutral";
    default:
      return "danger";
  }
}

function deliveryTone(status: string): PillTone {
  switch (status) {
    case "complete":
    case "on_track":
      return "success";
    case "under_delivery":
    case "over_delivery":
      return "warn";
    default:
      return "danger";
  }
}

const POSSIBLE_CAUSES = [
  "Leakage",
  "Seepage",
  "Unauthorized withdrawal",
  "Gate mismatch",
  "Sensor error",
  "Unexpected discharge",
  "Evaporation / physical loss",
];

function LoadingNote({ label }: { label?: string }) {
  const { t } = useLanguage();
  return <p className="hero-note">{label ?? t("Loading…")}</p>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="card">
      <p className="field-error" style={{ margin: 0 }}>
        {message}
      </p>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary btn-xs" onClick={onRetry}>
          {t("Try again")}
        </button>
      </div>
    </div>
  );
}

// ---------- Live canal monitoring ----------

function CanalMonitoringTable({ canals }: { canals: CanalRead[] }) {
  const { t } = useLanguage();
  if (canals.length === 0) {
    return (
      <div className="card">
        <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
          {t("No canals are configured for this dam yet.")}
        </p>
      </div>
    );
  }
  return (
    <div className="dtable-wrap">
      <table className="dtable">
        <thead>
          <tr>
            <th>{t("Canal")}</th>
            <th className="num">{t("Flow")}</th>
            <th className="num">{t("Water level")}</th>
            <th className="num">{t("Capacity")}</th>
            <th className="num">{t("Utilization")}</th>
          </tr>
        </thead>
        <tbody>
          {canals.map((canal) => {
            const utilization =
              canal.capacity > 0
                ? Math.round((canal.current_flow / canal.capacity) * 100)
                : 0;
            return (
              <tr key={canal.id}>
                <td>{canal.name}</td>
                <td className="num">{canal.current_flow}</td>
                <td className="num">{canal.water_level} m</td>
                <td className="num">{canal.capacity}</td>
                <td className="num">
                  <Pill tone={utilization >= 95 ? "danger" : utilization >= 80 ? "warn" : "success"}>
                    {`${utilization}%`}
                  </Pill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function useOverview() {
  return useAuthedData<JalVigyaniOverview>(getJalVigyaniOverview);
}

function OverviewStats({ overview }: { overview: JalVigyaniOverview }) {
  const { t } = useLanguage();
  const totalFlow = overview.canals.reduce((sum, c) => sum + c.current_flow, 0);
  const totalCapacity = overview.canals.reduce((sum, c) => sum + c.capacity, 0);
  const utilization = totalCapacity > 0 ? Math.round((totalFlow / totalCapacity) * 100) : 0;

  const stats: StatCardData[] = [
    { label: t("Total canal flow"), value: `${totalFlow} ${t("units")}` },
    { label: t("Canal capacity"), value: `${totalCapacity} ${t("units")}` },
    { label: t("Capacity utilization"), value: `${utilization}%` },
    { label: t("Number of farmers"), value: String(overview.farmer_count) },
    {
      label: t("Active conflicts"),
      value: String(overview.active_conflicts),
      tone: overview.active_conflicts > 0 ? "warn" : undefined,
    },
    {
      label: t("Active anomalies"),
      value: String(overview.active_anomalies),
      tone: overview.active_anomalies > 0 ? "danger" : undefined,
    },
    {
      label: t("Under-delivery cases"),
      value: String(overview.under_delivery_count),
      tone: overview.under_delivery_count > 0 ? "warn" : undefined,
    },
  ];

  return <StatGrid stats={stats} />;
}

// ---------- Farmer allocations ----------

function AllocationTable() {
  const { t } = useLanguage();
  const { data, loading, error, reload } = useAuthedData(getFarmerAllocations);

  if (loading) return <LoadingNote label={t("Loading farmer allocations…")} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <div className="card">
        <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
          {t("No farmers are assigned to this dam's canals yet.")}
        </p>
      </div>
    );
  }

  return (
    <div className="dtable-wrap">
      <table className="dtable">
        <thead>
          <tr>
            <th>{t("Farmer")}</th>
            <th className="num">{t("Requested")}</th>
            <th className="num">{t("Allocated")}</th>
            <th className="num">{t("Delivered")}</th>
            <th className="num">{t("Shortfall")}</th>
            <th>{t("Status")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.farmer_id}>
              <td>{row.farmer_name}</td>
              <td className="num">{row.requested ?? "—"}</td>
              <td className="num">{row.allocated ?? "—"}</td>
              <td className="num">{row.delivered ?? "—"}</td>
              <td className="num">{row.shortfall ?? "—"}</td>
              <td>
                <Pill
                  tone={row.status === "no_request" ? "neutral" : statusTone(formatStatus(row.status))}
                >
                  {t(formatStatus(row.status))}
                </Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Farmers: canal assignment ----------

function FarmerCanalAssignRow({
  farmer,
  canals,
  onChanged,
}: {
  farmer: FarmerCanalRow;
  canals: CanalRead[];
  onChanged: () => void;
}) {
  const { getToken } = useAuth();
  const { t } = useLanguage();
  const [canalId, setCanalId] = useState<number | "">(farmer.canal_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAssign() {
    setError(null);
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t("Could not verify your session."));
      await assignFarmerCanal(token, farmer.farmer_id, canalId === "" ? null : Number(canalId));
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Could not assign the canal."));
    } finally {
      setBusy(false);
    }
  }

  const dirty = (canalId === "" ? null : Number(canalId)) !== farmer.canal_id;

  return (
    <tr>
      <td>{farmer.farmer_name}</td>
      <td>{farmer.village}</td>
      <td>{farmer.phone}</td>
      <td>
        <select value={canalId} onChange={(e) => setCanalId(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">{t("Not assigned")}</option>
          {canals.map((canal) => (
            <option key={canal.id} value={canal.id}>
              {canal.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button
          type="button"
          className="btn btn-primary btn-xs"
          disabled={busy || !dirty}
          onClick={handleAssign}
        >
          {busy ? t("Saving…") : t("Save")}
        </button>
        {error && <p className="field-error" style={{ margin: "4px 0 0" }}>{error}</p>}
      </td>
    </tr>
  );
}

function FarmersSection() {
  const { t } = useLanguage();
  const overview = useOverview();
  const { data, loading, error, reload } = useAuthedData(getAssignableFarmers);

  if (loading || overview.loading) return <LoadingNote label={t("Loading farmers…")} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (overview.error) return <ErrorState message={overview.error} onRetry={overview.reload} />;

  const farmers = data ?? [];
  const canals = overview.data?.canals ?? [];

  return (
    <div className="dash-block">
      <div className="dash-block-head">
        <h3>{t("Assign canals")}</h3>
        <p>{t("Unassigned farmers plus farmers already on this dam's canals.")}</p>
      </div>
      {farmers.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
            {t("No farmers to assign right now.")}
          </p>
        </div>
      ) : (
        <div className="dtable-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>{t("Farmer")}</th>
                <th>{t("Village")}</th>
                <th>{t("Phone")}</th>
                <th>{t("Canal")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {farmers.map((farmer) => (
                <FarmerCanalAssignRow
                  key={farmer.farmer_id}
                  farmer={farmer}
                  canals={canals}
                  onChanged={reload}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Monitoring: sensor readings ----------

function RecordMeasurementForm({
  canals,
  onRecorded,
}: {
  canals: CanalRead[];
  onRecorded: () => void;
}) {
  const { getToken } = useAuth();
  const { t } = useLanguage();
  const [canalId, setCanalId] = useState<number | "">(canals[0]?.id ?? "");
  const [location, setLocation] = useState("");
  const [flow, setFlow] = useState("");
  const [waterLevel, setWaterLevel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const flowValue = Number(flow);
    const levelValue = Number(waterLevel);
    if (!canalId || !location.trim() || !Number.isFinite(flowValue) || !Number.isFinite(levelValue)) {
      setError(t("Please fill in every field with valid values."));
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t("Could not verify your session. Please sign in again."));
      await recordSensorReading(token, {
        canal_id: Number(canalId),
        location: location.trim(),
        flow: flowValue,
        water_level: levelValue,
      });
      setLocation("");
      setFlow("");
      setWaterLevel("");
      onRecorded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Could not save the measurement."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="rm-canal">{t("Canal")}</label>
          <select id="rm-canal" value={canalId} onChange={(e) => setCanalId(Number(e.target.value))}>
            {canals.map((canal) => (
              <option key={canal.id} value={canal.id}>
                {canal.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="rm-location">{t("Location")}</label>
          <input
            id="rm-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("e.g. Gate G2")}
          />
        </div>
        <div className="form-field">
          <label htmlFor="rm-flow">{t("Flow (units/min)")}</label>
          <input
            id="rm-flow"
            type="number"
            step="0.1"
            value={flow}
            onChange={(e) => setFlow(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="rm-level">{t("Water level (m)")}</label>
          <input
            id="rm-level"
            type="number"
            step="0.1"
            value={waterLevel}
            onChange={(e) => setWaterLevel(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="field-error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-xs" disabled={submitting}>
          {submitting ? t("Saving…") : t("Record measurement")}
        </button>
      </div>
    </form>
  );
}

function RecentReadingsTable({ readings }: { readings: SensorReading[] }) {
  const { t } = useLanguage();
  if (readings.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
        {t("No measurements recorded yet.")}
      </p>
    );
  }
  return (
    <div className="dtable-wrap">
      <table className="dtable">
        <thead>
          <tr>
            <th>{t("Location")}</th>
            <th className="num">{t("Flow")}</th>
            <th className="num">{t("Water level")}</th>
            <th>{t("Recorded")}</th>
          </tr>
        </thead>
        <tbody>
          {readings.map((reading) => (
            <tr key={reading.id}>
              <td>{reading.location}</td>
              <td className="num">{reading.flow}</td>
              <td className="num">{reading.water_level} m</td>
              <td>{new Date(reading.recorded_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonitoringSection() {
  const { t } = useLanguage();
  const overview = useOverview();
  const readings = useAuthedData(listSensorReadings);

  if (overview.loading) return <LoadingNote label={t("Loading canal state…")} />;
  if (overview.error) return <ErrorState message={overview.error} onRetry={overview.reload} />;
  const canals = overview.data?.canals ?? [];

  return (
    <>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>{t("Live canal monitoring")}</h3>
        </div>
        <CanalMonitoringTable canals={canals} />
      </div>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>{t("Record measurement")}</h3>
          <p>{t("JV-US-02 — log an observed water-flow reading.")}</p>
        </div>
        {canals.length > 0 ? (
          <RecordMeasurementForm canals={canals} onRecorded={readings.reload} />
        ) : (
          <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
            {t("No canals to record a measurement against.")}
          </p>
        )}
      </div>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>{t("Recent readings")}</h3>
        </div>
        {readings.loading ? (
          <LoadingNote />
        ) : readings.error ? (
          <ErrorState message={readings.error} onRetry={readings.reload} />
        ) : (
          <RecentReadingsTable readings={readings.data ?? []} />
        )}
      </div>
    </>
  );
}

// ---------- Conflicts ----------

function ConflictDetailPanel({ detail }: { detail: ConflictDetail }) {
  const { t } = useLanguage();
  return (
    <div className="anomaly-panel" style={{ marginTop: 12 }}>
      <p className="negotiation-reason" style={{ marginTop: 0 }}>
        {t("Participants")}
      </p>
      {detail.participants.length === 0 ? (
        <p className="negotiation-reason">{t("No participants recorded.")}</p>
      ) : (
        <ul className="plain-list">
          {detail.participants.map((p) => (
            <li key={p.farmer_id}>{p.farmer_name}</li>
          ))}
        </ul>
      )}
      <p className="negotiation-reason">{t("Objections")}</p>
      {detail.objections.length === 0 ? (
        <p className="negotiation-reason">{t("No objections filed.")}</p>
      ) : (
        <ul className="plain-list">
          {detail.objections.map((o) => (
            <li key={o.id}>
              <strong>{o.farmer_name}</strong> — {t(formatStatus(o.reason))}
              {o.details ? `: ${o.details}` : ""}{" "}
              <Pill tone={o.status === "resolved" ? "success" : "neutral"}>
                {t(formatStatus(o.status))}
              </Pill>
              {o.mediator_message && (
                <p className="negotiation-reason mediator-message" style={{ marginTop: 6 }}>
                  {o.mediator_message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConflictCard({ conflict, onChanged }: { conflict: Conflict; onChanged: () => void }) {
  const { getToken } = useAuth();
  const { t } = useLanguage();
  const [detail, setDetail] = useState<ConflictDetail | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busyAction, setBusyAction] = useState<ConflictAction | "review" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReview() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setError(null);
    setBusyAction("review");
    try {
      const token = await getToken();
      if (!token) throw new Error(t("Could not verify your session."));
      const data = await getConflict(token, conflict.id);
      setDetail(data);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Could not load conflict detail."));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDecision(action: ConflictAction) {
    setError(null);
    setBusyAction(action);
    try {
      const token = await getToken();
      if (!token) throw new Error(t("Could not verify your session."));
      await decideConflict(token, conflict.id, action);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Could not record the decision."));
    } finally {
      setBusyAction(null);
    }
  }

  const isTerminal = conflict.status === "resolved" || conflict.status === "approved";

  return (
    <div className="conflict-card">
      <div className="conflict-card-head">
        <span className="cid">{conflict.conflict_code}</span>
        <Pill tone={conflictTone(conflict.status)}>{t(formatStatus(conflict.status))}</Pill>
      </div>
      <div className="conflict-meta">
        <div>
          {t("Canal")}
          <strong>#{conflict.canal_id}</strong>
        </div>
        <div>
          {t("Available")}
          <strong>{conflict.available_water}</strong>
        </div>
        <div>
          {t("Demand")}
          <strong>{conflict.total_demand}</strong>
        </div>
        <div>
          {t("Shortage")}
          <strong>{conflict.shortage}</strong>
        </div>
        <div>
          {t("Priority")}
          <strong>{t(formatStatus(conflict.priority))}</strong>
        </div>
      </div>
      {conflict.proposal && (
        <p className="negotiation-reason">
          {t("Proposal:")} {conflict.proposal}
        </p>
      )}
      {error && <p className="field-error">{error}</p>}
      <div className="conflict-actions">
        <button
          type="button"
          className="btn btn-secondary btn-xs"
          onClick={handleReview}
          disabled={busyAction === "review"}
        >
          {expanded ? t("Hide") : t("Review")}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-xs"
          onClick={() => handleDecision("approve")}
          disabled={busyAction !== null || isTerminal}
        >
          {t("Approve")}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-xs"
          onClick={() => handleDecision("request_revision")}
          disabled={busyAction !== null || isTerminal}
        >
          {t("Request revision")}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-xs"
          onClick={() => handleDecision("escalate")}
          disabled={busyAction !== null || isTerminal}
        >
          {t("Escalate")}
        </button>
      </div>
      {expanded && detail && <ConflictDetailPanel detail={detail} />}
    </div>
  );
}

function ConflictList() {
  const { t } = useLanguage();
  const { data, loading, error, reload } = useAuthedData(listConflicts);

  if (loading) return <LoadingNote label={t("Loading conflicts…")} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const conflicts = data ?? [];

  if (conflicts.length === 0) {
    return (
      <div className="card">
        <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
          {t("No conflicts detected for this dam right now.")}
        </p>
      </div>
    );
  }

  return (
    <>
      {conflicts.map((c) => (
        <ConflictCard key={c.id} conflict={c} onChanged={reload} />
      ))}
    </>
  );
}

// ---------- Anomalies / under-delivery ----------

function ReportAnomalyForm({
  canals,
  onReported,
}: {
  canals: CanalRead[];
  onReported: () => void;
}) {
  const { getToken } = useAuth();
  const { t } = useLanguage();
  const [canalId, setCanalId] = useState<number | "">(canals[0]?.id ?? "");
  const [location, setLocation] = useState("");
  const [expected, setExpected] = useState("");
  const [measured, setMeasured] = useState("");
  const [causes, setCauses] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCause(cause: string) {
    setCauses((prev) =>
      prev.includes(cause) ? prev.filter((c) => c !== cause) : [...prev, cause],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const expectedValue = Number(expected);
    const measuredValue = Number(measured);
    if (
      !canalId ||
      !location.trim() ||
      !Number.isFinite(expectedValue) ||
      !Number.isFinite(measuredValue) ||
      causes.length === 0
    ) {
      setError(t("Please fill in every field and select at least one possible cause."));
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t("Could not verify your session. Please sign in again."));
      await reportAnomaly(token, {
        canal_id: Number(canalId),
        code: `ANM-${canalId}-${Date.now()}`,
        location: location.trim(),
        expected_value: expectedValue,
        measured_value: measuredValue,
        difference: Math.round((expectedValue - measuredValue) * 100) / 100,
        possible_causes: causes,
      });
      setLocation("");
      setExpected("");
      setMeasured("");
      setCauses([]);
      onReported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Could not report the issue."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="an-canal">{t("Canal")}</label>
          <select id="an-canal" value={canalId} onChange={(e) => setCanalId(Number(e.target.value))}>
            {canals.map((canal) => (
              <option key={canal.id} value={canal.id}>
                {canal.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="an-location">{t("Location")}</label>
          <input
            id="an-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("e.g. Distributary 2")}
          />
        </div>
        <div className="form-field">
          <label htmlFor="an-expected">{t("Expected flow")}</label>
          <input
            id="an-expected"
            type="number"
            step="0.1"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="an-measured">{t("Measured flow")}</label>
          <input
            id="an-measured"
            type="number"
            step="0.1"
            value={measured}
            onChange={(e) => setMeasured(e.target.value)}
          />
        </div>
      </div>
      <div className="form-field" style={{ marginTop: 12 }}>
        <label>{t("Possible causes")}</label>
        <div className="objection-options">
          {POSSIBLE_CAUSES.map((cause) => (
            <button
              key={cause}
              type="button"
              className={`chip${causes.includes(cause) ? " active" : ""}`}
              onClick={() => toggleCause(cause)}
            >
              {t(cause)}
            </button>
          ))}
        </div>
      </div>
      <p className="negotiation-reason">
        {t("Reported as investigation required — not a conclusion of theft.")}
      </p>
      {error && <p className="field-error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-xs" disabled={submitting}>
          {submitting ? t("Reporting…") : t("Report issue")}
        </button>
      </div>
    </form>
  );
}

function UnderDeliveryPanel() {
  const { t } = useLanguage();
  const { data, loading, error, reload } = useAuthedData(getUnderDelivery);

  if (loading) return <LoadingNote />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
        {t("No under-delivery cases right now.")}
      </p>
    );
  }

  return (
    <>
      {rows.map((row) => (
        <div className="anomaly-panel" key={row.delivery_id} style={{ marginBottom: 12 }}>
          <div className="negotiation-row">
            <span>{row.farmer_name}</span>
            <Pill tone={deliveryTone(row.status)}>{t(formatStatus(row.status))}</Pill>
          </div>
          <div className="negotiation-row">
            <span>{t("Allocated")}</span>
            <span className="val">{row.allocated_quantity}</span>
          </div>
          <div className="negotiation-row">
            <span>{t("Delivered")}</span>
            <span className="val">{row.delivered_quantity}</span>
          </div>
          <div className="negotiation-row">
            <span>{t("Shortfall")}</span>
            <span className="val">{row.shortfall}</span>
          </div>
        </div>
      ))}
    </>
  );
}

function AnomalyRow({ anomaly, onChanged }: { anomaly: Anomaly; onChanged: () => void }) {
  const { getToken } = useAuth();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: Anomaly["status"]) {
    setError(null);
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t("Could not verify your session."));
      await updateAnomalyStatus(token, anomaly.id, status);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Could not update the anomaly."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="anomaly-panel" style={{ marginBottom: 12 }}>
      <div className="negotiation-row">
        <span>{anomaly.code}</span>
        <Pill tone={anomalyTone(anomaly.status)}>{t(formatStatus(anomaly.status))}</Pill>
      </div>
      <div className="negotiation-row">
        <span>{t("Location")}</span>
        <span className="val">{anomaly.location}</span>
      </div>
      <div className="negotiation-row">
        <span>{t("Expected / measured")}</span>
        <span className="val">
          {anomaly.expected_value} / {anomaly.measured_value}
        </span>
      </div>
      <div className="negotiation-row">
        <span>{t("Difference")}</span>
        <span className="val">
          {anomaly.difference} {t("units")}
        </span>
      </div>
      <p className="negotiation-reason">
        {t("Not a conclusion of theft — possible causes for investigation:")}
      </p>
      <div className="anomaly-causes">
        {anomaly.possible_causes.map((cause) => (
          <span className="pill pill-neutral" key={cause}>
            {t(cause)}
          </span>
        ))}
      </div>
      {error && <p className="field-error">{error}</p>}
      {anomaly.status !== "resolved" && anomaly.status !== "dismissed" && (
        <div className="conflict-actions">
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            disabled={busy}
            onClick={() => setStatus("investigating")}
          >
            {t("Investigating")}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-xs"
            disabled={busy}
            onClick={() => setStatus("resolved")}
          >
            {t("Resolved")}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            disabled={busy}
            onClick={() => setStatus("dismissed")}
          >
            {t("Dismiss")}
          </button>
        </div>
      )}
    </div>
  );
}

function AnomalyPanels() {
  const { t } = useLanguage();
  const overview = useOverview();
  const anomalies = useAuthedData(listAnomalies);

  return (
    <div className="dash-grid-2">
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>{t("Under-delivery detection")}</h3>
        </div>
        <UnderDeliveryPanel />
      </div>

      <div className="dash-block">
        <div className="dash-block-head">
          <h3>{t("Water loss / anomaly")}</h3>
        </div>
        {anomalies.loading ? (
          <LoadingNote />
        ) : anomalies.error ? (
          <ErrorState message={anomalies.error} onRetry={anomalies.reload} />
        ) : (anomalies.data ?? []).length === 0 ? (
          <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
            {t("No anomalies reported.")}
          </p>
        ) : (
          (anomalies.data ?? []).map((a) => (
            <AnomalyRow key={a.id} anomaly={a} onChanged={anomalies.reload} />
          ))
        )}

        <div className="dash-block-head" style={{ marginTop: 24 }}>
          <h3>{t("Report infrastructure issue")}</h3>
          <p>{t("JV-US-03 — leakage, blockage, gate mismatch, or a flow discrepancy.")}</p>
        </div>
        {overview.loading ? (
          <LoadingNote />
        ) : overview.error ? (
          <ErrorState message={overview.error} onRetry={overview.reload} />
        ) : (overview.data?.canals ?? []).length === 0 ? (
          <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
            {t("No canals to report against.")}
          </p>
        ) : (
          <ReportAnomalyForm
            canals={overview.data!.canals}
            onReported={anomalies.reload}
          />
        )}
      </div>
    </div>
  );
}

// ---------- Schedule ----------

function CanalScheduleTable() {
  const { t } = useLanguage();
  const { data, loading, error, reload } = useAuthedData(getCanalSchedule);

  if (loading) return <LoadingNote label={t("Loading schedule…")} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <div className="card">
        <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
          {t("No irrigation slots scheduled yet.")}
        </p>
      </div>
    );
  }

  return (
    <div className="dtable-wrap">
      <table className="dtable">
        <thead>
          <tr>
            <th>{t("Date")}</th>
            <th>{t("Time")}</th>
            <th>{t("Farmer")}</th>
            <th className="num">{t("Quantity")}</th>
            <th>{t("Status")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.schedule_id}>
              <td>{row.date}</td>
              <td>
                {row.start_time}–{row.end_time}
              </td>
              <td>{row.farmer_name}</td>
              <td className="num">{row.quantity}</td>
              <td>
                <Pill tone={statusTone(formatStatus(row.status))}>{t(formatStatus(row.status))}</Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Dashboard home ----------

function DashboardHome() {
  const { t } = useLanguage();
  const overview = useOverview();

  if (overview.loading) return <LoadingNote label={t("Loading canal state…")} />;
  if (overview.error) return <ErrorState message={overview.error} onRetry={overview.reload} />;
  if (!overview.data) return null;

  return (
    <>
      <div className="dash-block">
        <OverviewStats overview={overview.data} />
      </div>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>{t("Live canal monitoring")}</h3>
          <p>{overview.data.dam.name}</p>
        </div>
        <CanalMonitoringTable canals={overview.data.canals} />
      </div>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>{t("Farmer allocation")}</h3>
        </div>
        <AllocationTable />
      </div>
    </>
  );
}

// ---------- Page shell ----------

const SECTION_META: Record<string, { title: string; subtitle: string }> = {
  "/app/jal-vigyani": {
    title: "Canal state",
    subtitle: "Ground evidence, allocation, and conflict monitoring.",
  },
  "/app/jal-vigyani/farmers": {
    title: "Farmers",
    subtitle: "Assign a canal to unassigned or existing farmers on this dam.",
  },
  "/app/jal-vigyani/monitoring": {
    title: "Live canal monitoring",
    subtitle: "Per-canal flow, level, and capacity, plus flow measurements.",
  },
  "/app/jal-vigyani/allocations": {
    title: "Farmer allocations",
    subtitle: "Requested, allocated and delivered water per farmer.",
  },
  "/app/jal-vigyani/conflicts": {
    title: "Conflict management",
    subtitle: "Review proposals and resolve competing demands.",
  },
  "/app/jal-vigyani/anomalies": {
    title: "Anomalies",
    subtitle: "Under-delivery and water-loss investigation.",
  },
  "/app/jal-vigyani/schedule": {
    title: "Canal schedule",
    subtitle: "Slot-wise water distribution plan.",
  },
  "/app/jal-vigyani/twin": {
    title: "Digital Twin",
    subtitle: "Dam, canals and farm plots — live from the network state.",
  },
  "/app/jal-vigyani/help": {
    title: "Help",
    subtitle: "Support for canal monitoring and escalation.",
  },
};

export function JalVigyaniDashboardPage() {
  const location = useLocation();
  const { t } = useLanguage();
  const meta = SECTION_META[location.pathname] ?? SECTION_META["/app/jal-vigyani"];

  return (
    <DashboardShell
      roleLabel="Jal Vigyani"
      title={t(meta.title)}
      subtitle={t(meta.subtitle)}
      navItems={JAL_VIGYANI_NAV}
    >
      <Routes>
        <Route index element={<DashboardHome />} />
        <Route path="farmers" element={<FarmersSection />} />
        <Route path="monitoring" element={<MonitoringSection />} />
        <Route
          path="allocations"
          element={
            <div className="dash-block">
              <AllocationTable />
            </div>
          }
        />
        <Route
          path="conflicts"
          element={
            <div className="dash-block">
              <ConflictList />
            </div>
          }
        />
        <Route path="anomalies" element={<AnomalyPanels />} />
        <Route
          path="schedule"
          element={
            <div className="dash-block">
              <CanalScheduleTable />
            </div>
          }
        />
        <Route path="twin" element={<DigitalTwin3D />} />
        <Route
          path="help"
          element={
            <div className="dash-block">
              <div className="card">
                <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
                  {t("Contact the system administrator for sensor issues or escalate unresolved conflicts to the canal authority.")}
                </p>
              </div>
            </div>
          }
        />
        <Route path="*" element={<Navigate to="/app/jal-vigyani" replace />} />
      </Routes>
    </DashboardShell>
  );
}
