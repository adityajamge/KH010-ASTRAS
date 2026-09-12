import { useNavigate } from "react-router-dom";
import { useLanguage } from "../lib/i18n";

/**
 * First screen shown when the Android/iOS app cold-starts (App.tsx routes
 * "/" here instead of the marketing Landing page when
 * Capacitor.isNativePlatform() is true) — a native app opens to its own
 * onboarding identity, not a website hero section built for a browser tab.
 */
export function NativeWelcome() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <main className="native-welcome">
      <div className="native-welcome-body">
        <div className="native-welcome-icon">
          <img src="/logo.png" alt="JalSetu" />
        </div>
        <h1 className="native-welcome-title">JalSetu</h1>
        <p className="native-welcome-subtitle">
          {t("Water-Sharing Dispute Mediation")}
        </p>
        <p className="native-welcome-desc">
          {t(
            "The complete platform to request water, negotiate fairly, and track your allocation on the canal.",
          )}
        </p>
      </div>

      <div className="native-welcome-actions">
        <button
          type="button"
          className="native-welcome-cta"
          onClick={() => navigate("/sign-up")}
        >
          {t("Get Started")}
          <span aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          className="native-welcome-link"
          onClick={() => navigate("/sign-in")}
        >
          {t("I already have an account")}
        </button>
      </div>
    </main>
  );
}
