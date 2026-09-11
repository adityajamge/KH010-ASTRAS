import { DashboardShell } from "../../components/DashboardShell";
import { StatGrid } from "../../components/dashboard/StatGrid";
import { Pill } from "../../components/dashboard/Pill";
import { damOverviewStats, rainfallMonitoring, canalReleases } from "../../lib/mockData";

export function DamOperatorDashboardPage() {
  return (
    <DashboardShell
      roleLabel="Dam Operator"
      title="Supply state"
      subtitle="How much water is available, and how much can safely be released."
    >
      <div className="dash-block">
        <StatGrid stats={damOverviewStats} />
      </div>

      <div className="dash-grid-2">
        <div className="dash-block">
          <div className="dash-block-head">
            <h3>Reservoir monitoring</h3>
          </div>
          <div className="card">
            <p className="flow-line">
              Reservoir Release → Canal Received → Farmer Allocations → Actual
              Delivery → Expected Physical Loss → Unaccounted Difference
            </p>
            <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
              Large unexplained differences between released and received
              volumes generate alerts for canal-level investigation.
            </p>
          </div>
        </div>

        <div className="dash-block">
          <div className="dash-block-head">
            <h3>Rainfall monitoring</h3>
          </div>
          <div className="card">
            <div className="negotiation-row">
              <span>Current</span>
              <span className="val">{rainfallMonitoring.current}</span>
            </div>
            <div className="negotiation-row">
              <span>Last 24 hours</span>
              <span className="val">{rainfallMonitoring.last24h}</span>
            </div>
            <div className="negotiation-row">
              <span>Catchment affected</span>
              <span className="val">{rainfallMonitoring.catchmentAffected}</span>
            </div>
            <p className="negotiation-reason">
              Forecast: {rainfallMonitoring.forecast}. Rainfall triggers a
              recalculation rather than automatically reducing every farmer's
              requirement.
            </p>
          </div>
        </div>
      </div>

      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Canal-wise release</h3>
        </div>
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
              {canalReleases.map((row) => (
                <tr key={row.canal}>
                  <td>{row.canal}</td>
                  <td className="num">{row.requested}</td>
                  <td className="num">{row.approved}</td>
                  <td className="num">{row.released}</td>
                  <td className="num">{row.received}</td>
                  <td className="num">{row.difference}</td>
                  <td>
                    <Pill>{row.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
