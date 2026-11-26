// Footer: a Himalayan meadow of deodars, blue pines and rhododendrons under snow peaks, in three.js.
// Trees are the point: big, readable, toon-shaded, and playful. They lean away from the cursor,
// shake when it moves fast, and boing when clicked or tapped. Tapping open grass sends a gust.
// Everything is built once on the CPU; per frame only uniforms, the camera and theme colours change.
// No loop of its own: the sky engine calls render().
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Range = { render: (now: number, dt: number, w: number[]) => void; stop: () => void };

/* ---------- small maths ---------- */
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rng(seed: number) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function perlin(seed: number) {
  const r = rng(seed), perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const p = new Uint8Array(512); for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const grad = (h: number, x: number, y: number) => { const g = h & 7, u = g < 4 ? x : y, v = g < 4 ? y : x; return (g & 1 ? -u : u) + (g & 2 ? -2 * v : 2 * v); };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t: number, a: number, b: number) => a + t * (b - a);
  return (x: number, y: number) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y), a = p[X] + Y, b = p[X + 1] + Y;
    return lerp(v, lerp(u, grad(p[a], x, y), grad(p[b], x - 1, y)), lerp(u, grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1))) * 0.45;
  };
}
type Noise = (x: number, y: number) => number;
const fbm = (n: Noise, x: number, z: number, oct: number) => { let s = 0, a = 1, f = 1, m = 0; for (let i = 0; i < oct; i++) { s += a * n(x * f, z * f); m += a; a *= 0.5; f *= 2.03; } return s / m; };
const ridged = (n: Noise, x: number, z: number, oct: number) => {
  let s = 0, a = 1, f = 1, m = 0, prev = 1;
  for (let i = 0; i < oct; i++) { let v = 1 - Math.abs(n(x * f, z * f)); v *= v; v *= prev; prev = v; s += v * a; m += a; a *= 0.5; f *= 2.1; }
  return s / m;
};
const n1 = perlin(11), n2 = perlin(29), n3 = perlin(47);

/* ---------- the land: meadow, low forested hills, snow peaks ---------- */
const PEAKS = [[-1300, -1190, 290], [-660, -1150, 330], [40, -1270, 440], [560, -1120, 345], [1130, -1240, 380], [1750, -1180, 300]];
const FAR_SCALE = 0.62;
function farH(x: number, z: number) {
  const r = ridged(n1, x / 430, z / 430, 5);
  let p = 0; for (const [cx, cz, hh] of PEAKS) p = Math.max(p, hh * Math.exp(-Math.hypot(x - cx, (z - cz) * 1.3) / 250));
  return -40 + smooth(-760, -990, z) * (70 + 140 * r + p * (0.42 + 0.5 * r) + 22 * fbm(n2, x / 55, z / 55, 3));
}
const midH = (x: number, z: number) => -8 + smooth(-240, -330, z) * (14 + 26 * ridged(n2, x / 220, z / 220, 4) + 6 * fbm(n3, x / 90, z / 90, 3));
const nearH = (x: number, z: number) => -2 + smooth(-15, -190, z) * (9 + 9 * fbm(n1, x / 90 + 40, z / 90, 3)) + 1.2 * fbm(n2, x / 25, z / 25, 2);

const C = (hex: string) => new THREE.Color(hex);
const SNOW = C('#f3f6fa'), ROCK = C('#4f5257'), ROCK2 = C('#726e67'), SCRUB = C('#4a5443');
const HILL = C('#3d6146'), HILL2 = C('#5d8150'), GRASS = C('#6f9a4f'), GRASS2 = C('#8fb560'), MOSS = C('#557d40');
const BARK = C('#6b4a35');

