import * as THREE from 'three';

const stage = document.querySelector('three-d-stage');
await stage.ready;

/* ---------------------------------------------------------------- terrain */
const smooth = (u) => { const t = Math.min(1, Math.max(0, u)); return t * t * (3 - 2 * t); };

// world: x -24..18 (downstream = +x), z -12..12, y = elevation in metres
function H(x, z) {
  const t = (18 - x) / 36;
  let y = 2.9 * t + 0.35 * (1 - Math.min(Math.abs(z), 12) / 12)
        + 0.05 * Math.sin(x * 0.8) * Math.cos(z * 0.6);
  const bx = -15.5;
  if (x < bx) {                                  // reservoir basin in a valley
    const zf = Math.max(0, 1 - Math.pow(Math.min(Math.abs(z), 8.5) / 8.5, 3));
    y += 1.35 * smooth((Math.abs(z) - 6.0) / 2.4) * smooth((bx - x) / 1.2);
    y -= 2.6 * smooth((bx - x) / 3) * smooth((x + 23.5) / 2.5) * zf;
  }
  if (x > bx && x < bx + 3.2 && Math.abs(z) < 3.8) {   // stilling basin below dam
    y -= 0.95 * smooth((x - bx) / 0.9) * smooth((bx + 3.2 - x) / 0.9)
             * smooth((3.8 - Math.abs(z)) / 1.1);
  }
  return y;
}

/* -------------------------------------------------------------- materials */
function waterTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#b9dcee'; g.lineWidth = 3;
  for (let i = -1; i < 4; i++) {
    const y = i * 20;
    g.beginPath(); g.moveTo(0, y); g.lineTo(32, y + 9); g.lineTo(64, y); g.stroke();
  }
  g.strokeStyle = '#e6f4fb'; g.lineWidth = 1.5;
  for (let i = -1; i < 4; i++) {
    const y = i * 20 + 10;
    g.beginPath(); g.moveTo(0, y); g.lineTo(32, y + 9); g.lineTo(64, y); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
const flowTex = waterTexture();
const flowTexLow = flowTex.clone(); flowTexLow.needsUpdate = true;
flowTexLow.wrapS = flowTexLow.wrapT = THREE.RepeatWrapping;

const std = (name, o) => Object.assign(new THREE.MeshStandardMaterial(o), { name });
const M = {
  terrain: std('terrain_soil', { vertexColors: true, roughness: 0.96, metalness: 0 }),
  concrete: std('canal_concrete', { color: 0xd0c9ba, roughness: 0.85, metalness: 0 }),
  concreteDark: std('dam_concrete', { color: 0xb3ab9c, roughness: 0.8, metalness: 0 }),
  earthDark: std('field_bund', { color: 0x8d7a5d, roughness: 1 }),
  dryBed: std('dry_bed', { color: 0xb49a74, roughness: 1 }),
  water: std('water_flowing', {
    color: 0x3b8fbd, roughness: 0.14, metalness: 0.28, map: flowTex,
    transparent: true, opacity: 0.94,
  }),
  waterLow: std('water_deficit', {
    color: 0x7aa6b6, roughness: 0.2, metalness: 0.2, map: flowTexLow,
    transparent: true, opacity: 0.8,
  }),
  reservoir: std('water_reservoir', { color: 0x2b6f96, roughness: 0.08, metalness: 0.3 }),
  cropHealthy: std('crop_healthy', { color: 0x4c7f33, roughness: 0.9 }),
  cropStress: std('crop_stressed', { color: 0x8d8a3b, roughness: 0.92 }),
  cropDry: std('crop_dry', { color: 0xb18a56, roughness: 0.95 }),
  steel: std('steel_gate', { color: 0x9aa0a6, roughness: 0.42, metalness: 0.35 }),
  silt: std('silt_blockage', { color: 0x6c5b3f, roughness: 1 }),
  wet: std('seepage_patch', { color: 0x4a5a52, roughness: 0.35 }),
  red: std('status_critical', { color: 0xbe3b2a, roughness: 0.5 }),
  amber: std('status_warning', { color: 0xd4941c, roughness: 0.5 }),
  green: std('status_ok', { color: 0x2f8f4e, roughness: 0.5 }),
  gaugeTrack: std('gauge_track', { color: 0x3a3a38, roughness: 0.7 }),
  contour: std('contour_line', { color: 0x6d5f47, roughness: 1 }),
};
const statusMat = { OK: M.green, WARN: M.amber, BAD: M.red };
const statusHex = { OK: '#57c07c', WARN: '#e8b552', BAD: '#f0705c' };

const model = new THREE.Group();
model.name = 'irrigation_network';
const add = (mesh, name) => { mesh.name = name; model.add(mesh); return mesh; };

/* ------------------------------------------------------------------ ground */
{
  const g = new THREE.PlaneGeometry(42, 24, 168, 96);
  g.rotateX(-Math.PI / 2); g.translate(-3, 0, 0);
  const p = g.attributes.position;
  const col = [];
  const lo = new THREE.Color(0x9c8a68), hi = new THREE.Color(0xc9b894);
  const wet = new THREE.Color(0x6f6a4e);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = H(x, z);
    p.setY(i, y);
    const c = lo.clone().lerp(hi, Math.min(1, Math.max(0, (y - 0.2) / 2.2)));
    if (x < -15.0 && y < 1.85) c.lerp(wet, 0.7);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  add(new THREE.Mesh(g, M.terrain), 'terrain');
}

// contour bands — thin ribbons of constant elevation for the elevation read
for (let k = 0; k < 6; k++) {
  const level = 0.6 + k * 0.45;
  const pts = [];
  for (let z = -12; z <= 12.001; z += 0.5) {
    // solve x for H(x,z)=level by scan (monotonic in x over the farmland)
    let best = null;
    for (let x = -13.5; x <= 18; x += 0.25) if (H(x, z) <= level) { best = x; break; }
    if (best !== null) pts.push([best, z]);
  }
  if (pts.length < 2) continue;
  const grp = new THREE.Group(); grp.name = 'contour_' + level.toFixed(2);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, len), M.contour);
    m.geometry.rotateX(-Math.PI / 2);
    m.position.set((x0 + x1) / 2, H((x0 + x1) / 2, (z0 + z1) / 2) + 0.06, (z0 + z1) / 2);
    m.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    m.name = 'contour_seg';
    m.castShadow = false;
    grp.add(m);
  }
  model.add(grp);
}

