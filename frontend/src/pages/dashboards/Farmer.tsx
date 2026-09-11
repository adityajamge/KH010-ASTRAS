import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import { DashboardShell, FARMER_NAV } from "../../components/DashboardShell";
import { Pill } from "../../components/dashboard/Pill";
import { DigitalTwin3D } from "../../components/twin/DigitalTwin3D";
import {
  ApiError,
  OBJECTION_REASON_BY_LABEL,
  acceptProposal,
  getFarmerDashboard,
  getMediation,
  submitObjection,
  submitWaterRequest,
  type AcceptResult,
  type FarmerDashboardSummary,
  type MediationView,
  type ObjectionResult,
} from "../../lib/api";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sept", "Oct", "Nov", "Dec",
];

function fmtQty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** "2026-09-12" -> "12 Sept" (parsed as local date, no timezone shift). */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

/** "06:00:00" -> "06:00". */
function fmtTime(t: string): string {
  return t.slice(0, 5);
}

/** ISO datetime -> "12 Sept · 10:39" in client-local time. */
function fmtDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} · ${hh}:${mm}`;
}

function useDisplayName(): string {
  const { user } = useUser();
  return (
    user?.firstName ||
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "Farmer"
  );
}

interface FarmerData {
  summary: FarmerDashboardSummary | null;
  mediation: MediationView | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function useFarmerData(): FarmerData {
  const { getToken } = useAuth();
  const [summary, setSummary] = useState<FarmerDashboardSummary | null>(null);
  const [mediation, setMediation] = useState<MediationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Could not verify your session. Please sign in again.");
        const [dashboard, mediationView] = await Promise.all([
          getFarmerDashboard(token),
          getMediation(token),
        ]);
        if (!cancelled) {
          setSummary(dashboard);
          setMediation(mediationView);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Could not reach JalSetu. Please try again.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { summary, mediation, loading, error, reload };
}

function PageState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) {
    return (
      <div className="dash-block">
        <div className="card">
          <p className="hero-note">Loading your water status…</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="dash-block">
        <div className="card">
          <p className="negotiation-reason">{error}</p>
          <div className="home-card-actions">
            <button type="button" className="btn btn-secondary btn-xs" onClick={onRetry}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function MediationPanel({
  mediation,
  onChanged,
}: {
  mediation: MediationView;
  onChanged: () => void;
}) {
  const { getToken } = useAuth();
  const [objecting, setObjecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<ObjectionResult | null>(null);
  const [acceptance, setAcceptance] = useState<AcceptResult | null>(null);

  if (!mediation.has_proposal) {
    return (
      <div>
        <p className="negotiation-reason">
          No proposal yet — submit a water request to get your first allocation.
        </p>
        <div className="home-card-actions">
          <Link className="btn btn-primary btn-xs" to="/app/farmer/request">
            Request Water
          </Link>
        </div>
      </div>
    );
  }

  const accepted = mediation.status === "accepted" || acceptance !== null;

  async function act(fn: (token: string) => Promise<ObjectionResult | AcceptResult>) {
    setBusy(true);
    setActionError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Could not verify your session. Please sign in again.");
      const out = await fn(token);
      if ("agreement" in out) {
        setAcceptance(out as AcceptResult);
      } else {
        setResult(out as ObjectionResult);
      }
      onChanged();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="negotiation-panel">
      <div className="negotiation-row">
        <span>Your request</span>
        <span className="val">{fmtQty(mediation.requested)} units</span>
      </div>
      <div className="negotiation-row">
        <span>Allocated</span>
        <span className="val">
          {fmtQty(result?.allocated ?? mediation.allocated)} units
        </span>
      </div>
      {mediation.reason && (
        <p className="negotiation-reason">Reason: {mediation.reason}</p>
      )}
      {mediation.conflict_code && (
        <p className="negotiation-reason">Conflict: {mediation.conflict_code}</p>
      )}

      {accepted ? (
        <p className="negotiation-reason">
          Accepted
          {acceptance
            ? ` — agreement ${acceptance.agreement.agreement_code} recorded (version ${acceptance.agreement.version}).`
            : "."}
        </p>
      ) : !objecting && !result ? (
        <div className="negotiation-actions">
          <button
            type="button"
            className="btn btn-primary btn-xs"
            disabled={busy}
            onClick={() => act((token) => acceptProposal(token))}
          >
            Accept
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            disabled={busy}
            onClick={() => setObjecting(true)}
          >
            Object
          </button>
        </div>
      ) : (
        <>
          <div className="objection-options">
            {mediation.objection_options.map((option) => (
              <button
                key={option}
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => {
                  const reason = OBJECTION_REASON_BY_LABEL[option] ?? "OTHER";
                  setObjecting(false);
                  void act((token) => submitObjection(token, reason));
                }}
              >
                {option}
              </button>
            ))}
          </div>
          {result && (
            <>
              <p className="negotiation-reason">
                {result.changed
                  ? `Revised proposal: ${fmtQty(result.allocated)} units (was ${fmtQty(result.previous_allocated)}).`
                  : "Proposal unchanged — supply and priority constraints leave no room."}
              </p>
              {result.evidence.length > 0 && (
                <ul className="plain-list" style={{ marginTop: 12 }}>
                  {result.evidence.map((line) => (
                    <li key={line}>
                      <span className="check-mark" aria-hidden="true" />
                      <span className="activity-title">{line}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="negotiation-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-xs"
                  disabled={busy}
                  onClick={() => act((token) => acceptProposal(token))}
                >
                  Accept
                </button>
              </div>
            </>
          )}
        </>
      )}

      {mediation.evidence.length > 0 && !result && (
        <ul className="plain-list" style={{ marginTop: 12 }}>
          {mediation.evidence.map((line) => (
            <li key={line}>
              <span className="check-mark" aria-hidden="true" />
              <span className="activity-title">{line}</span>
            </li>
          ))}
        </ul>
      )}
      {actionError && <p className="field-error">{actionError}</p>}
    </div>
  );
}

function DashboardHome({ data }: { data: FarmerData }) {
  const { summary, mediation, loading, error, reload } = data;
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  const firstSlot = summary.upcoming_schedules[0];

  return (
    <>
      <div className="home-stats">
        <div className="home-stat">
          <p className="home-stat-label">Available</p>
          <p className="home-stat-value">{fmtQty(summary.available_water)} L</p>
        </div>
        <div className="home-stat">
          <p className="home-stat-label">Allocated</p>
          <p className="home-stat-value">{fmtQty(summary.allocated_water)} L</p>
        </div>
        <div className="home-stat">
          <p className="home-stat-label">Remaining</p>
          <p className="home-stat-value">{fmtQty(summary.remaining_water)} L</p>
        </div>
      </div>

      <div className="home-grid">
        <section className="home-card" aria-label="Current allocation">
          <h2>Current Allocation</h2>
          {summary.current_allocation && summary.current_request ? (
            <>
              <p className="home-card-crop">{summary.current_request.crop}</p>
              <p className="home-card-big">
                {fmtQty(summary.current_allocation.allocated_quantity)} /{" "}
                {fmtQty(summary.current_request.quantity_requested)} units
              </p>
              <p className="home-card-meta">
                {fmtDate(summary.current_allocation.allocation_date)} ·{" "}
                {fmtTime(summary.current_allocation.time_start)}–
                {fmtTime(summary.current_allocation.time_end)}
              </p>
              <p className="home-card-meta">Canal {summary.canal_name ?? "—"}</p>
            </>
          ) : (
            <p className="negotiation-reason">No allocation yet.</p>
          )}
          <div className="home-card-actions">
            <Link className="btn btn-secondary btn-xs" to="/app/farmer/allocation">
              View Allocation
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label="JalSetu mediation">
          <h2>JalSetu Mediation</h2>
          {mediation && mediation.has_proposal ? (
            <>
              <div className="negotiation-row">
                <span>Your request</span>
                <span className="val">{fmtQty(mediation.requested)} units</span>
              </div>
              <div className="negotiation-row">
                <span>Allocated</span>
                <span className="val">{fmtQty(mediation.allocated)} units</span>
              </div>
            </>
          ) : (
            <p className="negotiation-reason">No proposal yet.</p>
          )}
          <div className="home-card-actions">
            <Link className="btn btn-secondary btn-xs" to="/app/farmer/mediation">
              Open Mediation
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label="Today's schedule">
          <h2>Today&apos;s Schedule</h2>
          {firstSlot ? (
            <>
              <div className="timeline">
                <div className="timeline-row">
                  <span className="timeline-time">{fmtTime(firstSlot.start_time)}</span>
                  <span className="timeline-line" aria-hidden="true" />
                </div>
                <div className="timeline-marker" aria-hidden="true">
                  <span className="timeline-drop" />
                </div>
                <div className="timeline-row">
                  <span className="timeline-time">{fmtTime(firstSlot.end_time)}</span>
                  <span className="timeline-line" aria-hidden="true" />
                </div>
              </div>
              <p className="home-card-meta">Canal {summary.canal_name ?? "—"}</p>
              <p className="home-card-meta">
                {fmtDate(firstSlot.date)} · {firstSlot.status}
              </p>
            </>
          ) : (
            <p className="negotiation-reason">No slots scheduled yet.</p>
          )}
          <div className="home-card-actions">
            <Link className="btn btn-secondary btn-xs" to="/app/farmer/schedule">
              View Schedule
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label="Delivery status">
          <h2>Delivery Status</h2>
          {summary.delivery ? (
            <DeliverySummary
              authorized={summary.delivery.allocated_quantity}
              delivered={summary.delivery.delivered_quantity}
            />
          ) : (
            <p className="negotiation-reason">No deliveries yet.</p>
          )}
          <div className="home-card-actions">
            <Link className="btn btn-secondary btn-xs" to="/app/farmer/delivery">
              View Delivery
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label="Weather and water">
          <h2>Weather / Water</h2>
          <ul className="plain-list">
            {summary.advisory.lines.map((line, i) => (
              <li key={`${i}-${line}`}>
                <span
                  className={`status-dot${summary.advisory.has_conflict && i === 2 ? " warn" : " ok"}`}
                  aria-hidden="true"
                />
                {line}
              </li>
            ))}
          </ul>
          <div className="home-card-actions">
            <Link className="btn btn-secondary btn-xs" to="/app/farmer/alerts">
              View Alerts
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label="Recent activity">
          <h2>Recent Activity</h2>
          {summary.recent_activity.length > 0 ? (
            <ul className="plain-list">
              {summary.recent_activity.map((item) => (
                <li key={`${item.title}-${item.created_at}`}>
                  <span className="check-mark" aria-hidden="true" />
                  <span>
                    <span className="activity-title">{item.title}</span>
                    <span className="activity-meta">{item.meta}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="negotiation-reason">No activity yet.</p>
          )}
          <div className="home-card-actions">
            <Link className="btn btn-secondary btn-xs" to="/app/farmer/history">
              View History
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

function DeliverySummary({ authorized, delivered }: { authorized: number; delivered: number }) {
  const shortfall = Math.max(0, authorized - delivered);
  const pct = authorized > 0 ? Math.round((delivered / authorized) * 100) : 0;
  return (
    <>
      <div className="negotiation-row">
        <span>Authorized</span>
        <span className="val">{fmtQty(authorized)} units</span>
      </div>
      <div
        className="delivery-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Delivered progress"
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="negotiation-row">
        <span>Delivered</span>
        <span className="val">{fmtQty(delivered)} units</span>
      </div>
      <p className="negotiation-reason">Shortfall: {fmtQty(shortfall)} units</p>
    </>
  );
}

function RequestSection({ data }: { data: FarmerData }) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [quantity, setQuantity] = useState("400");
  const [requestDate, setRequestDate] = useState(today);
  const [preferredTime, setPreferredTime] = useState("morning");
  const [duration, setDuration] = useState("2");
  const [crop, setCrop] = useState(data.summary?.current_request?.crop ?? "");
  const [urgency, setUrgency] = useState("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const qty = Number(quantity);
    const hrs = Number(duration);
    if (!Number.isFinite(qty) || qty <= 0 || !requestDate || !crop.trim()) {
      setError("Please fill in quantity, date, and crop.");
      return;
    }
    if (!Number.isFinite(hrs) || hrs <= 0) {
      setError("Duration must be greater than 0.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Could not verify your session. Please sign in again.");
      await submitWaterRequest(token, {
        quantity_requested: qty,
        request_date: requestDate,
        preferred_time: preferredTime,
        duration_hours: hrs,
        crop: crop.trim(),
        urgency: urgency as "normal" | "high" | "critical",
      });
      data.reload();
      navigate("/app/farmer/allocation");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not submit. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dash-block">
      <div className="card">
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="qty">Quantity (units)</label>
            <input
              id="qty"
              type="number"
              value={quantity}
              min={0}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="time">Preferred time</label>
            <select
              id="time"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
            >
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="duration">Duration (hrs)</label>
            <input
              id="duration"
              type="number"
              value={duration}
              min={1}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="crop">Crop</label>
            <input
              id="crop"
              value={crop}
              placeholder="e.g. Sugarcane"
              onChange={(e) => setCrop(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="urgency">Urgency</label>
            <select
              id="urgency"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical — crop stress</option>
            </select>
          </div>
          {error && (
            <p className="field-error" style={{ gridColumn: "1 / -1" }}>
              {error}
            </p>
          )}
          <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AllocationSection({ data }: { data: FarmerData }) {
  const { summary, loading, error, reload } = data;
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  const allocation = summary.current_allocation;
  const request = summary.current_request;
  if (!allocation || !request) {
    return (
      <div className="dash-block">
        <div className="card">
          <p className="negotiation-reason">No allocation yet — submit a water request first.</p>
          <div className="home-card-actions">
            <Link className="btn btn-primary btn-xs" to="/app/farmer/request">
              Request Water
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="dash-block">
      <div className="dash-block-head">
        <Pill>{allocation.status}</Pill>
      </div>
      <div className="card">
        <div className="negotiation-row">
          <span>Requested</span>
          <span className="val">{fmtQty(request.quantity_requested)} units</span>
        </div>
        <div className="negotiation-row">
          <span>Allocated</span>
          <span className="val">{fmtQty(allocation.allocated_quantity)} units</span>
        </div>
        <div className="negotiation-row">
          <span>Date</span>
          <span className="val">{fmtDate(allocation.allocation_date)}</span>
        </div>
        <div className="negotiation-row">
          <span>Time slot</span>
          <span className="val">
            {fmtTime(allocation.time_start)}–{fmtTime(allocation.time_end)}
          </span>
        </div>
        <div className="negotiation-row">
          <span>Canal</span>
          <span className="val">{summary.canal_name ?? "—"}</span>
        </div>
        {allocation.reason && (
          <p className="negotiation-reason">Reason for adjustment: {allocation.reason}</p>
        )}
      </div>
    </div>
  );
}

function MediationSection({ data }: { data: FarmerData }) {
  const { mediation, loading, error, reload } = data;
  if (loading || error || !mediation) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  return (
    <div className="dash-block">
      <MediationPanel mediation={mediation} onChanged={reload} />
    </div>
  );
}

function ScheduleTable({ rows }: { rows: FarmerDashboardSummary["upcoming_schedules"] }) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <p className="negotiation-reason">No slots scheduled yet.</p>
      </div>
    );
  }
  return (
    <div className="dtable-wrap">
      <table className="dtable">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th className="num">Quantity</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{fmtDate(row.date)}</td>
              <td>
                {fmtTime(row.start_time)}–{fmtTime(row.end_time)}
              </td>
              <td className="num">{fmtQty(row.quantity)}</td>
              <td>
                <Pill>{row.status}</Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduleSection({ data }: { data: FarmerData }) {
  const { summary, loading, error, reload } = data;
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  const first = summary.upcoming_schedules[0];
  return (
    <div className="dash-block">
      {first && (
        <div className="home-card" style={{ marginBottom: 16 }}>
          <h2>Next Slot</h2>
          <div className="timeline">
            <div className="timeline-row">
              <span className="timeline-time">{fmtTime(first.start_time)}</span>
              <span className="timeline-line" aria-hidden="true" />
            </div>
            <div className="timeline-marker" aria-hidden="true">
              <span className="timeline-drop" />
            </div>
            <div className="timeline-row">
              <span className="timeline-time">{fmtTime(first.end_time)}</span>
              <span className="timeline-line" aria-hidden="true" />
            </div>
          </div>
          <p className="home-card-meta">
            {fmtDate(first.date)} · Canal {summary.canal_name ?? "—"}
          </p>
          <p className="home-card-meta">{first.status}</p>
        </div>
      )}
      <ScheduleTable rows={summary.upcoming_schedules} />
    </div>
  );
}

function DeliverySection({ data }: { data: FarmerData }) {
  const { summary, loading, error, reload } = data;
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  if (!summary.delivery) {
    return (
      <div className="dash-block">
        <div className="card">
          <p className="negotiation-reason">No deliveries recorded yet.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="dash-block">
      <div className="card">
        <DeliverySummary
          authorized={summary.delivery.allocated_quantity}
          delivered={summary.delivery.delivered_quantity}
        />
        <p className="negotiation-reason">Status: {summary.delivery.delivery_status}</p>
        <div className="home-card-actions">
          <button type="button" className="btn btn-secondary btn-xs">
            Report Issue
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertsSection({ data }: { data: FarmerData }) {
  const { summary, loading, error, reload } = data;
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  return (
    <>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Water status</h3>
        </div>
        <div className="card">
          <ul className="plain-list">
            {summary.advisory.lines.map((line, i) => (
              <li key={`${i}-${line}`}>
                <span
                  className={`status-dot${summary.advisory.has_conflict && i === 2 ? " warn" : " ok"}`}
                  aria-hidden="true"
                />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Notifications</h3>
        </div>
        {summary.notifications.length > 0 ? (
          <div className="notif-list">
            {summary.notifications.map((n) => (
              <div
                className={`notif-item${n.type === "warning" || n.type === "critical" ? " warn" : ""}`}
                key={n.id}
              >
                <span className="notif-icon" />
                <div className="notif-body">
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-meta">
                    {fmtDateTime(n.created_at)}
                    {n.message ? ` · ${n.message}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="negotiation-reason">No notifications yet.</p>
          </div>
        )}
      </div>
    </>
  );
}

