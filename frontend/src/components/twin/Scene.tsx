import { useMemo } from "react";
import { Html } from "@react-three/drei";
import type { NetworkStateResponse, TwinCanal, TwinFarmer } from "../../lib/api";
import { FLOW_COLOR, STATUS_COLOR } from "./twinStyle";
import { FlowParticles } from "./FlowParticles";

export type Selection =
  | { kind: "dam" }
  | { kind: "canal"; id: number }
  | { kind: "farmer"; id: number };

const DAM_X = -7;
const CANAL_START_X = -3.5;
const CANAL_LENGTH = 11;
const LANE_GAP = 3.2;

function Reservoir({
  dam,
  selected,
  onSelect,
}: {
  dam: NetworkStateResponse["dam"];
  selected: boolean;
  onSelect: () => void;
}) {
  const ratio = dam.total_available > 0 ? Math.min(1, dam.current_storage / dam.total_available) : 0;
  const fillHeight = 0.4 + ratio * 2.2;
  return (
    <group position={[DAM_X, 0, 0]}>
      {/* Dam wall */}
      <mesh position={[0.9, 1.1, 0]} castShadow>
        <boxGeometry args={[0.6, 2.4, 3.4]} />
        <meshStandardMaterial color="#8a8f98" />
      </mesh>
      {/* Reservoir water body */}
      <mesh
        position={[-0.9, fillHeight / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <cylinderGeometry args={[1.7, 1.9, fillHeight, 24]} />
        <meshStandardMaterial
          color="#2f6fb0"
          emissive={selected ? "#5aa0e0" : "#000000"}
          emissiveIntensity={selected ? 0.5 : 0}
          transparent
          opacity={0.88}
        />
      </mesh>
      <Html position={[-0.9, fillHeight + 0.8, 0]} center distanceFactor={14}>
        <div className="twin-label">
          <strong>{dam.name}</strong>
          <span>{dam.water_level.toFixed(1)} m · {dam.status}</span>
        </div>
      </Html>
    </group>
  );
}

function FarmerPlot({
  farmer,
  position,
  selected,
  onSelect,
}: {
  farmer: TwinFarmer;
  position: [number, number, number];
  selected: boolean;
  onSelect: () => void;
}) {
  const color = STATUS_COLOR[farmer.twin_status];
  return (
    <group position={position}>
      <mesh
        position={[0, 0.25, 0]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <boxGeometry args={[0.9, 0.5, 0.9]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.7 : 0}
        />
      </mesh>
      <Html position={[0, 0.95, 0]} center distanceFactor={16}>
        <div className={`twin-label twin-label-farmer status-${farmer.twin_status}`}>
          {farmer.name}
        </div>
      </Html>
    </group>
  );
}

function CanalLane({
  canal,
  z,
  selected,
  selectedFarmerId,
  onSelectCanal,
  onSelectFarmer,
}: {
  canal: TwinCanal;
  z: number;
  selected: boolean;
  selectedFarmerId: number | null;
  onSelectCanal: () => void;
  onSelectFarmer: (id: number) => void;
}) {
  const farmerPositions = useMemo(() => {
    const count = canal.farmers.length;
    if (count === 0) return [];
    // Evenly spaced along the pipe, head-end first — a layout convenience,
    // not a measured physical distance (see backend TwinFarmer.order_index).
    const step = CANAL_LENGTH / (count + 1);
    return canal.farmers.map((_, i) => CANAL_START_X + step * (i + 1));
  }, [canal.farmers]);

  const ratio = canal.capacity > 0 ? canal.current_flow / canal.capacity : 0;
  const pipeColor = FLOW_COLOR[canal.flow_state];

  return (
    <group position={[0, 0, z]}>
      {/* Canal pipe/channel */}
      <mesh
        position={[CANAL_START_X + CANAL_LENGTH / 2, 0.05, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectCanal();
        }}
      >
        <boxGeometry args={[CANAL_LENGTH, 0.12, 0.7]} />
        <meshStandardMaterial
          color={pipeColor}
          emissive={selected ? "#ffffff" : "#000000"}
          emissiveIntensity={selected ? 0.25 : 0}
        />
      </mesh>
      {canal.active_conflicts > 0 && (
        <mesh position={[CANAL_START_X + CANAL_LENGTH / 2, 0.4, 0]}>
          <boxGeometry args={[CANAL_LENGTH, 0.03, 0.9]} />
          <meshStandardMaterial color="#d1453b" transparent opacity={0.35} />
        </mesh>
      )}
      <FlowParticles
        start={[CANAL_START_X, 0.1, 0]}
        end={[CANAL_START_X + CANAL_LENGTH, 0.1, 0]}
        ratio={ratio}
        color="#bfe0ff"
      />
      <Html position={[CANAL_START_X - 1.1, 0.6, 0]} center distanceFactor={16}>
        <div className="twin-label">
          <strong>{canal.name}</strong>
          <span>{canal.current_flow.toFixed(0)}/{canal.capacity.toFixed(0)}</span>
        </div>
      </Html>
      {canal.farmers.map((farmer, i) => (
        <FarmerPlot
          key={farmer.farmer_id}
          farmer={farmer}
          position={[farmerPositions[i], 0, 0]}
          selected={selectedFarmerId === farmer.farmer_id}
          onSelect={() => onSelectFarmer(farmer.farmer_id)}
        />
      ))}
    </group>
  );
}

export function Scene({
  state,
  selection,
  onSelect,
}: {
  state: NetworkStateResponse;
  selection: Selection | null;
  onSelect: (s: Selection) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 4]} intensity={1.1} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#e9e4d6" />
      </mesh>

      <Reservoir
        dam={state.dam}
        selected={selection?.kind === "dam"}
        onSelect={() => onSelect({ kind: "dam" })}
      />

      {/* Main canal stub connecting the dam to the branch lanes. */}
      <mesh position={[(DAM_X + CANAL_START_X) / 2, 0.05, 0]}>
        <boxGeometry args={[CANAL_START_X - DAM_X, 0.12, 0.5]} />
        <meshStandardMaterial color="#2f6fb0" />
      </mesh>

      {state.canals.map((canal, i) => (
        <CanalLane
          key={canal.canal_id}
          canal={canal}
          z={(i - (state.canals.length - 1) / 2) * LANE_GAP}
          selected={selection?.kind === "canal" && selection.id === canal.canal_id}
          selectedFarmerId={selection?.kind === "farmer" ? selection.id : null}
          onSelectCanal={() => onSelect({ kind: "canal", id: canal.canal_id })}
          onSelectFarmer={(id) => onSelect({ kind: "farmer", id })}
        />
      ))}
    </>
  );
}