/* ------------------------------------------------------------------- canal */
// polyline channel that follows the terrain: concrete trough + flow ribbon
function channel(points, opt) {
  const { width = 0.9, flow = 'full', name = 'channel', step = 1.4, lift = 0 } = opt || {};
  const grp = new THREE.Group(); grp.name = name;
  const dense = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1];
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / step));
    for (let j = 0; j < n; j++) {
      dense.push([x0 + (x1 - x0) * j / n, z0 + (z1 - z0) * j / n]);
    }
  }
  dense.push(points[points.length - 1]);
  const troughMat = flow === 'none' ? M.dryBed : M.concrete;
  const waterMat = flow === 'low' ? M.waterLow : M.water;
  for (let i = 0; i < dense.length - 1; i++) {
    const [x0, z0] = dense[i], [x1, z1] = dense[i + 1];
    const y0 = H(x0, z0) + lift, y1 = H(x1, z1) + lift;
    const run = Math.hypot(x1 - x0, z1 - z0);
    const len = Math.hypot(run, y1 - y0);
    const yaw = new THREE.Group();
    yaw.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    yaw.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    const pitch = new THREE.Group();
    pitch.rotation.x = -Math.atan2(y1 - y0, run);
    yaw.add(pitch);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.5, 0.5, len * 1.02), troughMat);
    body.name = name + '_trough';
    pitch.add(body);

    if (flow !== 'none') {
      const w = flow === 'low' ? width * 0.55 : width;
      const wg = new THREE.PlaneGeometry(w, len * 1.02);
      wg.rotateX(-Math.PI / 2);
      const uv = wg.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * (len / 1.1));
      const wm = new THREE.Mesh(wg, waterMat);
      wm.position.y = flow === 'low' ? 0.2 : 0.27;
      wm.name = name + '_water';
      wm.castShadow = false;
      pitch.add(wm);
    }
    grp.add(yaw);
  }
  model.add(grp);
  return grp;
}

const HEAD_X = -12.2, TAIL_X = 15.2;
channel([[HEAD_X, 0], [3.0, 0]], { width: 1.15, name: 'main_canal_head', flow: 'full' });
channel([[3.0, 0], [TAIL_X, 0]], { width: 1.15, name: 'main_canal_tail', flow: 'low' });

