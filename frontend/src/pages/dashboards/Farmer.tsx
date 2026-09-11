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
import { Pill, statusTone } from "../../components/dashboard/Pill";
import { SlotTimeline, groupSchedulesByDate, useNow } from "../../components/dashboard/SlotTimeline";
import { fmtQty, fmtTime, formatStatus } from "../../lib/format";
import { useLanguage } from "../../lib/i18n";
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

/** "2026-09-12" -> "12 Sept" (parsed as local date, no timezone shift).
 * `t` translates just the month abbreviation; the day number stays as-is
 * (Hindi/Marathi UIs conventionally keep Arabic numerals). */
function fmtDate(iso: string, t: (key: string) => string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${t(MONTHS[m - 1])}`;
}

/** ISO datetime -> "12 Sept · 10:39" in client-local time. */
function fmtDateTime(iso: string, t: (key: string) => string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${dt.getDate()} ${t(MONTHS[dt.getMonth()])} · ${hh}:${mm}`;
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
  const { t } = useLanguage();
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
        if (!token) throw new Error(t("Could not verify your session. Please sign in again."));
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
              : t("Could not reach JalSetu. Please try again."),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { summary, mediation, loading, error, reload };
}

function PageState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  const { t } = useLanguage();
  if (loading) {
    return (
      <div className="dash-block">
        <div className="card">
          <p className="hero-note">{t("Loading your water status…")}</p>
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
              {t("Try again")}
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
  const { t, tf, lang } = useLanguage();
  const [objecting, setObjecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<ObjectionResult | null>(null);
  const [acceptance, setAcceptance] = useState<AcceptResult | null>(null);
  const [objectionDetails, setObjectionDetails] = useState("");

  if (!mediation.has_proposal) {
    return (
      <div>
        <p className="negotiation-reason">
          {t("No proposal yet — submit a water request to get your first allocation.")}
        </p>
        <div className="home-card-actions">
          <Link className="btn btn-primary btn-xs" to="/app/farmer/request">
            {t("Request Water")}
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
      if (!token) throw new Error(t("Could not verify your session. Please sign in again."));
      const out = await fn(token);
      if ("agreement" in out) {
        setAcceptance(out as AcceptResult);
      } else {
        setResult(out as ObjectionResult);
      }
      onChanged();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : t("Something went wrong. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="negotiation-panel">
      <div className="negotiation-row">
        <span>{t("Your request")}</span>
        <span className="val">
          {fmtQty(mediation.requested)} {t("units")}
        </span>
      </div>
      <div className="negotiation-row">
        <span>{t("Allocated")}</span>
        <span className="val">
          {fmtQty(result?.allocated ?? mediation.allocated)} {t("units")}
        </span>
      </div>
      {!result && mediation.mediator_message && (
        <p className="negotiation-reason mediator-message">{mediation.mediator_message}</p>
      )}
      {mediation.reason && (
        <p className="negotiation-reason">
          {t("Reason:")} {mediation.reason}
        </p>
      )}
      {mediation.conflict_code && (
        <p className="negotiation-reason">
          {t("Conflict:")} {mediation.conflict_code}
        </p>
      )}

      {accepted ? (
        <p className="negotiation-reason">
          {t("Accepted")}
          {acceptance
            ? " " +
              tf("— agreement {code} recorded (version {version}).", {
                code: acceptance.agreement.agreement_code,
                version: acceptance.agreement.version,
              })
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
            {t("Accept")}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            disabled={busy}
            onClick={() => setObjecting(true)}
          >
            {t("Object")}
          </button>
        </div>
      ) : (
        <>
          {!result && (
            <textarea
              className="objection-details"
              placeholder={t("Optional: describe your situation in your own words…")}
              value={objectionDetails}
              onChange={(e) => setObjectionDetails(e.target.value)}
              disabled={busy}
              rows={2}
            />
          )}
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
                  void act((token) =>
                    submitObjection(token, reason, objectionDetails.trim() || undefined, lang),
                  );
                }}
              >
                {t(option)}
              </button>
            ))}
          </div>
          {result && (
            <>
              {result.mediator_message ? (
                <p className="negotiation-reason mediator-message">
                  {result.mediator_message}
                </p>
              ) : (
                <p className="negotiation-reason">
                  {result.changed
                    ? tf("Revised proposal: {allocated} units (was {previous}).", {
                        allocated: fmtQty(result.allocated),
                        previous: fmtQty(result.previous_allocated),
                      })
                    : t("Proposal unchanged — supply and priority constraints leave no room.")}
                </p>
              )}
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
                  {t("Accept")}
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
  const now = useNow();
  const { t } = useLanguage();
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  const firstSlot = summary.upcoming_schedules[0];
  const todaysGroup = firstSlot
    ? groupSchedulesByDate(summary.upcoming_schedules).find((g) => g.date === firstSlot.date) ?? null
    : null;

  return (
    <>
      <div className="home-stats">
        <div className="home-stat">
          <p className="home-stat-label">{t("Available")}</p>
          <p className="home-stat-value">{fmtQty(summary.available_water)} L</p>
        </div>
        <div className="home-stat">
          <p className="home-stat-label">{t("Allocated")}</p>
          <p className="home-stat-value">{fmtQty(summary.allocated_water)} L</p>
        </div>
        <div className="home-stat">
          <p className="home-stat-label">{t("Remaining")}</p>
          <p className="home-stat-value">{fmtQty(summary.remaining_water)} L</p>
        </div>
      </div>

      <div className="home-grid">
        <section className="home-card" aria-label={t("Current allocation")}>
          <h2>{t("Current Allocation")}</h2>
          {summary.current_allocation && summary.current_request ? (
            <>
              <p className="home-card-crop">{summary.current_request.crop}</p>
              <p className="home-card-big">
                {fmtQty(summary.current_allocation.allocated_quantity)} /{" "}
                {fmtQty(summary.current_request.quantity_requested)} {t("units")}
              </p>
              <p className="home-card-meta">
                {fmtDate(summary.current_allocation.allocation_date, t)} ·{" "}
                {fmtTime(summary.current_allocation.time_start)}–
                {fmtTime(summary.current_allocation.time_end)}
              </p>
              <p className="home-card-meta">
                {t("Canal")} {summary.canal_name ?? "—"}
              </p>
            </>
          ) : (
            <p className="negotiation-reason">{t("No allocation yet.")}</p>
          )}
          <div className="home-card-actions">
            <Link className="btn btn-secondary btn-xs" to="/app/farmer/allocation">
              {t("View Allocation")}
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label={t("JalSetu mediation")}>
          <h2>{t("JalSetu Mediation")}</h2>
          {mediation && mediation.has_proposal ? (
            <>
              <div className="negotiation-row">
                <span>{t("Your request")}</span>
                <span className="val">
                  {fmtQty(mediation.requested)} {t("units")}
                </span>
              </div>
              <div className="negotiation-row">
                <span>{t("Allocated")}</span>
                <span className="val">
                  {fmtQty(mediation.allocated)} {t("units")}
                </span>
              </div>
            </>
          ) : (
            <p className="negotiation-reason">{t("No proposal yet.")}</p>
          )}
          <div className="home-card-actions">
            <Link className="btn btn-secondary btn-xs" to="/app/farmer/mediation">
              {t("Open Mediation")}
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label={t("Today's schedule")}>
          <h2>{t("Today's Schedule")}</h2>
          {firstSlot ? (
            <>
              <SlotTimeline
                date={todaysGroup?.date ?? firstSlot.date}
                slots={todaysGroup?.slots ?? [firstSlot]}
                now={now}
              />
              <p className="home-card-meta">
                {t("Canal")} {summary.canal_name ?? "—"}
              </p>
              <p className="home-card-meta">{fmtDate(firstSlot.date, t)}</p>
            </>
          ) : (
            <p className="negotiation-reason">{t("No slots scheduled yet.")}</p>
          )}
          <div className="home-card-actions">
            <Link className="btn btn-secondary btn-xs" to="/app/farmer/schedule">
              {t("View Schedule")}
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label={t("Delivery status")}>
          <h2>{t("Delivery Status")}</h2>
          {summary.delivery ? (
            <DeliverySummary
              authorized={summary.delivery.allocated_quantity}
              delivered={summary.delivery.delivered_quantity}
            />
          ) : (
            <p className="negotiation-reason">{t("No deliveries yet.")}</p>
          )}
          <div className="home-card-actions">
            <Link className="btn btn-secondary btn-xs" to="/app/farmer/delivery">
              {t("View Delivery")}
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label={t("Weather and water")}>
          <h2>{t("Weather / Water")}</h2>
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
              {t("View Alerts")}
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label={t("Recent activity")}>
          <h2>{t("Recent Activity")}</h2>
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
            <p className="negotiation-reason">{t("No activity yet.")}</p>
          )}
          <div className="home-card-actions">
            <Link className="btn btn-secondary btn-xs" to="/app/farmer/history">
              {t("View History")}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

function DeliverySummary({ authorized, delivered }: { authorized: number; delivered: number }) {
  const { t } = useLanguage();
  const shortfall = Math.max(0, authorized - delivered);
  const pct = authorized > 0 ? Math.round((delivered / authorized) * 100) : 0;
  return (
    <>
      <div className="negotiation-row">
        <span>{t("Authorized")}</span>
        <span className="val">
          {fmtQty(authorized)} {t("units")}
        </span>
      </div>
      <div
        className="delivery-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("Delivered progress")}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="negotiation-row">
        <span>{t("Delivered")}</span>
        <span className="val">
          {fmtQty(delivered)} {t("units")}
        </span>
      </div>
      <p className="negotiation-reason">
        {t("Shortfall:")} {fmtQty(shortfall)} {t("units")}
      </p>
    </>
  );
}

function RequestSection({ data }: { data: FarmerData }) {
  const { getToken } = useAuth();
  const { t } = useLanguage();
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
      setError(t("Please fill in quantity, date, and crop."));
      return;
    }
    if (!Number.isFinite(hrs) || hrs <= 0) {
      setError(t("Duration must be greater than 0."));
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t("Could not verify your session. Please sign in again."));
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
        err instanceof ApiError ? err.message : t("Could not submit. Please try again."),
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
            <label htmlFor="qty">{t("Quantity (units)")}</label>
            <input
              id="qty"
              type="number"
              value={quantity}
              min={0}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="date">{t("Date")}</label>
            <input
              id="date"
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="time">{t("Preferred time")}</label>
            <select
              id="time"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
            >
              <option value="morning">{t("Morning")}</option>
              <option value="afternoon">{t("Afternoon")}</option>
              <option value="evening">{t("Evening")}</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="duration">{t("Duration (hrs)")}</label>
            <input
              id="duration"
              type="number"
              value={duration}
              min={1}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="crop">{t("Crop")}</label>
            <input
              id="crop"
              value={crop}
              placeholder={t("e.g. Sugarcane")}
              onChange={(e) => setCrop(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="urgency">{t("Urgency")}</label>
            <select
              id="urgency"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
            >
              <option value="normal">{t("Normal")}</option>
              <option value="high">{t("High")}</option>
              <option value="critical">{t("Critical — crop stress")}</option>
            </select>
          </div>
          {error && (
            <p className="field-error" style={{ gridColumn: "1 / -1" }}>
              {error}
            </p>
          )}
          <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t("Submitting…") : t("Submit request")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AllocationSection({ data }: { data: FarmerData }) {
  const { summary, loading, error, reload } = data;
  const { t } = useLanguage();
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  const allocation = summary.current_allocation;
  const request = summary.current_request;
  if (!allocation || !request) {
    return (
      <div className="dash-block">
        <div className="card">
          <p className="negotiation-reason">{t("No allocation yet — submit a water request first.")}</p>
          <div className="home-card-actions">
            <Link className="btn btn-primary btn-xs" to="/app/farmer/request">
              {t("Request Water")}
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="dash-block">
      <div className="dash-block-head">
        <Pill tone={statusTone(allocation.status)}>{t(formatStatus(allocation.status))}</Pill>
      </div>
      <div className="card">
        <div className="negotiation-row">
          <span>{t("Requested")}</span>
          <span className="val">
            {fmtQty(request.quantity_requested)} {t("units")}
          </span>
        </div>
        <div className="negotiation-row">
          <span>{t("Allocated")}</span>
          <span className="val">
            {fmtQty(allocation.allocated_quantity)} {t("units")}
          </span>
        </div>
        <div className="negotiation-row">
          <span>{t("Date")}</span>
          <span className="val">{fmtDate(allocation.allocation_date, t)}</span>
        </div>
        <div className="negotiation-row">
          <span>{t("Time slot")}</span>
          <span className="val">
            {fmtTime(allocation.time_start)}–{fmtTime(allocation.time_end)}
          </span>
        </div>
        <div className="negotiation-row">
          <span>{t("Canal")}</span>
          <span className="val">{summary.canal_name ?? "—"}</span>
        </div>
        {allocation.reason && (
          <p className="negotiation-reason">
            {t("Reason for adjustment:")} {allocation.reason}
          </p>
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
  const { t } = useLanguage();
  if (rows.length === 0) {
    return (
      <div className="card">
        <p className="negotiation-reason">{t("No slots scheduled yet.")}</p>
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
            <th className="num">{t("Quantity")}</th>
            <th>{t("Status")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{fmtDate(row.date, t)}</td>
              <td>
                {fmtTime(row.start_time)}–{fmtTime(row.end_time)}
              </td>
              <td className="num">{fmtQty(row.quantity)}</td>
              <td>
                <Pill tone={statusTone(row.status)}>{t(formatStatus(row.status))}</Pill>
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
  const now = useNow();
  const { t } = useLanguage();
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  const groups = groupSchedulesByDate(summary.upcoming_schedules);
  return (
    <div className="dash-block">
      {groups.length > 0 && (
        <div className="home-card" style={{ marginBottom: 16 }}>
          <h2>{t("Upcoming slots")}</h2>
          {groups.map((group) => (
            <div className="slot-chart-group" key={group.date}>
              <p className="home-card-meta">
                {fmtDate(group.date, t)} · {t("Canal")} {summary.canal_name ?? "—"}
              </p>
              <SlotTimeline date={group.date} slots={group.slots} now={now} />
            </div>
          ))}
        </div>
      )}
      <ScheduleTable rows={summary.upcoming_schedules} />
    </div>
  );
}

function DeliverySection({ data }: { data: FarmerData }) {
  const { summary, loading, error, reload } = data;
  const { t } = useLanguage();
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  if (!summary.delivery) {
    return (
      <div className="dash-block">
        <div className="card">
          <p className="negotiation-reason">{t("No deliveries recorded yet.")}</p>
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
        <p className="negotiation-reason">
          {t("Status:")} {t(formatStatus(summary.delivery.delivery_status))}
        </p>
        <div className="home-card-actions">
          <button type="button" className="btn btn-secondary btn-xs">
            {t("Report Issue")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertsSection({ data }: { data: FarmerData }) {
  const { summary, loading, error, reload } = data;
  const { t } = useLanguage();
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  return (
    <>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>{t("Water status")}</h3>
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
          <h3>{t("Notifications")}</h3>
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
                    {fmtDateTime(n.created_at, t)}
                    {n.message ? ` · ${n.message}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="negotiation-reason">{t("No notifications yet.")}</p>
          </div>
        )}
      </div>
    </>
  );
}

function HistorySection({ data }: { data: FarmerData }) {
  const { summary, loading, error, reload } = data;
  const { t } = useLanguage();
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  return (
    <>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>{t("Recent activity")}</h3>
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
            <p className="negotiation-reason">{t("No activity yet.")}</p>
          </div>
        )}
      </div>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>{t("Past requests")}</h3>
        </div>
        {summary.requests.length > 0 ? (
          <div className="dtable-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th>{t("Date")}</th>
                  <th className="num">{t("Quantity")}</th>
                  <th>{t("Crop")}</th>
                  <th>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.requests.map((row) => (
                  <tr key={row.id}>
                    <td>{fmtDate(row.request_date, t)}</td>
                    <td className="num">{fmtQty(row.quantity_requested)}</td>
                    <td>{row.crop}</td>
                    <td>
                      <Pill tone={statusTone(row.status)}>{t(formatStatus(row.status))}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card">
            <p className="negotiation-reason">{t("No requests yet.")}</p>
          </div>
        )}
      </div>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>{t("Schedules")}</h3>
        </div>
        <ScheduleTable rows={summary.upcoming_schedules} />
      </div>
    </>
  );
}

function HelpSection() {
  const { t } = useLanguage();
  return (
    <div className="dash-block">
      <div className="card">
        <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
          {t(
            "Contact your Jal Vigyani for schedule changes or shortfall reports. For urgent crop stress, mark your next request as Critical so it is prioritized in mediation.",
          )}
        </p>
      </div>
    </div>
  );
}

function slotLabel(hour: number): string {
  if (hour < 12) return "Morning slot";
  if (hour < 17) return "Afternoon slot";
  return "Evening slot";
}

function useSidebarFooter(summary: FarmerDashboardSummary | null): {
  title: string;
  subtitle: string;
  canalName: string | null;
} {
  const { t } = useLanguage();
  const canalName = summary?.canal_name ?? null;
  const nextSlot = summary?.upcoming_schedules[0];
  const slot = t(nextSlot ? slotLabel(Number(nextSlot.start_time.slice(0, 2))) : "No slot scheduled");
  return {
    title: canalName ?? t("No canal assigned"),
    subtitle: `${summary?.village_name ?? ""} · ${slot}`,
    canalName,
  };
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  return "Good Evening";
}

const SECTION_META: Record<
  string,
  {
    title: (name: string, t: (key: string) => string) => string;
    subtitle: (canalName: string | null, t: (key: string) => string) => string;
  }
> = {
  "/app/farmer": {
    title: (name, t) => `${t(getTimeGreeting())}, ${name}`,
    subtitle: (_canalName, t) => t("Here's your water status for today"),
  },
  "/app/farmer/request": {
    title: (_name, t) => t("Request water"),
    subtitle: (canalName, t) =>
      canalName
        ? t("Submit a new requirement for {canal}.").replace("{canal}", canalName)
        : t("Submit a new requirement — you'll need a canal assigned first."),
  },
  "/app/farmer/allocation": {
    title: (_name, t) => t("My allocation"),
    subtitle: (_canalName, t) => t("What was requested versus what was allocated."),
  },
  "/app/farmer/mediation": {
    title: (_name, t) => t("Negotiation center"),
    subtitle: (_canalName, t) => t("Review the proposal and respond."),
  },
  "/app/farmer/schedule": {
    title: (_name, t) => t("Schedule"),
    subtitle: (_canalName, t) => t("Your confirmed and upcoming water slots."),
  },
  "/app/farmer/delivery": {
    title: (_name, t) => t("Delivery status"),
    subtitle: (_canalName, t) => t("Authorized versus actually delivered water."),
  },
  "/app/farmer/alerts": {
    title: (_name, t) => t("Alerts"),
    subtitle: (_canalName, t) => t("Water status and system notifications."),
  },
  "/app/farmer/history": {
    title: (_name, t) => t("History"),
    subtitle: (_canalName, t) => t("Past requests, allocations and schedules."),
  },
  "/app/farmer/help": {
    title: (_name, t) => t("Help"),
    subtitle: (_canalName, t) => t("Get support for schedules and shortfalls."),
  },
};

export function FarmerDashboardPage() {
  const displayName = useDisplayName();
  const location = useLocation();
  const { t } = useLanguage();
  const meta = SECTION_META[location.pathname] ?? SECTION_META["/app/farmer"];
  const data = useFarmerData();
  const footer = useSidebarFooter(data.summary);

  return (
    <DashboardShell
      roleLabel="Farmer"
      title={meta.title(displayName, t)}
      subtitle={meta.subtitle(footer.canalName, t)}
      navItems={FARMER_NAV}
      footer={footer}
    >
      <Routes>
        <Route index element={<DashboardHome data={data} />} />
        <Route path="request" element={<RequestSection data={data} />} />
        <Route path="allocation" element={<AllocationSection data={data} />} />
        <Route path="mediation" element={<MediationSection data={data} />} />
        <Route path="schedule" element={<ScheduleSection data={data} />} />
        <Route path="delivery" element={<DeliverySection data={data} />} />
        <Route path="alerts" element={<AlertsSection data={data} />} />
        <Route path="history" element={<HistorySection data={data} />} />
        <Route path="help" element={<HelpSection />} />
        <Route path="*" element={<Navigate to="/app/farmer" replace />} />
      </Routes>
    </DashboardShell>
  );
}
