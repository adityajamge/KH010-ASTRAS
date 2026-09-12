import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { makeFlowTexture } from "./flowTexture";
import type { TwinLayout } from "./useTwinLayout";

export type FlowLevel = "full" | "low" | "none";

interface Segment {
  pos: [number, number, number];
  rotY: number;
  rotX: number;
  len: number;
}

function buildSegments(points: [number, number][], layout: TwinLayout): Segment[] {
  let totalLen = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    totalLen += Math.hypot(x1 - x0, z1 - z0);
  }
  const step = Math.max(1.2, totalLen / 40);

  const dense: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    const L = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(L / step));
    for (let j = 0; j < n; j++) {
      dense.push([x0 + (x1 - x0) * (j / n), z0 + (z1 - z0) * (j / n)]);
    }
  }
  dense.push(points[points.length - 1]);

  const segs: Segment[] = [];
  for (let i = 0; i < dense.length - 1; i++) {
    const [x0, z0] = dense[i];
    const [x1, z1] = dense[i + 1];
    const y0 = layout.elevation(x0, z0);
    const y1 = layout.elevation(x1, z1);
    const run = Math.hypot(x1 - x0, z1 - z0);
    if (run < 1e-6) continue;
    const len = Math.hypot(run, y1 - y0);
    segs.push({
      pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
      rotY: Math.atan2(x1 - x0, z1 - z0),
      rotX: -Math.atan2(y1 - y0, run),
      len,
    });
  }
  return segs;
}

/**
 * A concrete trough + flowing water ribbon that follows the terrain along a
 * polyline — used for both the main header canal and each canal's lane, and
 * for the short field channels off to a farm plot. `flow` (from the live
 * canal's flow_state / current_flow) drives water color, width, and the
 * animated ripple speed.
 */
export function Channel({
  points,
  layout,
  width = 0.9,
  flow,
  highlighted,
  onClick,
}: {
  points: [number, number][];
  layout: TwinLayout;
  width?: number;
  flow: FlowLevel;
  highlighted?: boolean;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const segments = useMemo(() => buildSegments(points, layout), [points, layout]);
  const texture = useMemo(() => makeFlowTexture(flow === "low"), [flow]);

  useFrame((_, delta) => {
    if (flow === "none") return;
    // Points run head -> tail; offset.y increasing (not decreasing) is what
    // makes the ripple pattern read as flowing downstream, dam to farms.
    texture.offset.y += delta * (flow === "low" ? 0.18 : 0.5);
  });

  const waterW = flow === "low" ? width * 0.55 : width;
  const waterColor = flow === "low" ? "#7aa6b6" : "#3b8fbd";
  const waterY = flow === "low" ? 0.2 : 0.27;
  const troughColor = flow === "none" ? "#b49a74" : "#d0c9ba";
  const glow = highlighted ? "#ffffff" : "#000000";

  return (
    <group>
      {segments.map((s, i) => (
        <group key={i} position={s.pos} rotation={[0, s.rotY, 0]}>
          <group rotation={[s.rotX, 0, 0]}>
            <mesh onClick={onClick} castShadow receiveShadow>
              <boxGeometry args={[width + 0.5, 0.5, s.len * 1.02]} />
              <meshStandardMaterial color={troughColor} roughness={0.88} emissive={glow} emissiveIntensity={highlighted ? 0.2 : 0} />
            </mesh>
            {flow !== "none" && (
              <mesh position={[0, waterY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[waterW, s.len * 1.02]} />
                <meshStandardMaterial
                  color={waterColor}
                  map={texture}
                  roughness={0.14}
                  metalness={0.25}
                  transparent
                  opacity={flow === "low" ? 0.8 : 0.94}
                />
              </mesh>
            )}
          </group>
        </group>
      ))}
    </group>
  );
}
