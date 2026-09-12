import * as THREE from "three";

/** Small chevron ripple pattern, tiled and scrolled along the flow direction
 * to read as moving water without a video texture or shader. */
export function makeFlowTexture(light: boolean): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = light ? "#e6f4fb" : "#b9dcee";
  g.lineWidth = light ? 1.5 : 3;
  for (let i = -1; i < 4; i++) {
    const y = i * 20;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(32, y + 9);
    g.lineTo(64, y);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
