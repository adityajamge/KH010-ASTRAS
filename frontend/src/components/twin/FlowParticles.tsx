import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Small spheres translating along [start, end] to suggest water movement.
 * Speed is proportional to the canal's flow ratio — a canal with no flow
 * renders no particles, so the animation never implies movement that isn't
 * backed by the fetched `current_flow` value.
 */
export function FlowParticles({
  start,
  end,
  ratio,
  color,
}: {
  start: [number, number, number];
  end: [number, number, number];
  ratio: number;
  color: string;
}) {
  const count = 5;
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const offsets = useMemo(
    () => Array.from({ length: count }, (_, i) => i / count),
    [count],
  );

  useFrame((state) => {
    if (ratio <= 0) return;
    const speed = 0.08 + ratio * 0.35;
    const t0 = state.clock.elapsedTime * speed;
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const t = (t0 + offsets[i]) % 1;
      mesh.position.set(
        THREE.MathUtils.lerp(start[0], end[0], t),
        THREE.MathUtils.lerp(start[1], end[1], t) + 0.12,
        THREE.MathUtils.lerp(start[2], end[2], t),
      );
    });
  });

  if (ratio <= 0) return null;

  return (
    <group>
      {offsets.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  );
}
