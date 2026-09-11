import { useState } from "react";
import { DashboardShell } from "../../components/DashboardShell";
import { StatGrid } from "../../components/dashboard/StatGrid";
import { Pill } from "../../components/dashboard/Pill";
import {
  farmerHomeStats,
  farmerAllocation,
  farmerNegotiation,
  farmerSchedule,
  farmerNotifications,
  farmerProfile,
} from "../../lib/mockData";

type NegotiationStage = "review" | "objecting" | "counter-offered";

export function FarmerDashboardPage() {
  const [stage, setStage] = useState<NegotiationStage>("review");
  const [reason, setReason] = useState<string | null>(null);

  function selectReason(option: string) {
    setReason(option);
    setStage(option === "Need more water" ? "counter-offered" : "objecting");
  }

  return (
    <DashboardShell
      roleLabel="Farmer"
      title="My water"
      subtitle={`${farmerProfile.name} · ${farmerProfile.village} · Field ${farmerProfile.fieldId} · Canal ${farmerProfile.canal}`}
    >
      <div className="dash-block">
        <StatGrid stats={farmerHomeStats} />
      </div>

      <div className="dash-grid-2">
        <div className="dash-block">
          <div className="dash-block-head">
            <h3>Request water</h3>
          </div>
          <div className="card">
            <form
              className="form-grid"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="form-field">
                <label htmlFor="qty">Quantity (units)</label>
                <input id="qty" type="number" defaultValue={400} min={0} />
              </div>
              <div className="form-field">
                <label htmlFor="date">Date</label>
                <input id="date" type="date" defaultValue="2026-09-12" />
              </div>
              <div className="form-field">
                <label htmlFor="time">Preferred time</label>
                <select id="time" defaultValue="morning">
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="duration">Duration (hrs)</label>
                <input id="duration" type="number" defaultValue={2} min={1} />
              </div>
              <div className="form-field">
                <label htmlFor="crop">Crop</label>
                <input id="crop" defaultValue={farmerProfile.crop} />
              </div>
              <div className="form-field">
                <label htmlFor="urgency">Urgency</label>
                <select id="urgency" defaultValue="normal">
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical — crop stress</option>
                </select>
              </div>
              <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
                <button type="submit" className="btn btn-primary">
                  Submit request
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="dash-block">
          <div className="dash-block-head">
            <h3>My allocation</h3>
            <Pill>{farmerAllocation.status}</Pill>
          </div>
          <div className="card">
            <div className="negotiation-row">
              <span>Requested</span>
              <span className="val">{farmerAllocation.requested} units</span>
            </div>
            <div className="negotiation-row">
              <span>Allocated</span>
              <span className="val">{farmerAllocation.allocated} units</span>
            </div>
            <div className="negotiation-row">
              <span>Date</span>
              <span className="val">{farmerAllocation.date}</span>
            </div>
            <div className="negotiation-row">
              <span>Time slot</span>
              <span className="val">
                {farmerAllocation.startTime}–{farmerAllocation.endTime}
              </span>
            </div>
            <div className="negotiation-row">
              <span>Canal</span>
              <span className="val">{farmerAllocation.canal}</span>
            </div>
            <p className="negotiation-reason">
              Reason for adjustment: {farmerAllocation.reason}
            </p>
          </div>
        </div>
      </div>

      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Negotiation center</h3>
          <p>Review PS14's proposal and respond.</p>
        </div>
        <div className="negotiation-panel">
          <div className="negotiation-row">
            <span>Your request</span>
            <span className="val">{farmerNegotiation.requested} units</span>
          </div>
          <div className="negotiation-row">
            <span>PS14 proposal</span>
            <span className="val">{farmerNegotiation.proposal} units</span>
          </div>
          <p className="negotiation-reason">Reason: {farmerNegotiation.reason}</p>

          {stage === "review" && (
            <div className="negotiation-actions">
              <button type="button" className="btn btn-primary">
                Accept
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStage("objecting")}
              >
                Object
              </button>
            </div>
          )}

          {stage === "objecting" && (
            <>
              <div className="objection-options">
                {farmerNegotiation.objectionOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`chip${reason === option ? " active" : ""}`}
                    onClick={() => selectReason(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {reason && reason !== "Need more water" && (
                <p className="negotiation-reason">
                  Objection recorded ({reason}). PS14 will recalculate against
                  available water, canal capacity, and other farmers'
                  minimum requirements.
                </p>
              )}
            </>
          )}

          {stage === "counter-offered" && (
            <>
              <p className="negotiation-reason">
                Counter proposal — split across two slots:
              </p>
              <div className="negotiation-row">
                <span>Morning</span>
                <span className="val">{farmerNegotiation.counterProposal.morning} units</span>
              </div>
              <div className="negotiation-row">
                <span>Evening</span>
                <span className="val">{farmerNegotiation.counterProposal.evening} units</span>
              </div>
              <div className="negotiation-row">
                <span>Total</span>
                <span className="val">{farmerNegotiation.counterProposal.total} units</span>
              </div>
              <div className="negotiation-actions">
                <button type="button" className="btn btn-primary">
                  Accept
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setStage("objecting")}
                >
                  Object
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="dash-block">
          <div className="dash-block-head">
            <h3>Schedule</h3>
          </div>
          <div className="dtable-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th className="num">Quantity</th>
                  <th>Canal</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {farmerSchedule.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>{row.time}</td>
                    <td className="num">{row.quantity}</td>
                    <td>{row.canal}</td>
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
            <h3>Notifications</h3>
          </div>
          <div className="notif-list">
            {farmerNotifications.map((n) => (
              <div className={`notif-item${n.kind === "warn" ? " warn" : ""}`} key={n.title}>
                <span className="notif-icon" />
                <div className="notif-body">
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-meta">{n.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
