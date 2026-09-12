import { useMemo } from "react";
import * as THREE from "three";
import { DAM_X, HEAD_X, type TwinLayout } from "./useTwinLayout";

/**
 * Undulating, vertex-colored ground plane that follows `layout.elevation` —
 * the same height field the canals and farm plots sit on, so nothing floats
 * or clips as the network's shape (canal count, farm count) changes.
 */
export function Terrain({ layout, depth }: { layout: TwinLayout; depth: number }) {
  const geometry = useMemo(() => {
    const minX = DAM_X - 7;
    const maxX = layout.tailX + 3;
    const width = maxX - minX;
    const segX = Math.min(160, Math.max(40, Math.round(width * 3)));
    const segZ = Math.min(96, Math.max(24, Math.round(depth * 3)));

    const g = new THREE.PlaneGeometry(width, depth, segX, segZ);
    g.rotateX(-Math.PI / 2);
    g.translate(minX + width / 2, 0, 0);

    const pos = g.attributes.position;
    const colors: number[] = [];
    const lo = new THREE.Color("#9c8a68");
    const hi = new THREE.Color("#c9b894");
    const wet = new THREE.Color("#6f6a4e");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = layout.elevation(x, z);
      pos.setY(i, y);
      const c = lo.clone().lerp(hi, THREE.MathUtils.clamp((y - 0.2) / 2.2, 0, 1));
      if (x < HEAD_X - 1 && y < 1.6) c.lerp(wet, 0.6);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [layout, depth]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.96} />
    </mesh>
  );
}
