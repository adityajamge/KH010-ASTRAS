import { useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { AssistantFab } from "./AssistantFab";
import { AssistantChat } from "./AssistantChat";
import { LANGUAGES, useLanguage, type Lang } from "../lib/i18n";

interface NativeFarmerShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Minimal inline icon set — no icon-font/CDN dependency, just small SVGs. */
function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
function DropIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3s7 8 7 12.5A7 7 0 0 1 5 15.5C5 11 12 3 12 3Z" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

const TABS = [
  { key: "home", label: "Dashboard", to: "/app/farmer", end: true, icon: HomeIcon },
  { key: "request", label: "Request", to: "/app/farmer/request", end: false, icon: DropIcon },
  { key: "mediation", label: "Mediation", to: "/app/farmer/mediation", end: false, icon: ChatIcon },
  { key: "schedule", label: "Schedule", to: "/app/farmer/schedule", end: false, icon: CalendarIcon },
] as const;

const MORE_ITEMS = [
  { label: "Allocation", to: "/app/farmer/allocation" },
  { label: "Delivery", to: "/app/farmer/delivery" },
  { label: "Digital Twin", to: "/app/farmer/twin" },
  { label: "Alerts", to: "/app/farmer/alerts" },
  { label: "History", to: "/app/farmer/history" },
  { label: "Help", to: "/app/farmer/help" },
];

export function NativeFarmerShell({ title, subtitle, children }: NativeFarmerShellProps) {
  const { lang, setLang, t } = useLanguage();
  const [chatOpen, setChatOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="native-app-frame">
      <header className="native-topbar">
        <div className="native-topbar-left">
          <img src="/logo.png" alt="" className="native-topbar-icon" />
          <span className="native-topbar-name">JalSetu</span>
        </div>
        <div className="native-topbar-right">
          <select
            className="native-lang-select"
            aria-label={t("Language")}
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            {LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="native-avatar">
            <UserButton />
          </span>
        </div>
      </header>

      <main className="native-content">
        <div className="native-content-head">
          <h1>{title}</h1>
          {subtitle && <p className="native-content-sub">{subtitle}</p>}
        </div>
        {children}
      </main>

      <nav className="native-tabbar" aria-label={t("Dashboard navigation")}>
        {TABS.map(({ key, label, to, end, icon: Icon }) => (
          <NavLink
            key={key}
            to={to}
            end={end}
            className={({ isActive }) => `native-tab${isActive ? " active" : ""}`}
            onClick={() => setMoreOpen(false)}
          >
            <Icon />
            <span>{t(label)}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`native-tab${moreOpen ? " active" : ""}`}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <MoreIcon />
          <span>{t("More")}</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <div className="native-sheet-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="native-sheet">
            <div className="native-sheet-handle" />
            {MORE_ITEMS.map((item) => (
              <button
                key={item.to}
                type="button"
                className="native-sheet-item"
                onClick={() => {
                  setMoreOpen(false);
                  navigate(item.to);
                }}
              >
                {t(item.label)}
              </button>
            ))}
          </div>
        </>
      )}

      <AssistantFab onOpen={() => setChatOpen(true)} />
      <AssistantChat open={chatOpen} onClose={() => setChatOpen(false)} roleLabel="Farmer" />
    </div>
  );
}
