import { DashboardShell } from "../../components/DashboardShell";
import { StatGrid } from "../../components/dashboard/StatGrid";
import { Pill } from "../../components/dashboard/Pill";
import {
  canalOverviewStats,
  canalLiveMonitoring,
  farmerAllocationTable,
  conflicts,
  waterAnomaly,
  underDelivery,
  canalSchedule,
} from "../../lib/mockData";

export function JalVigyaniDashboardPage() {
  return (
    <DashboardShell
      roleLabel="Jal Vigyani"
      title="Canal state"
      subtitle="Canal C1 · Ground evidence, allocation, and conflict monitoring."
    >
      <div className="dash-block">
        <StatGrid stats={canalOverviewStats} />
      </div>

      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Live canal monitoring</h3>
        </div>
        <div className="card">
          <p className="flow-line">
            Upstream flow: <strong>{canalLiveMonitoring.upstreamFlow}</strong> · Downstream
            flow: <strong>{canalLiveMonitoring.downstreamFlow}</strong> · Authorized outflow:{" "}
            <strong>{canalLiveMonitoring.authorizedOutflow}</strong>
          </p>
          <p className="flow-line" style={{ marginBottom: 0 }}>
            Unaccounted difference:{" "}
            <strong>{canalLiveMonitoring.unaccountedDifference} units</strong>
          </p>
        </div>
      </div>

      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Farmer allocation</h3>
        </div>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Farmer</th>
                <th className="num">Requested</th>
                <th className="num">Allocated</th>
                <th className="num">Delivered</th>
                <th className="num">Shortfall</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {farmerAllocationTable.map((row) => (
                <tr key={row.farmer}>
                  <td>{row.farmer}</td>
                  <td className="num">{row.requested}</td>
                  <td className="num">{row.allocated}</td>
                  <td className="num">{row.delivered}</td>
                  <td className="num">{row.shortfall}</td>
                  <td>
                    <Pill>{row.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Conflict management</h3>
        </div>
        {conflicts.map((c) => (
          <div className="conflict-card" key={c.conflictId}>
            <div className="conflict-card-head">
              <span className="cid">{c.conflictId}</span>
              <Pill>{c.status}</Pill>
            </div>
            <div className="conflict-meta">
              <div>
                Farmers
                <strong>{c.farmers}</strong>
              </div>
              <div>
                Available
                <strong>{c.availableWater}</strong>
              </div>
              <div>
                Demand
                <strong>{c.totalDemand}</strong>
              </div>
              <div>
                Shortage
                <strong>{c.shortage}</strong>
              </div>
              <div>
                Priority
                <strong>{c.priority}</strong>
              </div>
            </div>
            <p className="negotiation-reason">PS14 proposal: {c.proposal}</p>
            <p className="negotiation-reason">Objections: {c.objections}</p>
            <div className="conflict-actions">
              <button type="button" className="btn btn-secondary btn-xs">
                Review
              </button>
              <button type="button" className="btn btn-primary btn-xs">
                Approve
              </button>
              <button type="button" className="btn btn-secondary btn-xs">
                Request revision
              </button>
              <button type="button" className="btn btn-secondary btn-xs">
                Escalate
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2">
        <div className="dash-block">
          <div className="dash-block-head">
            <h3>Under-delivery detection</h3>
          </div>
          <div className="anomaly-panel">
            <div className="negotiation-row">
              <span>{underDelivery.farmer}</span>
              <Pill>{underDelivery.status}</Pill>
            </div>
            <div className="negotiation-row">
              <span>Authorized</span>
              <span className="val">{underDelivery.authorized}</span>
            </div>
            <div className="negotiation-row">
              <span>Actual</span>
              <span className="val">{underDelivery.actual}</span>
            </div>
            <div className="negotiation-row">
              <span>Shortfall</span>
              <span className="val">{underDelivery.shortfall}</span>
            </div>
            <p className="negotiation-reason">Possible causes:</p>
            <div className="anomaly-causes">
              {underDelivery.possibleCauses.map((cause) => (
                <span className="pill pill-neutral" key={cause}>
                  {cause}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="dash-block">
          <div className="dash-block-head">
            <h3>Water loss / anomaly</h3>
          </div>
          <div className="anomaly-panel">
            <div className="negotiation-row">
              <span>{waterAnomaly.id}</span>
              <Pill tone="danger">{waterAnomaly.status}</Pill>
            </div>
            <div className="negotiation-row">
              <span>Location</span>
              <span className="val">{waterAnomaly.location}</span>
            </div>
            <div className="negotiation-row">
              <span>Expected / measured</span>
              <span className="val">
                {waterAnomaly.expectedFlow} / {waterAnomaly.measuredFlow}
              </span>
            </div>
            <div className="negotiation-row">
              <span>Difference</span>
              <span className="val">{waterAnomaly.difference} units</span>
            </div>
            <p className="negotiation-reason">
              Not a conclusion of theft — possible causes for investigation:
            </p>
            <div className="anomaly-causes">
              {waterAnomaly.possibleCauses.map((cause) => (
                <span className="pill pill-neutral" key={cause}>
                  {cause}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Canal schedule</h3>
        </div>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Slot</th>
                <th>Farmer</th>
                <th className="num">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {canalSchedule.map((row) => (
                <tr key={row.slot}>
                  <td>{row.slot}</td>
                  <td>{row.farmer}</td>
                  <td className="num">{row.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