// distributaries: x position, +z flow, -z flow
const DIST = [
  { x: -10.5, up: 'full', dn: 'full' },
  { x: -5.0, up: 'full', dn: 'full' },
  { x: 0.5, up: 'full', dn: 'block' },
  { x: 6.0, up: 'low', dn: 'low' },
  { x: 11.5, up: 'low', dn: 'none' },
];
DIST.forEach((d, i) => {
  const n = 'distributary_D' + (i + 1);
  if (d.up === 'block') {
    channel([[d.x, 0.8], [d.x, 3.0]], { width: 0.6, name: n + '_up', flow: 'full' });
    channel([[d.x, 3.0], [d.x, 9.6]], { width: 0.6, name: n + '_up_dry', flow: 'none' });
  } else channel([[d.x, 0.8], [d.x, 9.6]], { width: 0.6, name: n + '_up', flow: d.up });
  if (d.dn === 'block') {
    channel([[d.x, -0.8], [d.x, -3.0]], { width: 0.6, name: n + '_dn', flow: 'full' });
    channel([[d.x, -3.0], [d.x, -9.6]], { width: 0.6, name: n + '_dn_dry', flow: 'none' });
  } else channel([[d.x, -0.8], [d.x, -9.6]], { width: 0.6, name: n + '_dn', flow: d.dn });
});

/* --------------------------------------------------------------------- dam */
const DAM_X = -15.5;
const DAM_GROUND = H(DAM_X, 0);
const CREST = DAM_GROUND + 1.2;
const RES_LEVEL = DAM_GROUND + 0.1;
const POOL = H(-13.9, 0) + 0.3;
{
  const dam = new THREE.Group(); dam.name = 'dam';
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.7, CREST, 19), M.concreteDark);
  wall.position.set(DAM_X, CREST / 2, 0); wall.name = 'dam_wall';
  dam.add(wall);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.22, 19.2), M.concrete);
  cap.position.set(DAM_X, CREST + 0.11, 0); cap.name = 'dam_crest_road';
  dam.add(cap);
  for (let i = -3; i <= 3; i++) {                      // parapet posts
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), M.concrete);
    p.position.set(DAM_X + 0.95, CREST + 0.45, i * 2.6); p.name = 'dam_parapet_post';
    dam.add(p);
  }
  for (let i = -3; i <= 3; i++) {                      // downstream buttresses
    const hb = DAM_GROUND - 0.5;
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, hb, 0.55), M.concreteDark);
    b.position.set(DAM_X + 1.45, hb / 2, i * 2.6); b.name = 'dam_buttress';
    dam.add(b);
  }
  // head-regulator: gate house + steel gate + outlet chute into the canal
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.0, 2.8), M.concrete);
  frame.position.set(DAM_X + 0.2, CREST - 0.5, 0); frame.name = 'head_regulator_house';
  dam.add(frame);
  const gate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 1.6), M.steel);
  gate.position.set(DAM_X + 1.55, POOL + 0.85, 0); gate.name = 'head_regulator_gate';
  dam.add(gate);
  for (const s of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 16), M.steel);
    st.position.set(DAM_X + 1.55, POOL + 2.35, s * 0.9); st.name = 'gate_stem';
    dam.add(st);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 2.4), M.steel);
  deck.position.set(DAM_X + 1.55, POOL + 3.05, 0); deck.name = 'gate_hoist_deck';
  dam.add(deck);
  const chute = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 1.8), M.concrete);
  chute.position.set(DAM_X + 2.6, POOL + 0.2, 0); chute.rotation.z = 0.2;
  chute.name = 'outlet_chute';
  dam.add(chute);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 5.8), M.reservoir);
  pool.geometry.rotateX(-Math.PI / 2);
  pool.position.set(-13.9, POOL, 0); pool.name = 'stilling_basin_pool';
  pool.castShadow = false;
  dam.add(pool);
  model.add(dam);

  // reservoir surface — a flat sheet the valley terrain clips into a shoreline
  const rg = new THREE.PlaneGeometry(8.0, 21);
  rg.rotateX(-Math.PI / 2); rg.translate(-19.6, 0, 0);
  const res = new THREE.Mesh(rg, M.reservoir);
  res.position.y = RES_LEVEL; res.name = 'reservoir_water'; res.castShadow = false;
  model.add(res);
}

