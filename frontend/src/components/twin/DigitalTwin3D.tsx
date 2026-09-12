import { useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useAuthedData } from "../../lib/useAuthedData";
import { getNetworkState, type NetworkStateResponse, type TwinFarmer } from "../../lib/api";
import { Scene, type Selection } from "./Scene";
import { STATUS_COLOR, STATUS_LABEL } from "./twinStyle";
import "./twin.css";

// 15s, not 10s: each poll is a real round trip to a remote Postgres that
// costs several seconds even after batching its queries (see
// app/services/network_state.py) — polling less aggressively meaningfully
// cuts backend load without making the twin feel noticeably less live.
const REFRESH_MS = 15_000;

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function findFarmer(state: NetworkStateResponse, id: number): { farmer: TwinFarmer; canalName: string } | null {
  for (const canal of state.canals) {
    const farmer = canal.farmers.find((f) => f.farmer_id === id);
    if (farmer) return { farmer, canalName: canal.name };
  }
  return null;
}

function DetailPanel({
  state,
  selection,
}: {
  state: NetworkStateResponse;
  selection: Selection | null;
}) {
  if (!selection) {
    return (
      <div className="twin-panel">
        <p className="twin-panel-hint">
          Click the reservoir, a canal, or a farmer plot to see its live data.
        </p>
        <Legend />
      </div>
    );
  }

  if (selection.kind === "dam") {
    const { dam } = state;
    return (
      <div className="twin-panel">
        <h3>{dam.name}</h3>
        <Row label="Status" value={dam.status} />
        <Row label="Reservoir level" value={`${fmt(dam.water_level)} m`} />
        <Row label="Current storage" value={fmt(dam.current_storage)} />
        <Row label="Total available" value={fmt(dam.total_available)} />
        <Row label="Inflow" value={`${fmt(dam.inflow)} /day`} />
        <Row label="Outflow" value={`${fmt(dam.outflow)} /day`} />
        <Row label="Rainfall (24h)" value={`${fmt(dam.rainfall_last_24h)} mm`} />
      </div>
    );
  }

  if (selection.kind === "canal") {
    const canal = state.canals.find((c) => c.canal_id === selection.id);
    if (!canal) return null;
    return (
      <div className="twin-panel">
        <h3>Canal {canal.name}</h3>
        <Row label="Flow" value={`${fmt(canal.current_flow)} / ${fmt(canal.capacity)}`} />
        <Row label="Flow state" value={canal.flow_state} />
        <Row label="Release accounting" value={canal.release_status} />
        <Row label="Requested" value={fmt(canal.requested)} />
        <Row label="Approved" value={fmt(canal.approved)} />
        <Row label="Received" value={fmt(canal.received)} />
        <Row label="Difference" value={fmt(canal.difference)} />
        <Row label="Active conflicts" value={String(canal.active_conflicts)} />
        <Row label="Active anomalies" value={String(canal.active_anomalies)} />
        <Row label="Farmers" value={String(canal.farmers.length)} />
      </div>
    );
  }

  const found = findFarmer(state, selection.id);
  if (!found) return null;
  const { farmer, canalName } = found;
  return (
    <div className="twin-panel">
      <h3>{farmer.name}</h3>
      <Row label="Canal" value={canalName} />
      <Row label="Position" value={farmer.position_label} />
      <Row
        label="Status"
        value={
          <span className={`twin-chip status-${farmer.twin_status}`}>
            {STATUS_LABEL[farmer.twin_status]}
          </span>
        }
      />
      <Row label="Requested" value={fmt(farmer.requested)} />
      <Row label="Allocated" value={fmt(farmer.allocated)} />
      <Row label="Delivered" value={fmt(farmer.delivered)} />
      <Row label="Shortfall" value={fmt(farmer.shortfall)} />
      <Row label="In conflict" value={farmer.has_conflict ? "Yes" : "No"} />
      <Row label="Pending objection" value={farmer.has_pending_objection ? "Yes" : "No"} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="twin-row">
      <span>{label}</span>
      <span className="val">{value}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="twin-legend">
      {(Object.keys(STATUS_COLOR) as (keyof typeof STATUS_COLOR)[]).map((key) => (
        <div className="twin-legend-item" key={key}>
          <span className="twin-legend-dot" style={{ background: STATUS_COLOR[key] }} />
          {STATUS_LABEL[key]}
        </div>
      ))}
    </div>
  );
}

/**
 * Dam -> canal -> farms digital twin. Fetches GET /api/v1/network/state —
 * the same deterministic backend the dashboards read — and polls it so the
 * scene reflects the live allocation/conflict state, not a static mock.
 */
export function DigitalTwin3D() {
  const { data, loading, error, reload } = useAuthedData(getNetworkState);
  const [selection, setSelection] = useState<Selection | null>(null);
  const reloadRef = useRef(reload);

  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    const id = window.setInterval(() => {
      // Skip the round trip entirely while the tab isn't visible — a
      // background tab has no reason to keep paying for a poll (each one
      // costs a real network round trip to the backend/DB) nobody's
      // watching; it'll refresh immediately on the visibilitychange below.
      if (document.visibilityState === "visible") reloadRef.current();
    }, REFRESH_MS);
    function onVisible() {
      if (document.visibilityState === "visible") reloadRef.current();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (loading && !data) {
    return (
      <div className="dash-block">
        <div className="card">
          <p className="hero-note">Loading the irrigation network…</p>
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="dash-block">
        <div className="card">
          <p className="negotiation-reason">
            {error ?? "The digital twin needs a canal/dam assignment to display."}
          </p>
          <div className="home-card-actions">
            <button type="button" className="btn btn-secondary btn-xs" onClick={reload}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="twin-wrap">
      <div className="twin-badge-row">
        <span className="twin-badge">{data.is_simulated ? "Simulated data" : "Live"}</span>
        <span className="twin-badge-note">{data.simulation_note}</span>
      </div>
      <div className="twin-layout">
        <div className="twin-canvas-wrap">
          <Canvas shadows camera={{ position: [4, 7, 14], fov: 45 }}>
            <Scene state={data} selection={selection} onSelect={setSelection} />
            <OrbitControls enablePan minDistance={4} maxDistance={30} />
          </Canvas>
        </div>
        <DetailPanel state={data} selection={selection} />
      </div>
    </div>
  );
}
