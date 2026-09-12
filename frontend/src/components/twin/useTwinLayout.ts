import { useMemo } from "react";
import * as THREE from "three";
import type { NetworkStateResponse } from "../../lib/api";

/** World axes: x = downstream distance (dam is upstream/negative), z = lane
 * offset across parallel canals, y = terrain elevation in scene units. */
export const DAM_X = -9;
export const HEAD_X = -6.2;
export const CANAL_START_X = -3.6;
export const LANE_GAP = 4.6;

export interface TwinLayout {
  canalLength: number;
  tailX: number;
  laneZ: (index: number, count: number) => number;
  elevation: (x: number, z: number) => number;
}

function smooth(u: number): number {
  const v = THREE.MathUtils.clamp(u, 0, 1);
  return v * v * (3 - 2 * v);
}

/**
 * Terrain + spacing for the twin scene, derived from the live network shape
 * (canal count, longest farmer chain) rather than a fixed farm count — so a
 * canal with 3 farmers and one with 12 both lay out sensibly.
 */
export function useTwinLayout(state: NetworkStateResponse): TwinLayout {
  const canalCount = state.canals.length;
  const maxFarmers = Math.max(1, ...state.canals.map((c) => c.farmers.length));

  return useMemo(() => {
    const canalLength = THREE.MathUtils.clamp(maxFarmers * 3.4, 11, 46);
    const tailX = CANAL_START_X + canalLength;

    const elevation = (x: number, z: number): number => {
      const span = Math.max(1, tailX - HEAD_X);
      const t = THREE.MathUtils.clamp((tailX - x) / span, 0, 1);
      let y = 2.4 * t + 0.1 * Math.sin(x * 0.5) * Math.cos(z * 0.4);
      if (x < HEAD_X) {
        const zf = Math.max(0, 1 - Math.pow(Math.min(Math.abs(z), 9) / 9, 3));
        y += 1.3 * smooth((Math.abs(z) - 6.5) / 2.4) * smooth((HEAD_X - x) / 1.4);
        y -= 2.5 * smooth((HEAD_X - x) / 3.2) * smooth((x - DAM_X + 6) / 3) * zf;
      }
      return y;
    };

    const laneZ = (index: number, count: number) => (index - (count - 1) / 2) * LANE_GAP;

    return { canalLength, tailX, laneZ, elevation };
  }, [maxFarmers, canalCount]);
}