/* ------------------------------------------------------------------ labels */
function sprite(draw, w, h, worldW, worldH) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
  const s = new THREE.Sprite(mat);
  s.scale.set(worldW, worldH, 1);
  return s;
}
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r); g.closePath();
}
function panel(id, farmer, alloc, note, status) {
  return sprite((g) => {
    g.fillStyle = 'rgba(22,24,23,0.92)';
    roundRect(g, 6, 6, 500, 244, 26); g.fill();
    g.strokeStyle = statusHex[status]; g.lineWidth = 6;
    roundRect(g, 6, 6, 500, 244, 26); g.stroke();
    g.textBaseline = 'middle';
    g.fillStyle = '#f4f1ea'; g.font = '700 54px ' + FONT;
    g.fillText(id, 34, 56);
    g.fillStyle = '#b9b4a8'; g.font = '400 38px ' + FONT;
    g.fillText(farmer, 34 + g.measureText(id).width + 62, 58);
    g.fillStyle = statusHex[status]; g.font = '700 74px ' + FONT;
    g.fillText(alloc + '%', 34, 140);
    g.fillStyle = '#8f8b80'; g.font = '400 30px ' + FONT;
    g.fillText('OF ENTITLEMENT', 34 + g.measureText(alloc + '%').width + 22, 152);
    g.fillStyle = statusHex[status]; g.font = '700 32px ' + FONT;
    g.fillText(note, 34, 214);
  }, 512, 256, 2.7, 1.35);
}
function tag(text, color, worldW) {
  return sprite((g) => {
    g.fillStyle = color;
    roundRect(g, 4, 24, 504, 72, 36); g.fill();
    g.fillStyle = '#171a18'; g.font = '700 44px ' + FONT;
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillText(text, 256, 61);
  }, 512, 120, worldW, worldW * 120 / 512);
}
function plainTag(text, sub) {
  return sprite((g) => {
    g.fillStyle = 'rgba(244,241,234,0.95)';
    roundRect(g, 8, 8, 496, 144, 22); g.fill();
    g.strokeStyle = '#8a8375'; g.lineWidth = 4;
    roundRect(g, 8, 8, 496, 144, 22); g.stroke();
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillStyle = '#23251f'; g.font = '700 58px ' + FONT;
    g.fillText(text, 256, 56);
    g.fillStyle = '#645f54'; g.font = '400 34px ' + FONT;
    g.fillText(sub, 256, 116);
  }, 512, 160, 3.4, 1.06);
}

/* ------------------------------------------------------------------- farms */
const FARMS = [
  { id: 'P1', d: 0, s: 1, who: 'R. Kumar', alloc: 100, note: 'FULL SUPPLY', st: 'OK' },
  { id: 'P2', d: 0, s: -1, who: 'S. Meena', alloc: 97, note: 'FULL SUPPLY', st: 'OK' },
  { id: 'P3', d: 1, s: 1, who: 'A. Bhatt', alloc: 91, note: 'ON SCHEDULE', st: 'OK' },
  { id: 'P4', d: 1, s: -1, who: 'L. Devi', alloc: 84, note: 'CANAL SEEPAGE', st: 'WARN' },
  { id: 'P5', d: 2, s: 1, who: 'M. Iqbal', alloc: 79, note: 'ON SCHEDULE', st: 'OK' },
  { id: 'P6', d: 2, s: -1, who: 'P. Naidu', alloc: 31, note: 'CHANNEL BLOCKED', st: 'BAD' },
  { id: 'P7', d: 3, s: 1, who: 'K. Rao', alloc: 58, note: 'TURN DISPUTED', st: 'WARN' },
  { id: 'P8', d: 3, s: -1, who: 'J. Sharma', alloc: 52, note: 'TURN DISPUTED', st: 'WARN' },
  { id: 'P9', d: 4, s: 1, who: 'T. Begum', alloc: 29, note: 'TAIL SHORTAGE', st: 'BAD' },
  { id: 'P10', d: 4, s: -1, who: 'V. Patel', alloc: 11, note: 'NO DELIVERY', st: 'BAD' },
];

function terrainPlane(cx, cz, w, d, lift, mat, name, sx = 12, sz = 12) {
  const g = new THREE.PlaneGeometry(w, d, sx, sz);
  g.rotateX(-Math.PI / 2); g.translate(cx, 0, cz);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, H(p.getX(i), p.getZ(i)) + lift);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.name = name;
  return m;
}

