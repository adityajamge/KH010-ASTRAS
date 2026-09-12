import { useMemo } from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { NetworkStateResponse, TwinCanal } from "../../lib/api";
import { Dam } from "./Dam";
import { Channel, type FlowLevel } from "./Channel";
import { FarmPlot } from "./FarmPlot";
import { Terrain } from "./Terrain";
import { CANAL_START_X, DAM_X, LANE_GAP, useTwinLayout, type TwinLayout } from "./useTwinLayout";

export type Selection =
  | { kind: "dam" }
  | { kind: "canal"; id: number }
  | { kind: "farmer"; id: number };

function flowLevel(canal: TwinCanal): FlowLevel {
  if (canal.current_flow <= 0) return "none";
  return canal.flow_state === "low" ? "low" : "full";
}

function CanalLane({
  canal,
  z,
  layout,
  selected,
  selectedFarmerId,
  onSelectCanal,
  onSelectFarmer,
}: {
  canal: TwinCanal;
  z: number;
  layout: TwinLayout;
  selected: boolean;
  selectedFarmerId: number | null;
  onSelectCanal: () => void;
  onSelectFarmer: (id: number) => void;
}) {
  const farmerXs = useMemo(() => {
    const count = canal.farmers.length;
    if (count === 0) return [];
    // Evenly spaced along the lane, head-end first — a layout convenience,
    // not a measured physical distance (see backend TwinFarmer.order_index).
    const step = layout.canalLength / (count + 1);
    return canal.farmers.map((_, i) => CANAL_START_X + step * (i + 1));
  }, [canal.farmers, layout.canalLength]);

  const flow = flowLevel(canal);
  const handleSelectCanal = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectCanal();
  };
  const laneEndX = CANAL_START_X + layout.canalLength;
  const midX = CANAL_START_X + layout.canalLength / 2;

  return (
    <group>
      {/* offtake from the main canal out to this lane's z-offset */}
      <Channel
        points={[
          [CANAL_START_X, 0],
          [CANAL_START_X, z],
        ]}
        layout={layout}
        width={0.55}
        flow={flow}
        highlighted={selected}
        onClick={handleSelectCanal}
      />
      <Channel
        points={[
          [CANAL_START_X, z],
          [laneEndX, z],
        ]}
        layout={layout}
        width={0.9}
        flow={flow}
        highlighted={selected}
        onClick={handleSelectCanal}
      />

      <Html position={[CANAL_START_X - 1.3, layout.elevation(CANAL_START_X - 1.3, z) + 1.0, z]} center distanceFactor={16}>
        <div className="twin-label">
          <strong>{canal.name}</strong>
          <span>
            {canal.current_flow.toFixed(0)}/{canal.capacity.toFixed(0)}
          </span>
        </div>
      </Html>

      {canal.active_conflicts > 0 && (
        <Html position={[midX, layout.elevation(midX, z) + 1.6, z]} center distanceFactor={18}>
          <div className="twin-alert-tag">
            {canal.active_conflicts} conflict{canal.active_conflicts > 1 ? "s" : ""}
          </div>
        </Html>
      )}

      {canal.farmers.map((farmer, i) => (
        <FarmPlot
          key={farmer.farmer_id}
          farmer={farmer}
          x={farmerXs[i]}
          z={z}
          layout={layout}
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
  const layout = useTwinLayout(state);
  const depth = Math.max(24, state.canals.length * LANE_GAP + 10);

  return (
    <>
      <hemisphereLight args={["#ffffff", "#d8d2c4", 0.65]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[8, 14, 6]} intensity={1.3} castShadow shadow-mapSize={[2048, 2048]} />

      <Terrain layout={layout} depth={depth} />

      <Dam
        dam={state.dam}
        layout={layout}
        depth={depth}
        selected={selection?.kind === "dam"}
        onSelect={() => onSelect({ kind: "dam" })}
      />

      {/* header canal from the dam outlet to the point the lanes split off */}
      <Channel
        points={[
          [DAM_X + 0.9, 0],
          [CANAL_START_X, 0],
        ]}
        layout={layout}
        width={1.1}
        flow="full"
      />

      {state.canals.map((canal, i) => (
        <CanalLane
          key={canal.canal_id}
          canal={canal}
          z={layout.laneZ(i, state.canals.length)}
          layout={layout}
          selected={selection?.kind === "canal" && selection.id === canal.canal_id}
          selectedFarmerId={selection?.kind === "farmer" ? selection.id : null}
          onSelectCanal={() => onSelect({ kind: "canal", id: canal.canal_id })}
          onSelectFarmer={(id) => onSelect({ kind: "farmer", id })}
        />
      ))}
    </>
  );
}
