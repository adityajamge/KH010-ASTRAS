import { ClerkProvider } from "@clerk/clerk-react";
import { Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { NoAccessPage } from "./pages/NoAccess";
import { RoleHomePage } from "./pages/RoleHome";
import { FarmerDashboardPage } from "./pages/dashboards/Farmer";
import { JalVigyaniDashboardPage } from "./pages/dashboards/JalVigyani";
import { DamOperatorDashboardPage } from "./pages/dashboards/DamOperator";
import { RequireRole } from "./components/RequireRole";
import { RouteProgressBar } from "./components/RouteProgressBar";
import { ROLES } from "./lib/roles";
import "./App.css";

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function MissingKeyNotice() {
  return (
    <main className="page">
      <section className="auth-wrap">
        <h1>Auth not configured</h1>
        <p className="muted">
          Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in{" "}
          <code>frontend/.env.development</code> (see{" "}
          <code>.env.example</code>) with the publishable key from your Clerk
          dashboard, then restart <code>npm run dev</code>.
        </p>
      </section>
    </main>
  );
}

function App() {
  if (!clerkKey) {
    return <MissingKeyNotice />;
  }

  return (
    <ClerkProvider publishableKey={clerkKey}>
      <RouteProgressBar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="/no-access" element={<NoAccessPage />} />
        <Route path="/app" element={<RoleHomePage />} />
        <Route
          path="/app/farmer/*"
          element={
            <RequireRole roles={[ROLES.FARMER]}>
              <FarmerDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/app/jal-vigyani/*"
          element={
            <RequireRole roles={[ROLES.JAL_VIGYANI]}>
              <JalVigyaniDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/app/dam/*"
          element={
            <RequireRole roles={[ROLES.DAM_OPERATOR]}>
              <DamOperatorDashboardPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<NoAccessPage />} />
      </Routes>
    </ClerkProvider>
  );
}

export default App;