function terrain(x0: number, x1: number, z0: number, z1: number, nx: number, nz: number, hf: (x: number, z: number) => number, paint: (h: number, ny: number, x: number, z: number, out: THREE.Color) => void) {
  const g = new THREE.PlaneGeometry(x1 - x0, z0 - z1, nx, nz);
  g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, hf(pos.getX(i), pos.getZ(i)));
  g.computeVertexNormals();
  const nor = g.attributes.normal, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { paint(pos.getY(i), nor.getY(i), pos.getX(i), pos.getZ(i), c); c.toArray(col, i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/* ---------- trees, unit height, one merged non-indexed geometry each ---------- */
function part(g: THREE.BufferGeometry, f: (x: number, y: number, z: number) => THREE.Color) {
  const n = g.index ? g.toNonIndexed() : g, p = n.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) f(p.getX(i), p.getY(i), p.getZ(i)).toArray(col, i * 3);
  n.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return n;
}
const shade = (dark: THREE.Color, lite: THREE.Color, y0: number, y1: number) => (_x: number, y: number) => dark.clone().lerp(lite, smooth(y0, y1, y));
// bend foliage normals toward a sphere around (0, cy, 0) so each crown shades as one soft mass
function soften(g: THREE.BufferGeometry, cy: number, k: number) {
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    s.set(p.getX(i), p.getY(i) - cy, p.getZ(i)).normalize(); v.set(n.getX(i), n.getY(i), n.getZ(i)).lerp(s, k).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

// Deodar: tiers of drooping, slightly ragged cones on a thin trunk, with a nodding leader
function deodar(tiers: number, radial: number, seed: number) {
  const r = rng(seed), parts: THREE.BufferGeometry[] = [];
  const dark = C('#24503a'), lite = C('#7fb27a');
  const trunk = new THREE.CylinderGeometry(0.016, 0.034, 0.42, radial, 1, true); trunk.translate(0, 0.21, 0);
  parts.push(part(trunk, () => BARK));
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1), y0 = 0.12 + t * 0.72, rad = 0.07 + (1 - t) ** 1.05 * 0.38, h = 0.13 + (1 - t) * 0.07;
    const cone = new THREE.ConeGeometry(rad, h, radial, 1, false), p = cone.attributes.position;
    for (let k = 0; k < p.count; k++) {
      if (p.getY(k) < 0) { const j = 0.8 + r() * 0.4; p.setX(k, p.getX(k) * j); p.setZ(k, p.getZ(k) * j); p.setY(k, p.getY(k) - 0.05 * j * (1 - t * 0.6)); }
    }
    cone.rotateY(r() * Math.PI); cone.translate((r() - 0.5) * 0.02, y0 + h / 2, (r() - 0.5) * 0.02); cone.computeVertexNormals();
    parts.push(part(cone, shade(dark, lite, y0 - 0.05, y0 + h)));
  }
  const tip = new THREE.ConeGeometry(0.03, 0.13, radial, 1, false); tip.rotateZ(-0.4); tip.translate(0.025, 0.93, 0);
  parts.push(part(tip, () => lite));
  return soften(mergeGeometries(parts)!, 0.45, 0.5);
}

// Blue pine: a tall bare trunk with soft, flattened clumps spiralling up it
function bluePine(seed: number) {
  const r = rng(seed), parts: THREE.BufferGeometry[] = [];
  const dark = C('#2b5a4f'), lite = C('#8ec2a4');
  const trunk = new THREE.CylinderGeometry(0.018, 0.04, 0.92, 6, 1, true); trunk.translate(0, 0.46, 0);
  parts.push(part(trunk, () => BARK));
  const n = 10;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), y = 0.36 + t * 0.58, a = i * 2.4 + r(), d = (1 - t) * 0.2 + 0.05, br = 0.085 + (1 - t) * 0.055;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    const limb = new THREE.CylinderGeometry(0.008, 0.012, d + 0.01, 4, 1, true); limb.rotateZ(Math.PI / 2); limb.translate(d / 2, 0, 0); limb.rotateY(-a); limb.translate(0, y - 0.02, 0);
    parts.push(part(limb, () => BARK));
    const blob = new THREE.IcosahedronGeometry(br, 1); blob.scale(1.1, 0.85, 1.1); blob.translate(cx, y, cz);
    parts.push(part(blob, shade(dark, lite, y - br * 0.6, y + br * 0.6)));
  }
  const top = new THREE.IcosahedronGeometry(0.06, 1); top.scale(1, 1.4, 1); top.translate(0, 0.98, 0);
  parts.push(part(top, () => lite));
  return soften(mergeGeometries(parts)!, 0.6, 0.35);
}

