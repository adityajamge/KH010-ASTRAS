import { useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { DashboardShell, FARMER_NAV } from "../../components/DashboardShell";
import { Pill } from "../../components/dashboard/Pill";
import {
  farmerAllocation,
  farmerNegotiation,
  farmerSchedule,
  farmerNotifications,
  farmerProfile,
} from "../../lib/mockData";

type NegotiationStage = "review" | "objecting" | "counter-offered";

const RECENT_ACTIVITY = [
  { title: "Request submitted", meta: "400 units · 12 Sep" },
  { title: "Allocation generated", meta: "350 units proposed" },
  { title: "Schedule confirmed", meta: "12 Sep · 06:00–10:00" },
];

const DELIVERED = 320;

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

function MediationPanel({ compact = false }: { compact?: boolean }) {
  const [stage, setStage] = useState<NegotiationStage>("review");
  const [reason, setReason] = useState<string | null>(null);

  function selectReason(option: string) {
    setReason(option);
    setStage(option === "Need more water" ? "counter-offered" : "objecting");
  }

  return (
    <div className={compact ? undefined : "negotiation-panel"}>
      <div className="negotiation-row">
        <span>Your request</span>
        <span className="val">{farmerNegotiation.requested} units</span>
      </div>
      <div className="negotiation-row">
        <span>Allocated</span>
        <span className="val">{farmerNegotiation.proposal} units</span>
      </div>
      <p className="negotiation-reason">
        Reason: Limited water availability in this cycle.
      </p>

      {stage === "review" && (
        <div className="negotiation-actions">
          <button type="button" className="btn btn-primary btn-xs">
            Accept
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
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
              Objection recorded ({reason}). JalSetu will recalculate against
              available water and canal capacity.
            </p>
          )}
        </>
      )}

      {stage === "counter-offered" && (
        <>
          <div className="negotiation-row">
            <span>Morning</span>
            <span className="val">
              {farmerNegotiation.counterProposal.morning} units
            </span>
          </div>
          <div className="negotiation-row">
            <span>Evening</span>
            <span className="val">
              {farmerNegotiation.counterProposal.evening} units
            </span>
          </div>
          <div className="negotiation-row">
            <span>Total</span>
            <span className="val">
              {farmerNegotiation.counterProposal.total} units
            </span>
          </div>
          <div className="negotiation-actions">
            <button type="button" className="btn btn-primary btn-xs">
              Accept
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => setStage("objecting")}
            >
              Object
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DeliverySummary() {
  const authorized = farmerAllocation.allocated;
  const shortfall = authorized - DELIVERED;
  const pct = Math.round((DELIVERED / authorized) * 100);
  return (
    <>
      <div className="negotiation-row">
        <span>Authorized</span>
        <span className="val">{authorized} units</span>
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
        <span className="val">{DELIVERED} units</span>
      </div>
      <p className="negotiation-reason">Shortfall: {shortfall} units</p>
    </>
  );
}

function ScheduleTable() {
  return (
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
  );
}

function NotificationList() {
  return (
    <div className="notif-list">
      {farmerNotifications.map((n) => (
        <div
          className={`notif-item${n.kind === "warn" ? " warn" : ""}`}
          key={n.title}
        >
          <span className="notif-icon" />
          <div className="notif-body">
            <div className="notif-title">{n.title}</div>
            <div className="notif-meta">{n.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardHome() {
  return (
    <>
      <div className="home-stats">
        <div className="home-stat">
          <p className="home-stat-label">Available</p>
          <p className="home-stat-value">1000 L</p>
        </div>
        <div className="home-stat">
          <p className="home-stat-label">Allocated</p>
          <p className="home-stat-value">350 L</p>
        </div>
        <div className="home-stat">
          <p className="home-stat-label">Remaining</p>
          <p className="home-stat-value">230 L</p>
        </div>
      </div>

      <div className="home-grid">
        <section className="home-card" aria-label="Current allocation">
          <h2>Current Allocation</h2>
          <p className="home-card-crop">{farmerProfile.crop}</p>
          <p className="home-card-big">
            {farmerAllocation.allocated} / {farmerAllocation.requested} units
          </p>
          <p className="home-card-meta">12 Sept · 6–10 AM</p>
          <p className="home-card-meta">Canal A</p>
          <div className="home-card-actions">
            <Link
              className="btn btn-secondary btn-xs"
              to="/app/farmer/allocation"
            >
              View Allocation
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label="JalSetu mediation">
          <h2>JalSetu Mediation</h2>
          <MediationPanel compact />
          <div className="home-card-actions">
            <Link
              className="btn btn-secondary btn-xs"
              to="/app/farmer/mediation"
            >
              Open Mediation
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label="Today's schedule">
          <h2>Today&apos;s Schedule</h2>
          <div className="timeline">
            <div className="timeline-row">
              <span className="timeline-time">06:00</span>
              <span className="timeline-line" aria-hidden="true" />
            </div>
            <div className="timeline-marker" aria-hidden="true">
              <span className="timeline-drop" />
            </div>
            <div className="timeline-row">
              <span className="timeline-time">10:00</span>
              <span className="timeline-line" aria-hidden="true" />
            </div>
          </div>
          <p className="home-card-meta">Canal A</p>
          <p className="home-card-meta">Morning slot · Confirmed</p>
          <div className="home-card-actions">
            <Link className="btn btn-secondary btn-xs" to="/app/farmer/schedule">
              View Schedule
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label="Delivery status">
          <h2>Delivery Status</h2>
          <DeliverySummary />
          <div className="home-card-actions">
            <Link className="btn btn-secondary btn-xs" to="/app/farmer/delivery">
              View Delivery
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label="Weather and water">
          <h2>Weather / Water</h2>
          <ul className="plain-list">
            <li>
              <span className="status-dot ok" aria-hidden="true" />
              Rain detected in catchment
            </li>
            <li>
              <span className="status-dot ok" aria-hidden="true" />
              Crop requirement checked
            </li>
            <li>
              <span className="status-dot neutral" aria-hidden="true" />
              No change required to schedule
            </li>
          </ul>
          <div className="home-card-actions">
            <Link className="btn btn-secondary btn-xs" to="/app/farmer/alerts">
              View Alerts
            </Link>
          </div>
        </section>

        <section className="home-card" aria-label="Recent activity">
          <h2>Recent Activity</h2>
          <ul className="plain-list">
            {RECENT_ACTIVITY.map((item) => (
              <li key={item.title}>
                <span className="check-mark" aria-hidden="true" />
                <span>
                  <span className="activity-title">{item.title}</span>
                  <span className="activity-meta">{item.meta}</span>
                </span>
              </li>
            ))}
          </ul>
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

function RequestSection() {
  return (
    <div className="dash-block">
      <div className="card">
        <form className="form-grid" onSubmit={(e) => e.preventDefault()}>
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
  );
}

function AllocationSection() {
  return (
    <div className="dash-block">
      <div className="dash-block-head">
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
  );
}

function MediationSection() {
  return (
    <div className="dash-block">
      <MediationPanel />
    </div>
  );
}

function ScheduleSection() {
  return (
    <div className="dash-block">
      <div className="home-card" style={{ marginBottom: 16 }}>
        <h2>Today&apos;s Schedule</h2>
        <div className="timeline">
          <div className="timeline-row">
            <span className="timeline-time">06:00</span>
            <span className="timeline-line" aria-hidden="true" />
          </div>
          <div className="timeline-marker" aria-hidden="true">
            <span className="timeline-drop" />
          </div>
          <div className="timeline-row">
            <span className="timeline-time">10:00</span>
            <span className="timeline-line" aria-hidden="true" />
          </div>
        </div>
        <p className="home-card-meta">Canal A</p>
        <p className="home-card-meta">Morning slot · Confirmed</p>
      </div>
      <ScheduleTable />
    </div>
  );
}

function DeliverySection() {
  return (
    <div className="dash-block">
      <div className="card">
        <DeliverySummary />
        <div className="home-card-actions">
          <button type="button" className="btn btn-secondary btn-xs">
            Report Issue
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertsSection() {
  return (
    <>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Weather / Water</h3>
        </div>
        <div className="card">
          <ul className="plain-list">
            <li>
              <span className="status-dot ok" aria-hidden="true" />
              Rain detected in catchment
            </li>
            <li>
              <span className="status-dot ok" aria-hidden="true" />
              Crop requirement checked
            </li>
            <li>
              <span className="status-dot neutral" aria-hidden="true" />
              No change required to schedule
            </li>
          </ul>
        </div>
      </div>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Notifications</h3>
        </div>
        <NotificationList />
      </div>
    </>
  );
}

function HistorySection() {
  return (
    <>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Recent activity</h3>
        </div>
        <div className="card">
          <ul className="plain-list">
            {RECENT_ACTIVITY.map((item) => (
              <li key={item.title}>
                <span className="check-mark" aria-hidden="true" />
                <span>
                  <span className="activity-title">{item.title}</span>
                  <span className="activity-meta">{item.meta}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="dash-block">
        <div className="dash-block-head">
          <h3>Past schedules</h3>
        </div>
        <ScheduleTable />
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
  "/app/farmer/alerts": {
    title: () => "Alerts",
    subtitle: "Weather, water and system notifications.",
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

  return (
    <DashboardShell
      roleLabel="Farmer"
      title={meta.title(displayName)}
      subtitle={meta.subtitle}
      navItems={FARMER_NAV}
    >
      <Routes>
        <Route index element={<DashboardHome />} />
        <Route path="request" element={<RequestSection />} />
        <Route path="allocation" element={<AllocationSection />} />
        <Route path="mediation" element={<MediationSection />} />
        <Route path="schedule" element={<ScheduleSection />} />
        <Route path="delivery" element={<DeliverySection />} />
        <Route path="alerts" element={<AlertsSection />} />
        <Route path="history" element={<HistorySection />} />
        <Route path="help" element={<HelpSection />} />
        <Route path="*" element={<Navigate to="/app/farmer" replace />} />
      </Routes>
    </DashboardShell>
  );
}
