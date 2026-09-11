import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { DashboardShell, DAM_NAV } from "../../components/DashboardShell";
import { StatGrid } from "../../components/dashboard/StatGrid";
import { Pill } from "../../components/dashboard/Pill";
import {
  ApiError,
  getDamDashboard,
  publishSupplyState,
  type DamDashboardSummary,
  type FlowChainRead,
} from "../../lib/api";

interface DamData {
  summary: DamDashboardSummary | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function useDamData(): DamData {
  const { getToken } = useAuth();
  const [summary, setSummary] = useState<DamDashboardSummary | null>(null);
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
        const data = await getDamDashboard(token);
        if (!cancelled) setSummary(data);
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

  return { summary, loading, error, reload };
}

function PageState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) {
    return (
      <div className="dash-block">
        <div className="card">
          <p className="hero-note">Loading supply state…</p>
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

function fmtNum(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("en-IN")
    : value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function ReservoirPanel({ chain }: { chain?: FlowChainRead }) {
  if (!chain) {
    return (
      <div className="card">
        <p className="hero-note">Loading flow chain…</p>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="flow-chain">
        {chain.stages.map((stage, i) => (
          <div className="flow-stage" key={stage.label}>
            <div className="flow-stage-head">
              <span className="flow-stage-label">{stage.label}</span>
              <span className="flow-stage-value">{fmtNum(stage.value)}</span>
            </div>
            {stage.note && <p className="flow-stage-note">{stage.note}</p>}
            {i < chain.stages.length - 1 && (
              <span className="flow-arrow" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
      {chain.alert && chain.alert_note && (
        <p className="field-error" style={{ marginBottom: 0 }}>
          {chain.alert_note}
        </p>
      )}
      {!chain.alert && (
        <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
          Differences within tolerance — no canal-level investigation needed.
        </p>
      )}
    </div>
  );
}

function RainfallPanel({ data }: { data: DamData }) {
  const { summary, loading, error, reload } = data;
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  return (
    <div className="card">
      <div className="negotiation-row">
        <span>Last 24 hours</span>
        <span className="val">{fmtNum(summary.rainfall.last_24h)} mm</span>
      </div>
      <div className="negotiation-row">
        <span>Catchment affected</span>
        <span className="val">{summary.rainfall.catchment}</span>
      </div>
      <p className="negotiation-reason">Forecast: {summary.rainfall.forecast}. Rainfall triggers a
        recalculation rather than automatically reducing every farmer&apos;s
        requirement.
      </p>
    </div>
  );
}

function ReleaseTable({ data }: { data: DamData }) {
  const { summary, loading, error, reload } = data;
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  if (summary.releases.length === 0) {
    return (
      <div className="card">
        <p className="negotiation-reason">No canals found for this dam.</p>
      </div>
    );
  }
  return (
    <div className="dtable-wrap">
      <table className="dtable">
        <thead>
          <tr>
            <th>Canal</th>
            <th className="num">Requested</th>
            <th className="num">Approved</th>
            <th className="num">Released</th>
            <th className="num">Received</th>
            <th className="num">Difference</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {summary.releases.map((row) => (
            <tr key={row.canal}>
              <td>{row.canal}</td>
              <td className="num">{fmtNum(row.requested)}</td>
              <td className="num">{fmtNum(row.approved)}</td>
              <td className="num">{fmtNum(row.released)}</td>
              <td className="num">{fmtNum(row.received)}</td>
              <td className="num">{fmtNum(row.difference)}</td>
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

function PublishSupplyForm({ data }: { data: DamData }) {
  const { getToken } = useAuth();
  const [storage, setStorage] = useState("");
  const [inflow, setInflow] = useState("");
  const [outflow, setOutflow] = useState("");
  const [level, setLevel] = useState("");
  const [rainfall, setRainfall] = useState("");
  const [forecast, setForecast] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const num = (raw: string) => (raw.trim() === "" ? undefined : Number(raw));
    const parsed = {
      current_storage: num(storage),
      inflow: num(inflow),
      outflow: num(outflow),
      water_level: num(level),
      rainfall_last_24h: num(rainfall),
    };
    if (Object.values(parsed).some((v) => v !== undefined && !Number.isFinite(v))) {
      setError("Numbers only, please.");
      return;
    }
    if (
      Object.values(parsed).every((v) => v === undefined) &&
      forecast.trim() === ""
    ) {
      setError("Change at least one field.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Could not verify your session. Please sign in again.");
      await publishSupplyState(token, {
        ...parsed,
        ...(forecast.trim() ? { rainfall_forecast: forecast.trim() } : {}),
      });
      setSaved(true);
      data.reload();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not publish. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <form className="form-grid" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="pub-storage">Storage volume (units)</label>
          <input
            id="pub-storage"
            type="number"
            value={storage}
            placeholder="e.g. 5000"
            onChange={(e) => setStorage(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="pub-inflow">Inflow (units/day)</label>
          <input
            id="pub-inflow"
            type="number"
            value={inflow}
            placeholder="e.g. 850"
            onChange={(e) => setInflow(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="pub-outflow">Outflow (units/day)</label>
          <input
            id="pub-outflow"
            type="number"
            value={outflow}
            placeholder="e.g. 700"
            onChange={(e) => setOutflow(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="pub-level">Reservoir level (m)</label>
          <input
            id="pub-level"
            type="number"
            step="0.1"
            value={level}
            placeholder="e.g. 118.4"
            onChange={(e) => setLevel(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="pub-rain">Rainfall last 24h (mm)</label>
          <input
            id="pub-rain"
            type="number"
            value={rainfall}
            placeholder="e.g. 18"
            onChange={(e) => setRainfall(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="pub-forecast">Rainfall forecast</label>
          <input
            id="pub-forecast"
            value={forecast}
            placeholder="e.g. Medium — 12mm expected"
            onChange={(e) => setForecast(e.target.value)}
          />
        </div>
        {error && (
          <p className="field-error" style={{ gridColumn: "1 / -1" }}>
            {error}
          </p>
        )}
        {saved && (
          <p className="field-hint" style={{ gridColumn: "1 / -1" }}>
            Supply state published.
          </p>
        )}
        <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Publishing…" : "Publish update"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DashboardHome({ data }: { data: DamData }) {
  const { summary, loading, error, reload } = data;
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  return (
    <>
      <div className="dash-block">
        <StatGrid
          stats={summary.stats.map((s) => ({
            label: s.label,
            value: s.value,
            tone: s.tone ?? undefined,
          }))}
        />
      </div>

      <div className="dash-grid-2">
        <div className="dash-block">
          <div className="dash-block-head">
            <h3>Reservoir monitoring</h3>
          </div>
          <ReservoirPanel chain={summary.flow_chain} />
        </div>

        <div className="dash-block">
          <div className="dash-block-head">
            <h3>Rainfall monitoring</h3>
          </div>
          <RainfallPanel data={data} />
        </div>
      </div>

      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Canal-wise release</h3>
        </div>
        <ReleaseTable data={data} />
      </div>

      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Publish supply update</h3>
          <p>Numbers you publish here drive every dashboard immediately.</p>
        </div>
        <PublishSupplyForm data={data} />
      </div>
    </>
  );
}

function ReservoirRoute({ data }: { data: DamData }) {
  const { summary, loading, error, reload } = data;
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  return (
    <div className="dash-block">
      <ReservoirPanel chain={summary.flow_chain} />
    </div>
  );
}

const SECTION_META: Record<string, { title: string; subtitle: string }> = {
  "/app/dam": {
    title: "Supply state",
    subtitle: "How much water is available, and how much can safely be released.",
  },
  "/app/dam/reservoir": {
    title: "Reservoir monitoring",
    subtitle: "Release versus received volumes and losses.",
  },
  "/app/dam/rainfall": {
    title: "Rainfall monitoring",
    subtitle: "Catchment rainfall and forecast impact.",
  },
  "/app/dam/releases": {
    title: "Canal-wise release",
    subtitle: "Requested, approved, released and received volumes.",
  },
  "/app/dam/help": {
    title: "Help",
    subtitle: "Support for supply operations.",
  },
};

export function DamOperatorDashboardPage() {
  const location = useLocation();
  const meta = SECTION_META[location.pathname] ?? SECTION_META["/app/dam"];
  const data = useDamData();

  return (
    <DashboardShell
      roleLabel="Dam Operator"
      title={meta.title}
      subtitle={meta.subtitle}
      navItems={DAM_NAV}
    >
      <Routes>
        <Route index element={<DashboardHome data={data} />} />
        <Route
          path="reservoir"
          element={<ReservoirRoute data={data} />}
        />
        <Route path="rainfall" element={<RainfallPanel data={data} />} />
        <Route
          path="releases"
          element={
            <div className="dash-block">
              <ReleaseTable data={data} />
            </div>
          }
        />
        <Route
          path="help"
          element={
            <div className="dash-block">
              <div className="card">
                <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
                  Contact the system administrator for release approvals or
                  emergency alerts.
                </p>
              </div>
            </div>
          }
        />
        <Route path="*" element={<Navigate to="/app/dam" replace />} />
      </Routes>
    </DashboardShell>
  );
}