// Rhododendron (Rhododendron arboreum): a round, dark crown dotted with red blossoms
function rhododendron(seed: number) {
  const r = rng(seed), parts: THREE.BufferGeometry[] = [];
  const dark = C('#1f4a33'), lite = C('#5f9461'), red = C('#d9364c'), pink = C('#ee6f84');
  const trunk = new THREE.CylinderGeometry(0.03, 0.055, 0.42, 6, 1, true); trunk.translate(0, 0.21, 0);
  parts.push(part(trunk, () => BARK));
  for (const s of [-1, 1]) {
    const b = new THREE.CylinderGeometry(0.02, 0.03, 0.3, 5, 1, true); b.translate(0, 0.15, 0); b.rotateZ(s * 0.55); b.translate(0, 0.32, 0);
    parts.push(part(b, () => BARK));
  }
  const blobs: [number, number, number, number][] = [[0, 0.66, 0, 0.26]];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + r() * 0.5; blobs.push([Math.cos(a) * 0.22, 0.58 + r() * 0.16, Math.sin(a) * 0.22, 0.17 + r() * 0.06]); }
  for (const [x, y, z, rad] of blobs) {
    const g = new THREE.IcosahedronGeometry(rad, 1); g.translate(x, y, z);
    parts.push(part(g, shade(dark, lite, y - rad, y + rad * 0.8)));
  }
  for (let i = 0; i < 30; i++) {
    const [x, y, z, rad] = blobs[Math.floor(r() * blobs.length)];
    const d = new THREE.Vector3(r() - 0.5, r() * 0.9 - 0.15, r() - 0.5).normalize().multiplyScalar(rad * 1.02);
    const f = new THREE.IcosahedronGeometry(0.038 + r() * 0.02, 0); f.translate(x + d.x, y + d.y, z + d.z);
    const c = r() < 0.75 ? red : pink;
    parts.push(part(f, () => c));
  }
  return soften(mergeGeometries(parts)!, 0.62, 0.3);
}

