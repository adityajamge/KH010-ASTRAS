import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { NetworkStateResponse } from "../../lib/api";
import { DAM_X, type TwinLayout } from "./useTwinLayout";

export function Dam({
  dam,
  layout,
  depth,
  selected,
  onSelect,
}: {
  dam: NetworkStateResponse["dam"];
  layout: TwinLayout;
  depth: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const ratio =
    dam.total_available > 0 ? THREE.MathUtils.clamp(dam.current_storage / dam.total_available, 0, 1) : 0;
  const groundY = layout.elevation(DAM_X, 0);
  const crest = groundY + 2.3;
  const resLevel = groundY + 0.35 + ratio * 1.5;
  const spanZ = Math.min(depth * 0.42, 11);
  const glow = selected ? "#6fb8ea" : "#000000";
  const resCenterX = DAM_X - 5.5;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect();
  };

  return (
    <group>
      {/* dam wall + crest road */}
      <mesh position={[DAM_X, crest / 2, 0]} castShadow onClick={handleClick}>
        <boxGeometry args={[1.8, crest, spanZ * 2]} />
        <meshStandardMaterial color="#b3ab9c" emissive={glow} emissiveIntensity={selected ? 0.25 : 0} />
      </mesh>
      <mesh position={[DAM_X, crest + 0.12, 0]}>
        <boxGeometry args={[2.3, 0.24, spanZ * 2 + 0.4]} />
        <meshStandardMaterial color="#d0c9ba" />
      </mesh>

      {/* head-regulator gate house + steel gate */}
      <mesh position={[DAM_X + 1.1, crest - 0.6, 0]} castShadow>
        <boxGeometry args={[1.6, 1.8, 2.2]} />
        <meshStandardMaterial color="#d0c9ba" />
      </mesh>
      <mesh position={[DAM_X + 1.7, resLevel + 0.7, 0]}>
        <boxGeometry args={[0.16, 1.3, 1.2]} />
        <meshStandardMaterial color="#9aa0a6" roughness={0.4} metalness={0.35} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[DAM_X + 1.7, resLevel + 2.0, s * 0.7]}>
          <cylinderGeometry args={[0.05, 0.05, 1.0, 12]} />
          <meshStandardMaterial color="#9aa0a6" roughness={0.4} metalness={0.35} />
        </mesh>
      ))}

      {/* downstream buttresses */}
      {Array.from({ length: Math.max(1, Math.round(spanZ / 2.6)) }, (_, i) => {
        const n = Math.max(1, Math.round(spanZ / 2.6));
        const z = (i - (n - 1) / 2) * 2.6;
        const hb = Math.max(0.5, groundY - 0.5);
        return (
          <mesh key={i} position={[DAM_X + 1.45, hb / 2, z]} castShadow>
            <boxGeometry args={[1.6, hb, 0.5]} />
            <meshStandardMaterial color="#a89e8c" />
          </mesh>
        );
      })}

      {/* reservoir surface — level rises and falls with current_storage */}
      <mesh position={[resCenterX, resLevel, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick}>
        <planeGeometry args={[9, spanZ * 1.9]} />
        <meshStandardMaterial
          color="#2b6f96"
          roughness={0.1}
          metalness={0.25}
          transparent
          opacity={0.92}
          emissive={glow}
          emissiveIntensity={selected ? 0.15 : 0}
        />
      </mesh>

      <Html position={[resCenterX, resLevel + 1.3, 0]} center distanceFactor={16}>
        <div className="twin-label">
          <strong>{dam.name}</strong>
          <span>
            {dam.water_level.toFixed(1)} m · {dam.status}
          </span>
        </div>
      </Html>
    </group>
  );
}
