import { Link, NavLink } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { useState } from "react";
import type { ReactNode } from "react";

interface NavItem {
  label: string;
  to: string;
  end?: boolean;
}

interface DashboardShellProps {
  roleLabel: string;
  title: string;
  subtitle?: string;
  navItems?: NavItem[];
  children: ReactNode;
}

export const FARMER_NAV: NavItem[] = [
  { label: "Dashboard", to: "/app/farmer", end: true },
  { label: "Request", to: "/app/farmer/request" },
  { label: "Allocation", to: "/app/farmer/allocation" },
  { label: "Mediation", to: "/app/farmer/mediation" },
  { label: "Schedule", to: "/app/farmer/schedule" },
  { label: "Delivery", to: "/app/farmer/delivery" },
  { label: "Alerts", to: "/app/farmer/alerts" },
  { label: "History", to: "/app/farmer/history" },
  { label: "Help", to: "/app/farmer/help" },
];

export const JAL_VIGYANI_NAV: NavItem[] = [
  { label: "Dashboard", to: "/app/jal-vigyani", end: true },
  { label: "Monitoring", to: "/app/jal-vigyani/monitoring" },
  { label: "Allocations", to: "/app/jal-vigyani/allocations" },
  { label: "Conflicts", to: "/app/jal-vigyani/conflicts" },
  { label: "Anomalies", to: "/app/jal-vigyani/anomalies" },
  { label: "Schedule", to: "/app/jal-vigyani/schedule" },
  { label: "Help", to: "/app/jal-vigyani/help" },
];

export const DAM_NAV: NavItem[] = [
  { label: "Dashboard", to: "/app/dam", end: true },
  { label: "Reservoir", to: "/app/dam/reservoir" },
  { label: "Rainfall", to: "/app/dam/rainfall" },
  { label: "Releases", to: "/app/dam/releases" },
  { label: "Help", to: "/app/dam/help" },
];

/** Shared app shell: top bar + left sidebar + main content. No emojis. */
export function DashboardShell({
  roleLabel,
  title,
  subtitle,
  navItems,
  children,
}: DashboardShellProps) {
  const nav =
    navItems ??
    (roleLabel === "Jal Vigyani"
      ? JAL_VIGYANI_NAV
      : roleLabel === "Dam Operator"
        ? DAM_NAV
        : FARMER_NAV);
  const [language, setLanguage] = useState("en");

  return (
    <div className="app">
      <header className="app-topbar">
        <div className="app-topbar-left">
          <Link className="brand" to="/">
            <img src="/logo.png" alt="JalSetu logo" className="brand-logo" />
            JalSetu
          </Link>
        </div>
        <div className="app-topbar-right">
          <label className="lang-select-wrap" aria-label="Language">
            <select
              className="lang-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="mr">मराठी</option>
            </select>
          </label>
          <span className="profile-chip">
            <UserButton />
          </span>
        </div>
      </header>

      <div className="app-body">
        <aside className="app-sidebar" aria-label="Dashboard navigation">
          <p className="sidebar-role">{roleLabel}</p>
          <nav className="sidebar-nav">
            {nav.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? " active" : ""}`
                }
              >
                <span className="sidebar-indicator" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <p className="sidebar-footer-title">Canal A</p>
            <p className="sidebar-footer-sub">Rampur · Morning slot</p>
          </div>
        </aside>

        <main className="app-main">
          <div className="app-main-head">
            <p className="eyebrow">{roleLabel}</p>
            <h1>{title}</h1>
            {subtitle && <p className="app-main-sub">{subtitle}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
