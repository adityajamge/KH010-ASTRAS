import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@clerk/clerk-react";
import { DashboardShell, DAM_NAV } from "../../components/DashboardShell";
import { NativeDamOperatorShell } from "../../components/NativeDamOperatorShell";
import { StatGrid } from "../../components/dashboard/StatGrid";
import { DigitalTwin3D } from "../../components/twin/DigitalTwin3D";
import { Pill, statusTone } from "../../components/dashboard/Pill";
import { useLanguage } from "../../lib/i18n";
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
  const { t } = useLanguage();
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
        if (!token) throw new Error(t("Could not verify your session. Please sign in again."));
        const data = await getDamDashboard(token);
        if (!cancelled) setSummary(data);
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

  return { summary, loading, error, reload };
}

function PageState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  const { t } = useLanguage();
  if (loading) {
    return (
      <div className="dash-block">
        <div className="card">
          <p className="hero-note">{t("Loading supply state…")}</p>
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

function fmtNum(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("en-IN")
    : value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function ReservoirPanel({ chain }: { chain?: FlowChainRead }) {
  const { t } = useLanguage();
  if (!chain) {
    return (
      <div className="card">
        <p className="hero-note">{t("Loading flow chain…")}</p>
      </div>
    );
  }
  const maxValue = Math.max(1, ...chain.stages.map((s) => Math.abs(s.value)));
  return (
    <div className="card">
      <div className="flow-chain">
        {chain.stages.map((stage, i) => {
          const pct = Math.min(100, (Math.abs(stage.value) / maxValue) * 100);
          return (
            <div className="flow-stage" key={stage.label}>
              <div className="flow-stage-head">
                <span className="flow-stage-label">{t(stage.label)}</span>
                <span className="flow-stage-value">{fmtNum(stage.value)}</span>
              </div>
              <div
                className="flow-stage-bar"
                role="img"
                aria-label={`${stage.label}: ${fmtNum(stage.value)}`}
              >
                <span style={{ width: `${pct}%` }} />
              </div>
              {stage.note && <p className="flow-stage-note">{stage.note}</p>}
              {i < chain.stages.length - 1 && (
                <span className="flow-arrow" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
      {chain.alert && chain.alert_note && (
        <p className="field-error" style={{ marginBottom: 0 }}>
          {chain.alert_note}
        </p>
      )}
      {!chain.alert && (
        <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
          {t("Differences within tolerance — no canal-level investigation needed.")}
        </p>
      )}
    </div>
  );
}

function RainfallPanel({ data }: { data: DamData }) {
  const { summary, loading, error, reload } = data;
  const { t, tf } = useLanguage();
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  return (
    <div className="card">
      <div className="negotiation-row">
        <span>{t("Last 24 hours")}</span>
        <span className="val">{fmtNum(summary.rainfall.last_24h)} mm</span>
      </div>
      <div className="negotiation-row">
        <span>{t("Catchment affected")}</span>
        <span className="val">{summary.rainfall.catchment}</span>
      </div>
      <p className="negotiation-reason">
        {tf("Forecast: {forecast}. Rainfall triggers a recalculation rather than automatically reducing every farmer's requirement.", {
          forecast: summary.rainfall.forecast,
        })}
      </p>
    </div>
  );
}

function ReleaseTable({ data }: { data: DamData }) {
  const { summary, loading, error, reload } = data;
  const { t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  if (summary.releases.length === 0) {
    return (
      <div className="card">
        <p className="negotiation-reason">{t("No canals found for this dam.")}</p>
      </div>
    );
  }

  const statuses = Array.from(new Set(summary.releases.map((r) => r.status)));
  const visible = statusFilter
    ? summary.releases.filter((r) => r.status === statusFilter)
    : summary.releases;

  return (
    <>
      <div className="objection-options" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`chip${statusFilter === null ? " active" : ""}`}
          onClick={() => setStatusFilter(null)}
        >
          {t("All")} ({summary.releases.length})
        </button>
        {statuses.map((status) => {
          const count = summary.releases.filter((r) => r.status === status).length;
          return (
            <button
              key={status}
              type="button"
              className={`chip${statusFilter === status ? " active" : ""}`}
              onClick={() => setStatusFilter((s) => (s === status ? null : status))}
            >
              {t(status)} ({count})
            </button>
          );
        })}
      </div>
      <div className="dtable-wrap">
        <table className="dtable">
          <thead>
            <tr>
              <th>{t("Canal")}</th>
              <th className="num">{t("Requested")}</th>
              <th className="num">{t("Approved")}</th>
              <th className="num">{t("Released")}</th>
              <th className="num">{t("Received")}</th>
              <th className="num">{t("Difference")}</th>
              <th>{t("Status")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.canal}
                className={row.status === "Needs Investigation" ? "dtable-row-alert" : undefined}
              >
                <td>{row.canal}</td>
                <td className="num">{fmtNum(row.requested)}</td>
                <td className="num">{fmtNum(row.approved)}</td>
                <td className="num">{fmtNum(row.released)}</td>
                <td className="num">{fmtNum(row.received)}</td>
                <td className="num">{fmtNum(row.difference)}</td>
                <td>
                  <Pill tone={statusTone(row.status)}>{t(row.status)}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PublishSupplyForm({ data }: { data: DamData }) {
  const { getToken } = useAuth();
  const { t } = useLanguage();
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
      setError(t("Numbers only, please."));
      return;
    }
    if (
      Object.values(parsed).every((v) => v === undefined) &&
      forecast.trim() === ""
    ) {
      setError(t("Change at least one field."));
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t("Could not verify your session. Please sign in again."));
      await publishSupplyState(token, {
        ...parsed,
        ...(forecast.trim() ? { rainfall_forecast: forecast.trim() } : {}),
      });
      setSaved(true);
      data.reload();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("Could not publish. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <form className="form-grid" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="pub-storage">{t("Storage volume (units)")}</label>
          <input
            id="pub-storage"
            type="number"
            value={storage}
            placeholder={t("e.g. 5000")}
            onChange={(e) => setStorage(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="pub-inflow">{t("Inflow (units/day)")}</label>
          <input
            id="pub-inflow"
            type="number"
            value={inflow}
            placeholder={t("e.g. 850")}
            onChange={(e) => setInflow(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="pub-outflow">{t("Outflow (units/day)")}</label>
          <input
            id="pub-outflow"
            type="number"
            value={outflow}
            placeholder={t("e.g. 700")}
            onChange={(e) => setOutflow(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="pub-level">{t("Reservoir level (m)")}</label>
          <input
            id="pub-level"
            type="number"
            step="0.1"
            value={level}
            placeholder={t("e.g. 118.4")}
            onChange={(e) => setLevel(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="pub-rain">{t("Rainfall last 24h (mm)")}</label>
          <input
            id="pub-rain"
            type="number"
            value={rainfall}
            placeholder={t("e.g. 18")}
            onChange={(e) => setRainfall(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="pub-forecast">{t("Rainfall forecast")}</label>
          <input
            id="pub-forecast"
            value={forecast}
            placeholder={t("e.g. Medium — 12mm expected")}
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
            {t("Supply state published.")}
          </p>
        )}
        <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? t("Publishing…") : t("Publish update")}
          </button>
        </div>
      </form>
    </div>
  );
}

function DashboardHome({ data }: { data: DamData }) {
  const { summary, loading, error, reload } = data;
  const { t } = useLanguage();
  if (loading || error || !summary) {
    return <PageState loading={loading} error={error} onRetry={reload} />;
  }
  return (
    <>
      <div className="dash-block">
        <StatGrid
          stats={summary.stats.map((s) => ({
            label: t(s.label),
            // "Dam Status" is the one stat whose value is itself a status
            // word (Normal/Watch/Critical/Unknown), not a formatted number.
            value: s.label === "Dam Status" ? t(s.value) : s.value,
            tone: s.tone ?? undefined,
          }))}
        />
      </div>

      <div className="dash-grid-2">
        <div className="dash-block">
          <div className="dash-block-head">
            <h3>{t("Reservoir monitoring")}</h3>
          </div>
          <ReservoirPanel chain={summary.flow_chain} />
        </div>

        <div className="dash-block">
          <div className="dash-block-head">
            <h3>{t("Rainfall monitoring")}</h3>
          </div>
          <RainfallPanel data={data} />
        </div>
      </div>

      <div className="dash-block">
        <div className="dash-block-head">
          <h3>{t("Canal-wise release")}</h3>
        </div>
        <ReleaseTable data={data} />
      </div>

      <div className="dash-block">
        <div className="card banner-card">
          <div>
            <h3>{t("Digital Twin")}</h3>
            <p>{t("See the dam, canals and farm plots live in 3D.")}</p>
          </div>
          <Link className="btn btn-primary btn-xs" to="/app/dam/twin">
            {t("Open Digital Twin")}
          </Link>
        </div>
      </div>

      <PublishSupplySection data={data} />
    </>
  );
}

function PublishSupplySection({ data }: { data: DamData }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);
  return (
    <div className="dash-block">
      <div className="dash-block-head dash-block-head--actions">
        <div>
          <h3>{t("Publish supply update")}</h3>
          <p>{t("Numbers you publish here drive every dashboard immediately.")}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-xs" onClick={() => setOpen((v) => !v)}>
          {open ? t("Hide") : t("Update Supply")}
        </button>
      </div>
      {open && <PublishSupplyForm data={data} />}
    </div>
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
  "/app/dam/twin": {
    title: "Digital Twin",
    subtitle: "Dam, canals and farm plots — live from the network state.",
  },
  "/app/dam/help": {
    title: "Help",
    subtitle: "Support for supply operations.",
  },
};

export function DamOperatorDashboardPage() {
  const location = useLocation();
  const { t } = useLanguage();
  const meta = SECTION_META[location.pathname] ?? SECTION_META["/app/dam"];
  const data = useDamData();

  const routes = (
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
      <Route path="twin" element={<DigitalTwin3D />} />
      <Route
        path="help"
        element={
          <div className="dash-block">
            <div className="card">
              <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
                {t("Contact the system administrator for release approvals or emergency alerts.")}
              </p>
            </div>
          </div>
        }
      />
      <Route path="*" element={<Navigate to="/app/dam" replace />} />
    </Routes>
  );

  if (Capacitor.isNativePlatform()) {
    return (
      <NativeDamOperatorShell title={t(meta.title)} subtitle={t(meta.subtitle)}>
        {routes}
      </NativeDamOperatorShell>
    );
  }

  return (
    <DashboardShell
      roleLabel="Dam Operator"
      title={t(meta.title)}
      subtitle={t(meta.subtitle)}
      navItems={DAM_NAV}
    >
      {routes}
    </DashboardShell>
  );
}
