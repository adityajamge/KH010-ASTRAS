import { useAuth, useUser } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { isAppRole, type AppRole } from "../lib/roles";

interface RequireRoleProps {
  roles: AppRole[];
  children: ReactNode;
}

/** Route guard: must be signed in AND carry one of the allowed roles (Clerk publicMetadata.role). */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  if (!isLoaded) {
    return (
      <main className="page">
        <section className="hero">
          <p className="hero-note">Checking session…</p>
        </section>
      </main>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  const role = user?.publicMetadata?.role;
  if (!isAppRole(role) || !roles.includes(role)) {
    return <Navigate to="/no-access" replace />;
  }

  return <>{children}</>;
}
