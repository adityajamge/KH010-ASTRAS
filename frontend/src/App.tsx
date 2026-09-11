import { useEffect, useState } from "react";
import { API_BASE_URL, getVersionedHealth, type HealthResponse } from "./lib/api";
import "./App.css";

type BackendState =
  | { status: "loading" }
  | { status: "ok"; data: HealthResponse }
  | { status: "error"; message: string };

function App() {
  const [backend, setBackend] = useState<BackendState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getVersionedHealth()
      .then((data) => {
        if (!cancelled) setBackend({ status: "ok", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBackend({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="container">
      <h1>JalSetu</h1>
      <p className="subtitle">Frontend setup complete. No features built yet.</p>

      <section className="card" aria-live="polite">
        <h2>Backend connection</h2>
        <p className="meta">
          API: <code>{API_BASE_URL}</code>
        </p>
        {backend.status === "loading" && <p>Checking backend health…</p>}
        {backend.status === "ok" && (
          <p className="ok">
            Backend reachable — <code>{backend.data.status}</code> (
            {backend.data.service} v{backend.data.version},{" "}
            {backend.data.environment})
          </p>
        )}
        {backend.status === "error" && (
          <p className="error">
            Backend unreachable. Start it with{" "}
            <code>uvicorn app.main:app --reload</code> in <code>/backend</code>.
            <br />
            <span className="meta">{backend.message}</span>
          </p>
        )}
      </section>
    </main>
  );
}

export default App;
