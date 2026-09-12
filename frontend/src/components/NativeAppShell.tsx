import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { AssistantFab } from "./AssistantFab";
import { AssistantChat } from "./AssistantChat";
import { LANGUAGES, useLanguage, type Lang } from "../lib/i18n";

export interface NativeTab {
  key: string;
  label: string;
  to: string;
  end?: boolean;
  icon: ComponentType;
}

export interface NativeMoreItem {
  label: string;
  to: string;
}

interface NativeAppShellProps {
  roleLabel: string;
  title: string;
  subtitle?: string;
  tabs: NativeTab[];
  /** Extra sections that don't fit the tab bar — opens a bottom sheet from
   * a trailing "More" tab. Omit (or pass an empty array) when every
   * section already fits directly in `tabs`. */
  moreItems?: NativeMoreItem[];
  children: ReactNode;
}

/** Minimal inline icon set — no icon-font/CDN dependency, just small SVGs. */
export function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
export function DropIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3s7 8 7 12.5A7 7 0 0 1 5 15.5C5 11 12 3 12 3Z" />
    </svg>
  );
}
export function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  );
}
export function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
export function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}
export function TankIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M4 14c2-1.5 4-1.5 6 0s4 1.5 6 0 2-.7 4 0" />
    </svg>
  );
}
export function CloudRainIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 17a4.5 4.5 0 0 1-.5-8.97A5.5 5.5 0 0 1 16.5 9a4.5 4.5 0 0 1-1 8.5" transform="translate(0,-1)" />
      <path d="M8 19v1.5M12 19v1.5M16 19v1.5" />
    </svg>
  );
}
export function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m7.2 10.8 8.6-3.6M7.2 13.2l8.6 3.6" />
    </svg>
  );
}
export function HelpCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9a2.7 2.7 0 1 1 3.9 2.4c-.8.5-1.2 1-1.2 1.9" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/**
 * Shared native-app chrome for Capacitor builds: a fixed brand-colored top
 * bar and a fixed bottom tab bar, instead of the website's sidebar layout
 * (a sidebar with a dozen links reads as "a website opened on a phone",
 * not a native app). Per-role wrappers (NativeFarmerShell,
 * NativeDamOperatorShell, ...) just supply their own tabs/moreItems.
 */
export function NativeAppShell({
  roleLabel,
  title,
  subtitle,
  tabs,
  moreItems = [],
  children,
}: NativeAppShellProps) {
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
        {tabs.map(({ key, label, to, end, icon: Icon }) => (
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
        {moreItems.length > 0 && (
          <button
            type="button"
            className={`native-tab${moreOpen ? " active" : ""}`}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <MoreIcon />
            <span>{t("More")}</span>
          </button>
        )}
      </nav>

      {moreOpen && moreItems.length > 0 && (
        <>
          <div className="native-sheet-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="native-sheet">
            <div className="native-sheet-handle" />
            {moreItems.map((item) => (
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
      <AssistantChat open={chatOpen} onClose={() => setChatOpen(false)} roleLabel={roleLabel} />
    </div>
  );
}
