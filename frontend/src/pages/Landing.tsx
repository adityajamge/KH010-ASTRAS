import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";
import { getVersionedHealth, type HealthResponse } from "../lib/api";
import { roleHome } from "../lib/roles";
import "../App.css";

type ApiState =
  | { status: "checking" }
  | { status: "connected"; data: HealthResponse }
  | { status: "offline" };

function useBackendStatus(): ApiState {
  const [state, setState] = useState<ApiState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    getVersionedHealth()
      .then((data) => {
        if (!cancelled) setState({ status: "connected", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "offline" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

interface FarmBar {
  id: string;
  amount: string;
  fill: number;
  conflict?: boolean;
}

const FARMS: FarmBar[] = [
  { id: "F01", amount: "5,000 L", fill: 72 },
  { id: "F02", amount: "5,000 L", fill: 72 },
  { id: "F03", amount: "5,000 L", fill: 72 },
  { id: "F04", amount: "5,000 L", fill: 72 },
  { id: "F05", amount: "5,000 L", fill: 72 },
  { id: "F06", amount: "5,000 L", fill: 72 },
  { id: "F07", amount: "5,000 L", fill: 72 },
  { id: "F08", amount: "5,000 L", fill: 72 },
  { id: "F09", amount: "3,000 L", fill: 43 },
  { id: "F10", amount: "4,200 / 7,000 L", fill: 60, conflict: true },
];

const FEATURES = [
  {
    title: "Conflict detection",
    body: "Compares availability, requirements, allocations, and observed flow to flag disputes — like F10's tail-end shortfall — before they escalate.",
  },
  {
    title: "Deterministic allocation",
    body: "Water math runs in audited backend code, not in the LLM. Balances, capacities, and constraints are computed and validated every time.",
  },
  {
    title: "Glass-box explanations",
    body: "Every proposal shows its evidence: available water, requirements, deficits, and which constraints were respected.",
  },
  {
    title: "Negotiation workflow",
    body: "Farmers can object, add context, and trigger recalculation. Objections become structured constraints, not lost messages.",
  },
  {
    title: "3D digital twin",
    body: "Dam, canal network, and farm plots rendered live — allocation status and conflict locations visible at a glance.",
  },
  {
    title: "Agreement audit trail",
    body: "Final allocations are recorded as versioned agreements with participants, reasons, and timestamps. Nothing is silently overwritten.",
  },
];

const ROLES = [
  {
    title: "Dam Operator",
    body: "Publishes supply-side state: reservoir level, available water, planned releases, and scarcity status into the shared system.",
    question: "“How much water do we have?”",
  },
  {
    title: "Jal Vigyani",
    body: "Records ground evidence — flow measurements, infrastructure issues, shortage verification — so mediation runs on facts, not claims.",
    question: "“What is happening in the network?”",
  },
  {
    title: "Farmer",
    body: "Submits requirements, views allocations and schedules, asks why, objects, negotiates, and accepts the final agreement.",
    question: "“Am I receiving my fair share?”",
  },
];

const STEPS = [
  {
    title: "Supply",
    body: "Dam Operator publishes available water and planned releases.",
  },
  {
    title: "Evidence",
    body: "Jal Vigyani records flows and verifies infrastructure.",
  },
  {
    title: "Detect",
    body: "System flags the conflict — e.g. F10's 2,800 L shortfall.",
  },
  {
    title: "Mediate",
    body: "Engine reallocates; agent explains; farmers object or accept.",
  },
  {
    title: "Agree",
    body: "Accepted schedule is recorded as a versioned agreement.",
  },
];

function Landing() {
  const api = useBackendStatus();
  const { user } = useUser();

  return (
    <>
      <header className="top-nav">
        <div className="top-nav-inner">
          <Link className="brand" to="/">
            <img src="/logo.png" alt="JalSetu logo" className="brand-logo" />
            JalSetu
          </Link>
          <nav className="nav-links" aria-label="Primary">
            <a href="#system">System</a>
            <a href="#roles">Roles</a>
            <a href="#demo">Demo flow</a>
          </nav>
          <div className="nav-actions">
            <span className="status-badge" title="Backend health">
              <span
                className={api.status === "connected" ? "dot ok" : "dot"}
              />
              {api.status === "connected"
                ? `API connected · v${api.data.version}`
                : api.status === "checking"
                  ? "Checking API…"
                  : "API offline"}
            </span>
            <SignedOut>
              <Link className="btn btn-secondary" to="/sign-in">
                Sign in
              </Link>
              <Link className="btn btn-primary" to="/sign-up">
                Get started
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                className="btn btn-primary"
                to={roleHome(user?.publicMetadata?.role)}
              >
                Open dashboard
              </Link>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="page" id="top">
        <section className="hero">
          <p className="eyebrow">PS14 · Autonomous water-sharing mediation</p>
          <h1>
            Fair water for <span className="accent">every farm</span> on the
            canal.
          </h1>
          <p className="subhead">
            JalSetu is a digital mediation layer for irrigation disputes. An AI
            mediator negotiates in plain language while a deterministic engine
            computes fair allocations — transparently, and on the record.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-primary" href="#demo">
              See how it works
            </a>
            <a className="btn btn-secondary" href="#roles">
              Meet the roles
            </a>
          </div>

          <div className="product-panel" aria-label="Canal network preview">
            <div className="panel-header">
              <span className="panel-title">CANAL NETWORK · F10 CONFLICT</span>
              <span className="status-badge">
                <span className="dot ok" /> Live allocation state
              </span>
            </div>
            <div className="panel-stats">
              <div className="stat">
                <div className="label">Available water</div>
                <div className="value">50,000 L</div>
              </div>
              <div className="stat">
                <div className="label">Total demand</div>
                <div className="value">63,000 L</div>
              </div>
              <div className="stat">
                <div className="label">Scarcity</div>
                <div className="value warn">20.6%</div>
              </div>
              <div className="stat">
                <div className="label">Active conflicts</div>
                <div className="value warn">1</div>
              </div>
            </div>
            <p className="flow-line">
              <strong>DAM</strong> → MAIN CANAL → DISTRIBUTARIES → 10 FARMS
            </p>
            <div className="farm-grid">
              {FARMS.map((farm) => (
                <div
                  key={farm.id}
                  className={farm.conflict ? "farm conflict" : "farm"}
                >
                  <div className="fid">
                    <span>{farm.id}</span>
                    {farm.conflict && (
                      <span className="conflict-flag">SHORTAGE</span>
                    )}
                  </div>
                  <div className="bar">
                    <span style={{ width: `${farm.fill}%` }} />
                  </div>
                  <div className="amount">{farm.amount}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="system">
          <div className="section-head">
            <p className="eyebrow">System</p>
            <h2>Not a chatbot. A mediation workflow.</h2>
            <p>
              AI handles language, negotiation, and explanation. Deterministic
              software handles arithmetic, constraints, and schedules.
            </p>
          </div>
          <div className="card-grid">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="card">
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="roles">
          <div className="section-head">
            <p className="eyebrow">Roles</p>
            <h2>Three views, one shared water state.</h2>
            <p>
              A change in any role — supply, evidence, or demand — propagates
              to allocation, conflicts, schedules, and mediation.
            </p>
          </div>
          <div className="card-grid">
            {ROLES.map((role) => (
              <article key={role.title} className="card">
                <h3>{role.title}</h3>
                <p>{role.body}</p>
                <p className="role-question">{role.question}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="demo">
          <div className="section-head">
            <p className="eyebrow">Demo flow</p>
            <h2>From dispute to agreement.</h2>
            <p>The end-to-end journey the prototype demonstrates.</p>
          </div>
          <div className="steps">
            {STEPS.map((step) => (
              <article key={step.title} className="step">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cta-banner">
          <h2>Resolve the next dispute with evidence, not arguments.</h2>
          <p>
            Deterministic allocation. Glass-box reasoning. Auditable
            agreements.
          </p>
          <a className="btn btn-primary" href="#system">
            Explore the system
          </a>
        </section>

        <footer className="footer">
          <span>
            ≈ JalSetu · PS14 prototype ·{" "}
            {api.status === "connected"
              ? `Backend ${api.data.service} v${api.data.version} (${api.data.environment})`
              : "Backend offline — start it with `uvicorn app.main:app --reload` in /backend"}
          </span>
          <div className="links">
            <a href="#system">System</a>
            <a href="#roles">Roles</a>
            <a href="#demo">Demo flow</a>
          </div>
        </footer>
      </main>
    </>
  );
}

export default Landing;
