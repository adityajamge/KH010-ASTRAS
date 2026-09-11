import { Link } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import type { ReactNode } from "react";

interface DashboardShellProps {
  roleLabel: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Shared shell for the three role dashboards. */
export function DashboardShell({ roleLabel, title, subtitle, children }: DashboardShellProps) {
  return (
    <>
      <header className="top-nav">
        <div className="top-nav-inner">
          <Link className="brand" to="/">
            <span className="brand-mark">≈</span> JalSetu
          </Link>
          <nav className="nav-links" aria-label="Primary">
            <Link to="/app">My dashboard</Link>
          </nav>
          <div className="nav-actions">
            <span className="status-badge">{roleLabel}</span>
            <UserButton />
          </div>
        </div>
      </header>
      <main className="page">
        <section className="section dash-section" style={{ paddingTop: 48 }}>
          <div className="section-head">
            <p className="eyebrow">{roleLabel}</p>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {children}
        </section>
      </main>
    </>
  );
}
