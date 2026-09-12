import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { TwinFarmer } from "../../lib/api";
import { makeFarmPanelTexture } from "./panelTexture";
import { CROP_COLOR, STATUS_COLOR, STATUS_LABEL } from "./twinStyle";
import type { TwinLayout } from "./useTwinLayout";

function terrainPlane(cx: number, cz: number, w: number, d: number, lift: number, layout: TwinLayout) {
  const g = new THREE.PlaneGeometry(w, d, 8, 8);
  g.rotateX(-Math.PI / 2);
  g.translate(cx, 0, cz);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setY(i, layout.elevation(p.getX(i), p.getZ(i)) + lift);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * One farm plot: a bunded, terrain-following field tinted by twin_status,
 * a marker post with a status-colored head, an allocation gauge (allocated
 * ÷ requested), and a status card — all positioned on the same elevation
 * field the canal sits on.
 */
export function FarmPlot({
  farmer,
  x,
  z,
  layout,
  selected,
  onSelect,
}: {
  farmer: TwinFarmer;
  x: number;
  z: number;
  layout: TwinLayout;
  selected: boolean;
  onSelect: () => void;
}) {
  const ratio = useMemo(() => {
    if (farmer.requested && farmer.requested > 0 && farmer.allocated != null) {
      return THREE.MathUtils.clamp(farmer.allocated / farmer.requested, 0, 1);
    }
    return farmer.twin_status === "normal" || farmer.twin_status === "approved" ? 1 : 0.35;
  }, [farmer.requested, farmer.allocated, farmer.twin_status]);

  const bundGeo = useMemo(() => terrainPlane(x, z, 2.7, 3.1, 0.03, layout), [x, z, layout]);
  const fieldGeo = useMemo(() => terrainPlane(x, z, 2.3, 2.7, 0.08, layout), [x, z, layout]);
  const groundY = layout.elevation(x, z);
  const statusColor = STATUS_COLOR[farmer.twin_status];
  const cropColor = CROP_COLOR[farmer.twin_status];
  const gaugeH = Math.max(0.1, 1.5 * ratio);
  const allocPct = Math.round(ratio * 100);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect();
  };

  const panelTexture = useMemo(
    () =>
      makeFarmPanelTexture({
        name: farmer.name,
        position: farmer.position_label,
        allocPct,
        note: STATUS_LABEL[farmer.twin_status],
        color: statusColor,
      }),
    [farmer.name, farmer.position_label, allocPct, farmer.twin_status, statusColor],
  );
  useEffect(() => () => panelTexture.dispose(), [panelTexture]);

  return (
    <group>
      <mesh geometry={bundGeo}>
        <meshStandardMaterial color="#8d7a5d" roughness={1} />
      </mesh>
      <mesh geometry={fieldGeo} onClick={handleClick} castShadow receiveShadow>
        <meshStandardMaterial
          color={cropColor}
          roughness={0.92}
          emissive={selected ? cropColor : "#000000"}
          emissiveIntensity={selected ? 0.4 : 0}
        />
      </mesh>

      {/* marker post + status head */}
      <mesh position={[x, groundY + 0.7, z]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.4, 10]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[x, groundY + 1.48, z]} onClick={handleClick} castShadow>
        <sphereGeometry args={[0.18, 20, 14]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.5} />
      </mesh>

      {/* allocation gauge */}
      <mesh position={[x + 0.55, groundY + 0.85, z]}>
        <boxGeometry args={[0.16, 1.6, 0.16]} />
        <meshStandardMaterial color="#3a3a38" />
      </mesh>
      <mesh position={[x + 0.55, groundY + 0.04 + gaugeH / 2, z]}>
        <boxGeometry args={[0.22, gaugeH, 0.22]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.4} />
      </mesh>

      <sprite position={[x, groundY + 2.55, z]} scale={[2.7, 1.35, 1]} onClick={handleClick}>
        <spriteMaterial
          map={panelTexture}
          transparent
          depthTest
          opacity={selected ? 1 : 0.96}
        />
      </sprite>
    </group>
  );
}
