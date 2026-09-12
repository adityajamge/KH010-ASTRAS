import * as THREE from "three";

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/**
 * A farm's status card drawn onto a canvas and used as a sprite texture —
 * a real 3D object that shrinks with distance/perspective like everything
 * else in the scene, unlike an HTML overlay (which stays a fixed screen
 * size and clutters once several farms sit close together).
 */
export function makeFarmPanelTexture(opts: {
  name: string;
  position: string;
  allocPct: number;
  note: string;
  color: string;
}): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(22,24,23,0.92)";
  roundRect(g, 6, 6, 500, 244, 26);
  g.fill();
  g.strokeStyle = opts.color;
  g.lineWidth = 6;
  roundRect(g, 6, 6, 500, 244, 26);
  g.stroke();

  g.textBaseline = "middle";
  g.fillStyle = "#f4f1ea";
  g.font = "700 44px " + FONT;
  g.fillText(opts.name, 32, 54);

  g.fillStyle = "#8f8b80";
  g.font = "400 26px " + FONT;
  g.fillText(opts.position.toUpperCase(), 32, 94);

  g.fillStyle = opts.color;
  g.font = "700 74px " + FONT;
  g.fillText(opts.allocPct + "%", 32, 166);
  const w1 = g.measureText(opts.allocPct + "%").width;
  g.fillStyle = "#8f8b80";
  g.font = "400 24px " + FONT;
  g.fillText("OF ENTITLEMENT", 32 + w1 + 16, 176);

  g.fillStyle = opts.color;
  g.font = "700 28px " + FONT;
  g.fillText(opts.note, 32, 218);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