function HistorySection({ data }: { data: FarmerData }) {
  const { summary, loading, error, reload } = data;
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  return (
    <>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Recent activity</h3>
        </div>
        {summary.recent_activity.length > 0 ? (
          <div className="card">
            <ul className="plain-list">
              {summary.recent_activity.map((item) => (
                <li key={`${item.title}-${item.created_at}`}>
                  <span className="check-mark" aria-hidden="true" />
                  <span>
                    <span className="activity-title">{item.title}</span>
                    <span className="activity-meta">{item.meta}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="card">
            <p className="negotiation-reason">No activity yet.</p>
          </div>
        )}
      </div>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Past requests</h3>
        </div>
        {summary.requests.length > 0 ? (
          <div className="dtable-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Quantity</th>
                  <th>Crop</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.requests.map((row) => (
                  <tr key={row.id}>
                    <td>{fmtDate(row.request_date)}</td>
                    <td className="num">{fmtQty(row.quantity_requested)}</td>
                    <td>{row.crop}</td>
                    <td>
                      <Pill>{row.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card">
            <p className="negotiation-reason">No requests yet.</p>
          </div>
        )}
      </div>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Schedules</h3>
        </div>
        <ScheduleTable rows={summary.upcoming_schedules} />
      </div>
    </>
  );
}

function HelpSection() {
  return (
    <div className="dash-block">
      <div className="card">
        <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
          Contact your Jal Vigyani for schedule changes or shortfall reports.
          For urgent crop stress, mark your next request as Critical so it is
          prioritized in mediation.
        </p>
      </div>
    </div>
  );
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  return "Good Evening";
}

const SECTION_META: Record<string, { title: (name: string) => string; subtitle: string }> = {
  "/app/farmer": {
    title: (name) => `${getTimeGreeting()}, ${name}`,
    subtitle: "Here's your water status for today",
  },
  "/app/farmer/request": {
    title: () => "Request water",
    subtitle: "Submit a new requirement for Canal A.",
  },
  "/app/farmer/allocation": {
    title: () => "My allocation",
    subtitle: "What was requested versus what was allocated.",
  },
  "/app/farmer/mediation": {
    title: () => "Negotiation center",
    subtitle: "Review the proposal and respond.",
  },
  "/app/farmer/schedule": {
    title: () => "Schedule",
    subtitle: "Your confirmed and upcoming water slots.",
  },
  "/app/farmer/delivery": {
    title: () => "Delivery status",
    subtitle: "Authorized versus actually delivered water.",
  },
  "/app/farmer/twin": {
    title: () => "Digital Twin",
    subtitle: "Dam, canal and farm plots — live from your network state.",
  },
  "/app/farmer/alerts": {
    title: () => "Alerts",
    subtitle: "Water status and system notifications.",
  },
  "/app/farmer/history": {
    title: () => "History",
    subtitle: "Past requests, allocations and schedules.",
  },
  "/app/farmer/help": {
    title: () => "Help",
    subtitle: "Get support for schedules and shortfalls.",
  },
};

export function FarmerDashboardPage() {
  const displayName = useDisplayName();
  const location = useLocation();
  const meta = SECTION_META[location.pathname] ?? SECTION_META["/app/farmer"];
  const data = useFarmerData();

  return (
    <DashboardShell
      roleLabel="Farmer"
      title={meta.title(displayName)}
      subtitle={meta.subtitle}
      navItems={FARMER_NAV}
    >
      <Routes>
        <Route index element={<DashboardHome data={data} />} />
        <Route path="request" element={<RequestSection data={data} />} />
        <Route path="allocation" element={<AllocationSection data={data} />} />
        <Route path="mediation" element={<MediationSection data={data} />} />
        <Route path="schedule" element={<ScheduleSection data={data} />} />
        <Route path="delivery" element={<DeliverySection data={data} />} />
        <Route path="twin" element={<DigitalTwin3D />} />
        <Route path="alerts" element={<AlertsSection data={data} />} />
        <Route path="history" element={<HistorySection data={data} />} />
        <Route path="help" element={<HelpSection />} />
        <Route path="*" element={<Navigate to="/app/farmer" replace />} />
      </Routes>
    </DashboardShell>
  );
}