for (const f of FARMS) {
  const dx = DIST[f.d].x, cx = dx + 2.75, cz = f.s * 6.2;
  const crop = f.alloc >= 75 ? M.cropHealthy : f.alloc >= 45 ? M.cropStress : M.cropDry;
  const grp = new THREE.Group(); grp.name = 'farm_' + f.id;
  grp.add(terrainPlane(cx, cz, 5.3, 6.4, 0.03, M.earthDark, f.id + '_bund'));
  grp.add(terrainPlane(cx, cz, 4.8, 5.9, 0.08, crop, f.id + '_field'));
  for (let r = 0; r < 7; r++) {                       // crop rows
    const rx = cx - 2.1 + r * 0.7;
    grp.add(terrainPlane(rx, cz, 0.22, 5.6, 0.13, M.earthDark, f.id + '_row', 1, 10));
  }
  // field channel off the distributary
  channel([[dx + 0.45, cz], [cx - 2.3, cz]], {
    width: 0.34, step: 1.0, name: f.id + '_field_channel',
    flow: f.alloc >= 70 ? 'full' : f.alloc >= 40 ? 'low' : 'none',
  });

  // farmer marker
  const mx = cx - 2.3, mz = cz - f.s * 3.35, my = H(mx, mz);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.5, 12), M.steel);
  post.position.set(mx, my + 0.75, mz); post.name = f.id + '_marker_post';
  grp.add(post);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), statusMat[f.st]);
  head.position.set(mx, my + 1.62, mz); head.name = f.id + '_marker_head';
  grp.add(head);

  // allocation gauge
  const gx = mx + 0.75, gy = H(gx, mz);
  const track = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.7, 0.2), M.gaugeTrack);
  track.position.set(gx, gy + 0.85, mz); track.name = f.id + '_gauge_track';
  grp.add(track);
  const fh = Math.max(0.08, 1.62 * f.alloc / 100);
  const fill = new THREE.Mesh(new THREE.BoxGeometry(0.26, fh, 0.26), statusMat[f.st]);
  fill.position.set(gx, gy + 0.04 + fh / 2, mz); fill.name = f.id + '_gauge_fill';
  grp.add(fill);

  const pn = panel(f.id, f.who, f.alloc, f.note, f.st);
  pn.position.set(mx + 0.4, my + (f.s > 0 ? 3.3 : 2.3), mz);
  pn.name = f.id + '_status_panel';
  grp.add(pn);
  model.add(grp);
}

/* ------------------------------------------------------------------ issues */
const alerts = [];
function alert(text, color, x, z, y) {
  const t = tag(text, color, 3.0);
  t.position.set(x, H(x, z) + y, z);
  t.name = 'alert_' + text.toLowerCase().replace(/[^a-z]+/g, '_');
  model.add(t); alerts.push(t);
  return t;
}
// blockage in D3 south
{
  const x = 0.5;
  for (let i = 0; i < 4; i++) {
    const z = -2.6 - i * 0.45;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.34 - i * 0.03, 20, 12), M.silt);
    s.scale.y = 0.55;
    s.position.set(x + (i % 2 ? 0.08 : -0.06), H(x, z) + 0.3, z);
    s.name = 'silt_deposit';
    model.add(s);
  }
  alert('BLOCKAGE · D3-S', '#f0705c', x, -3.4, 2.1);
}
// seepage / leakage on D2 south
{
  const x = -5.0, z = -4.6;
  const patch = terrainPlane(x - 1.0, z, 2.4, 2.8, 0.05, M.wet, 'seepage_patch_ground', 8, 8);
  model.add(patch);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), M.reservoir);
    b.position.set(x - 0.45 - i * 0.2, H(x, z) + 0.18 - i * 0.03, z + (i - 2) * 0.28);
    b.name = 'seepage_drop';
    model.add(b);
  }
  alert('LEAKAGE · 18% LOSS', '#e8b552', x - 0.9, z, 2.0);
}
// allocation conflict between P7 and P8 (D4 head gate)
{
  const x = 6.0;
  const gate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.9), M.steel);
  gate.position.set(x, H(x, 1.0) + 0.5, 1.0); gate.name = 'D4_offtake_gate';
  model.add(gate);
  alert('ALLOCATION CONFLICT · D4', '#e8b552', x, 1.6, 2.6);
}
// tail-end shortage
alert('TAIL-END SHORTAGE', '#f0705c', 12.6, 0, 2.4);

/* head / tail reach labels */
{
  const a = plainTag('HEAD REACH', 'RL 43.2 m · 100% supply');
  a.position.set(-11.0, H(-11.0, 10.9) + 2.0, 10.9); a.name = 'label_head_reach';
  model.add(a);
  const b = plainTag('TAIL REACH', 'RL 40.3 m · 20% supply');
  b.position.set(13.4, H(13.4, 10.9) + 2.0, 10.9); b.name = 'label_tail_reach';
  model.add(b);
  const r = plainTag('RESERVOIR', '18.4 Mm³ · 62% capacity');
  r.position.set(-19.3, RES_LEVEL + 1.5, 0); r.name = 'label_reservoir';
  model.add(r);
}

stage.setObject(model);

/* --------------------------------------------------------------- animation */
let last = performance.now();
(function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  flowTex.offset.y -= dt * 0.55;
  flowTexLow.offset.y -= dt * 0.17;
  const p = 0.72 + 0.28 * Math.sin(now / 380);
  for (const a of alerts) a.material.opacity = p;
  requestAnimationFrame(tick);
})(last);
