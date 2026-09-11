import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ApiError, getFarmerProfile } from "../lib/api";
import { FarmerOnboardingForm } from "../pages/FarmerOnboarding";

type GateState =
  | { status: "loading" }
  | { status: "needs-onboarding" }
  | { status: "ready" }
  | { status: "error"; message: string };

/**
 * Wraps the farmer dashboard: checks GET /farmers/me and shows the
 * onboarding form instead of the dashboard until that profile exists.
 */
export function FarmerOnboardingGate({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const [state, setState] = useState<GateState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const token = await getToken();
      if (!token) {
        setState({
          status: "error",
          message: "Could not verify your session. Please sign in again.",
        });
        return;
      }
      const profile = await getFarmerProfile(token);
      setState(profile ? { status: "ready" } : { status: "needs-onboarding" });
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof ApiError
            ? err.message
            : "Could not reach JalSetu. Please try again.",
      });
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === "loading") {
    return (
      <main className="page">
        <section className="loading-screen">
          <p className="hero-note">Loading your profile…</p>
        </section>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="page">
        <section className="auth-wrap">
          <h1>Something went wrong</h1>
          <p className="muted">{state.message}</p>
          <button className="btn btn-secondary" type="button" onClick={load}>
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (state.status === "needs-onboarding") {
    return <FarmerOnboardingForm onComplete={load} />;
  }

  return <>{children}</>;
}