/* ---------- valley mist behind the hills: soft blobs on a strip that fades upward ---------- */
function mistTexture(seed: number) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d')!, r = rng(seed);
  for (let i = 0; i < 110; i++) {
    const x = r() * 512, y = 50 + r() * 80, rad = 18 + r() * 56;
    for (const dx of [-512, 0, 512]) {
      const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x + dx - rad, y - rad, rad * 2, rad * 2);
    }
  }
  g.globalCompositeOperation = 'destination-in';
  const lg = g.createLinearGradient(0, 0, 0, 128);
  lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.6, 'rgba(0,0,0,.85)'); lg.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = lg; g.fillRect(0, 0, 512, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- theme colours: [day, night, monsoon] ---------- */
const T3 = (a: string, b: string, c: string) => [C(a), C(b), C(c)];
const BG = T3('#f6f8f9', '#05070d', '#eef1f2');
const SUN = T3('#fff3df', '#a9bcff', '#e8edf1');
const SKY = T3('#d6e6f7', '#2a3b6e', '#cdd6dc');
const GROUND = T3('#4d5c3d', '#06080f', '#4a564c');
const mix3 = (out: THREE.Color, cs: THREE.Color[], w: number[]) =>
  out.setRGB(cs[0].r * w[0] + cs[1].r * w[1] + cs[2].r * w[2], cs[0].g * w[0] + cs[1].g * w[1] + cs[2].g * w[2], cs[0].b * w[0] + cs[1].b * w[1] + cs[2].b * w[2]);
const mixN = (v: number[], w: number[]) => v[0] * w[0] + v[1] * w[1] + v[2] * w[2];

const PUSH_Z = -80;

export function startRange(canvas: HTMLCanvasElement, reduce: boolean, onDirty: () => void): Range {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const fog = new THREE.Fog(BG[0].clone(), 160, 2000); scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(30, 4, 0.5, 4000);
  const eye = new THREE.Vector3(0, 12, 0), aim = new THREE.Vector3(0, 12 + Math.tan(0.035) * 1000, -1000);

  const sun = new THREE.DirectionalLight(SUN[0].clone(), 3); sun.position.set(-0.6, 0.7, 0.5).multiplyScalar(1000); scene.add(sun);
  const hemi = new THREE.HemisphereLight(SKY[0].clone(), GROUND[0].clone(), 1.4); scene.add(hemi);

  // three soft steps of light: an illustrated, toy-like read that keeps every crown legible
  const steps = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
  steps.minFilter = steps.magFilter = THREE.NearestFilter; steps.needsUpdate = true;

  /* land */
  const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const toonLand = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: steps });
  const far = new THREE.Mesh(terrain(-2600, 2600, -760, -1560, 440, 84, farH, (h, ny, x, z, out) => {
    const snow = Math.max(smooth(185, 255, h + 60 * n2(x / 80, z / 80)) * smooth(0.58, 0.82, ny), smooth(320, 400, h) * smooth(0.32, 0.55, ny));
    out.copy(ROCK).lerp(ROCK2, 0.5 + 0.5 * n3(x / 60, z / 60));
    out.lerp(SCRUB, smooth(150, 80, h)).lerp(SNOW, snow);
  }), rockMat);
  far.scale.y = FAR_SCALE; scene.add(far);
  scene.add(new THREE.Mesh(terrain(-1500, 1500, -230, -700, 220, 50, midH, (h, ny, x, z, out) => {
    out.copy(HILL).lerp(HILL2, smooth(-0.1, 0.4, n1(x / 60, z / 60)));
  }), toonLand));
  scene.add(new THREE.Mesh(terrain(-420, 420, 15, -235, 180, 64, nearH, (h, ny, x, z, out) => {
    out.copy(GRASS).lerp(GRASS2, smooth(-0.05, 0.35, n2(x / 30, z / 30))).lerp(MOSS, smooth(0.1, 0.4, n3(x / 14, z / 14)) * 0.5);
  }), toonLand));

  /* trees */
  const u = { uTime: { value: 0 }, uWind: { value: 1 }, uPush: { value: new THREE.Vector4(0, PUSH_Z, 0, 26) } };
  const treeMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: steps });
  treeMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'uniform float uTime;\nuniform float uWind;\nuniform vec4 uPush;\nattribute float aBoing;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec3 tr = transformed;
      #ifdef USE_INSTANCING
        float hh = clamp(position.y, 0.0, 1.0);
        vec3 ip = instanceMatrix[3].xyz;
        float tall = length(instanceMatrix[1].xyz);
        float age = uTime - aBoing;
        float boing = (age > 0.0 && age < 3.0) ? sin(age * 13.0) * exp(-age * 2.4) : 0.0;
        tr.y *= 1.0 + boing * 0.1 * hh;
        tr.xz *= 1.0 - boing * 0.06 * hh;
        vec4 mvPosition = instanceMatrix * vec4(tr, 1.0);
        float gust = 0.55 + 0.45 * sin(uTime * 0.37 + ip.x * 0.012) * sin(uTime * 0.21 - ip.z * 0.02 + ip.x * 0.004);
        float sway = (sin(uTime * 1.25 + ip.x * 0.09 + ip.z * 0.13) * 0.6 + 0.4) * gust;
        float flutter = sin(uTime * 4.7 + position.x * 23.0 + position.z * 17.0 + ip.x) * 0.008;
        float dx = ip.x - uPush.x, dz = (ip.z - uPush.y) * 0.6;
        float lean = uPush.z * exp(-(dx * dx + dz * dz) / (uPush.w * uPush.w)) * dx / (abs(dx) + 3.0);
        mvPosition.x += ((sway * 0.045 * uWind + lean * 0.3 + boing * 0.22) * hh * hh + flutter * hh) * tall;
        mvPosition.z += sway * 0.015 * uWind * hh * hh * tall;
      #else
        vec4 mvPosition = vec4(tr, 1.0);
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  const small = innerWidth < 600;
  type Spot = { x: number; y: number; z: number; h: number; wide: number };
  const forest = (geo: THREE.BufferGeometry, spots: Spot[], seed: number) => {
    const r = rng(seed), mesh = new THREE.InstancedMesh(geo, treeMat, Math.max(1, spots.length));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
    spots.forEach((t, i) => {
      q.setFromAxisAngle(up, r() * Math.PI * 2); s.set(t.h * t.wide, t.h, t.h * t.wide); p.set(t.x, t.y - 0.3, t.z);
      mesh.setMatrixAt(i, m.compose(p, q, s));
      const k = 0.85 + r() * 0.3; mesh.setColorAt(i, tint.setRGB(k * (0.92 + r() * 0.12), k, k * (0.92 + r() * 0.14)));
    });
    mesh.count = spots.length;
    geo.setAttribute('aBoing', new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, spots.length)).fill(-100), 1));
    scene.add(mesh);
    return mesh;
  };

  // the meadow: rows of trees, spaced so every silhouette reads, with clearings
  const r = rng(101), hero: { deo: Spot[]; pine: Spot[]; rho: Spot[] } = { deo: [], pine: [], rho: [] };
  for (let z = -58; z > -160; z -= small ? 11 : 9) {
    const half = -z * 1.0 + 16, zz = z + (r() - 0.5) * 5;
    for (let x = -half + r() * 8; x < half; x += 10 + r() * 10) {
      if (r() < 0.38 || Math.abs(fbm(n3, x / 70, zz / 70, 2)) > 0.26) continue;
      const front = zz > -95, pick = r(), y = nearH(x, zz);
      if (pick < (front ? 0.3 : 0.1)) hero.rho.push({ x, y, z: zz, h: 6 + r() * 3.5, wide: 0.95 + r() * 0.2 });
      else if (pick < (front ? 0.6 : 0.42)) hero.pine.push({ x, y, z: zz, h: 13 + r() * 6, wide: 0.9 + r() * 0.2 });
      else hero.deo.push({ x, y, z: zz, h: 15 + r() * 8, wide: 0.46 + r() * 0.1 });
    }
  }
  const heroes = [forest(deodar(7, 8, 5), hero.deo, 11), forest(bluePine(7), hero.pine, 12), forest(rhododendron(3), hero.rho, 13)];
  // the hills behind: a dense, smaller deodar forest
  const hills: Spot[] = [], r2 = rng(202);
  for (let i = 0, tries = 0; i < (small ? 700 : 1300) && tries < 12000; tries++) {
    const z = -250 - r2() * 330, x = (r2() - 0.5) * -z * 2.1;
    if (fbm(n3, x / 90, z / 90, 3) < -0.15) continue;
    hills.push({ x, y: midH(x, z), z, h: 11 + r2() * 6, wide: 0.48 }); i++;
  }
  forest(deodar(4, 5, 9), hills, 14);

  // flowers in the grass
  const fr = rng(303), flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshLambertMaterial(), small ? 350 : 700);
  const FL = [C('#ffffff'), C('#f3c94b'), C('#ee7b98')], fm = new THREE.Matrix4();
  for (let i = 0; i < flowers.count; i++) {
    const z = -8 - fr() * 90, x = (fr() - 0.5) * (-z * 2 + 20);
    fm.makeTranslation(x, nearH(x, z) + 0.12, z); flowers.setMatrixAt(i, fm); flowers.setColorAt(i, FL[Math.floor(fr() * 3)]);
  }
  scene.add(flowers);

  /* mist between the hills and the peaks */
  const mistTex = mistTexture(3); mistTex.repeat.set(3, 1);
  const mistMat = new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, depthWrite: false, color: BG[0].clone() });
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(4600, 160), mistMat); mist.position.set(0, 20, -720); scene.add(mist);

  /* size and visibility */
  let W = 0, H = 0, visible = true;
  const ro = new ResizeObserver(() => {
    W = canvas.clientWidth; H = canvas.clientHeight; if (!W || !H) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.fov = W / H < 2 ? 36 : 30; camera.updateProjectionMatrix(); onDirty();
  });
  ro.observe(canvas);
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) onDirty(); }); io.observe(canvas);

  /* play: the cursor is a breeze, a click is a boing */
  const ac = new AbortController(), on = { signal: ac.signal };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -PUSH_Z), hit = new THREE.Vector3();
  let over = false, pushT = 0, lastX = 0, lastY = 0, lastT = 0, hoverDirty = false, time = 0;
  const toNdc = (e: PointerEvent) => { const b = canvas.getBoundingClientRect(); ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); };
  const pickTree = () => { ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(heroes, false)[0]; return h && h.instanceId !== undefined ? h : null; };
  if (!reduce) {
    canvas.addEventListener('pointermove', (e) => {
      toNdc(e); over = true; hoverDirty = true;
      const now = performance.now(), d = Math.hypot(e.clientX - lastX, e.clientY - lastY), dt = Math.max(16, now - lastT);
      if (lastT) pushT = Math.max(pushT, Math.min(1.5, 0.3 + (d / dt) * 0.9));
      lastX = e.clientX; lastY = e.clientY; lastT = now;
    }, on);
    canvas.addEventListener('pointerleave', () => { over = false; lastT = 0; canvas.style.cursor = ''; }, on);
    canvas.addEventListener('pointerdown', (e) => {
      toNdc(e); const h = pickTree();
      if (h) { const a = (h.object as THREE.InstancedMesh).geometry.getAttribute('aBoing') as THREE.InstancedBufferAttribute; a.setX(h.instanceId!, time); a.needsUpdate = true; }
      else pushT = 1.8;
      over = true; onDirty();
    }, on);
  }

  return {
    render(now, dt, w) {
      if (!visible || !W || !H) return;
      time = reduce ? 40 : now / 1000;
      mix3(fog.color, BG, w); fog.near = mixN([160, 150, 70], w); fog.far = mixN([2000, 2600, 1350], w);
      mix3(sun.color, SUN, w); sun.intensity = mixN([3.0, 1.4, 1.3], w);
      mix3(hemi.color, SKY, w); mix3(hemi.groundColor, GROUND, w); hemi.intensity = mixN([1.4, 0.5, 1.9], w);
      mistMat.color.copy(fog.color); mistMat.opacity = mixN([0.5, 0.35, 0.85], w); mistTex.offset.x = reduce ? 0 : time * 0.0022;
      u.uTime.value = time; u.uWind.value = mixN([1, 0.6, 1.9], w);

      // the breeze follows the cursor across the meadow and eases off when it stops
      const push = u.uPush.value;
      if (over) { ray.setFromCamera(ndc, camera); if (ray.ray.intersectPlane(plane, hit)) push.x += (hit.x - push.x) * (1 - Math.exp(-dt * 10)); }
      pushT += ((over ? 0.3 : 0) - pushT) * (1 - Math.exp(-dt * 2.5));
      push.z += (pushT - push.z) * (1 - Math.exp(-dt * 8));
      if (hoverDirty) { hoverDirty = false; canvas.style.cursor = pickTree() ? 'pointer' : ''; }

      camera.position.copy(eye).setX(reduce ? 0 : Math.sin(time * 0.05) * 3); camera.lookAt(aim);
      renderer.render(scene, camera);
    },
    stop() {
      ac.abort(); ro.disconnect(); io.disconnect();
      scene.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
      for (const m of [rockMat, toonLand, treeMat, mistMat, flowers.material as THREE.Material]) m.dispose();
      mistTex.dispose(); steps.dispose(); renderer.dispose();
    },
  };
}
