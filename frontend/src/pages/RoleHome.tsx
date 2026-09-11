import { useUser } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";
import { isAppRole, roleHome } from "../lib/roles";

/** Signed-in landing: send each role to its dashboard. Unknown role → /no-access. */
export function RoleHomePage() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;

  const role = user?.publicMetadata?.role;
  if (!isAppRole(role)) return <Navigate to="/no-access" replace />;
  return <Navigate to={roleHome(role)} replace />;
}
