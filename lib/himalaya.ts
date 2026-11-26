// Footer: snow peaks over a deodar forest, in three.js.
// Terrain, trees and mist are built once on the CPU. Per frame only the theme colours, wind,
// mist drift and a small camera parallax change. No loop of its own: the sky engine calls render().
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

/* ---------- the land: three ranges, front to back ---------- */
const PEAKS = [[-1300, -1190, 290], [-660, -1150, 330], [40, -1270, 440], [560, -1120, 345], [1130, -1240, 380], [1750, -1180, 300]];
function farH(x: number, z: number) {
  const r = ridged(n1, x / 430, z / 430, 5);
  let p = 0; for (const [cx, cz, hh] of PEAKS) p = Math.max(p, hh * Math.exp(-Math.hypot(x - cx, (z - cz) * 1.3) / 250));
  return -40 + smooth(-760, -990, z) * (70 + 140 * r + p * (0.42 + 0.5 * r) + 22 * fbm(n2, x / 55, z / 55, 3));
}
function midH(x: number, z: number) {
  return -20 + smooth(-290, -420, z) * (38 + 82 * ridged(n2, x / 260, z / 260, 4) + 16 * fbm(n3, x / 140, z / 140, 3));
}
function nearH(x: number, z: number) {
  return -6 + smooth(-50, -210, z) * (42 + 28 * fbm(n1, x / 120 + 40, z / 120, 4));
}

const C = (hex: string) => new THREE.Color(hex);
const SNOW = C('#f3f6fa'), ROCK = C('#4f5257'), ROCK2 = C('#726e67'), SCRUB = C('#4a5443'), FOREST = C('#2b4033'), MEADOW = C('#55673f'), FLOOR = C('#24372a');

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

/* ---------- a deodar: stacked, drooping tiers on a thin trunk, unit height ---------- */
function deodar(tiers: number, radial: number, seed: number) {
  const r = rng(seed), parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, f: (y: number) => THREE.Color) => {
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) f(p.getY(i)).toArray(col, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  const bark = C('#4a3a2c'), dark = C('#1d3527'), lite = C('#4f7a5c');
  const trunk = new THREE.CylinderGeometry(0.016, 0.032, 0.4, radial, 1, true); trunk.translate(0, 0.2, 0);
  parts.push(paint(trunk, () => bark));
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1), y0 = 0.1 + t * 0.74, rad = 0.06 + (1 - t) ** 1.1 * 0.36, h = 0.14 + (1 - t) * 0.08;
    const cone = new THREE.ConeGeometry(rad, h, radial, 1, false);
    const p = cone.attributes.position;
    for (let k = 0; k < p.count; k++) {
      if (p.getY(k) < 0) { const j = 0.82 + r() * 0.36; p.setX(k, p.getX(k) * j); p.setZ(k, p.getZ(k) * j); p.setY(k, p.getY(k) - 0.035 * j * (1 - t)); }
    }
    cone.rotateY(r() * Math.PI); cone.translate((r() - 0.5) * 0.02, y0 + h / 2, (r() - 0.5) * 0.02);
    cone.computeVertexNormals();
    const base = y0, top = y0 + h;
    parts.push(paint(cone, (y) => dark.clone().lerp(lite, smooth(base - 0.04, top, y) * (0.75 + 0.25 * t))));
  }
  const tip = new THREE.ConeGeometry(0.025, 0.12, radial, 1, false); tip.rotateZ(-0.35); tip.translate(0.02, 0.93, 0);
  parts.push(paint(tip, () => lite));
  // soften the foliage: bend normals toward a sphere so the crown shades as one mass
  const g = mergeGeometries(parts)!;
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    s.set(p.getX(i), p.getY(i) - 0.45, p.getZ(i)).normalize(); v.set(n.getX(i), n.getY(i), n.getZ(i)).lerp(s, 0.55).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

/* ---------- valley mist: soft blobs on a strip that fades upward, wrapped sideways ---------- */
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

export function startRange(canvas: HTMLCanvasElement, reduce: boolean, onDirty: () => void): Range {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const fog = new THREE.Fog(BG[0].clone(), 120, 1900); scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(26, 4, 1, 4000);
  const eye = new THREE.Vector3(0, 52, 0), aim = new THREE.Vector3(0, 52 + Math.tan(0.1) * 1000, -1000);

  const sun = new THREE.DirectionalLight(SUN[0].clone(), 3); sun.position.set(-0.9, 0.38, 0.28).multiplyScalar(1000); scene.add(sun);
  const hemi = new THREE.HemisphereLight(SKY[0].clone(), GROUND[0].clone(), 1.6); scene.add(hemi);

  /* land */
  const land = new THREE.MeshLambertMaterial({ vertexColors: true });
  const far = terrain(-2600, 2600, -760, -1560, 440, 84, farH, (h, ny, x, z, out) => {
    const snow = Math.max(smooth(185, 255, h + 60 * n2(x / 80, z / 80)) * smooth(0.58, 0.82, ny), smooth(320, 400, h) * smooth(0.32, 0.55, ny));
    out.copy(ROCK).lerp(ROCK2, 0.5 + 0.5 * n3(x / 60, z / 60));
    out.lerp(SCRUB, smooth(150, 80, h)).lerp(SNOW, snow);
  });
  const mid = terrain(-1700, 1700, -290, -700, 200, 36, midH, (h, ny, x, z, out) => {
    out.copy(FOREST).lerp(MEADOW, smooth(0.2, 0.6, n1(x / 70, z / 70))).lerp(ROCK, smooth(0.8, 0.55, ny) * 0.6);
  });
  const near = terrain(-700, 700, -40, -280, 160, 40, nearH, (h, ny, x, z, out) => {
    out.copy(FLOOR).lerp(MEADOW, smooth(0.15, 0.5, n2(x / 40, z / 40)) * 0.6);
  });
  for (const g of [far, mid, near]) scene.add(new THREE.Mesh(g, land));

  /* trees, swaying in a wind that gusts across the valley */
  const wind = { uTime: { value: 0 }, uWind: { value: 1 } };
  const treeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  treeMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind.uTime; sh.uniforms.uWind = wind.uWind;
    sh.vertexShader = 'uniform float uTime;\nuniform float uWind;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        vec3 ip = instanceMatrix[3].xyz;
        float tall = length(instanceMatrix[1].xyz);
        float hh = clamp(position.y, 0.0, 1.0);
        float gust = 0.55 + 0.45 * sin(uTime * 0.37 + ip.x * 0.012) * sin(uTime * 0.21 - ip.z * 0.02 + ip.x * 0.004);
        float sway = (sin(uTime * 1.25 + ip.x * 0.09 + ip.z * 0.13) * 0.6 + 0.4) * gust;
        float flutter = sin(uTime * 4.7 + position.x * 23.0 + position.z * 17.0 + ip.x) * 0.008;
        mvPosition.x += (sway * 0.045 * uWind * hh * hh + flutter * hh) * tall;
        mvPosition.z += sway * 0.015 * uWind * hh * hh * tall;
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  const small = innerWidth < 600;
  const plant = (geo: THREE.BufferGeometry, count: number, seed: number, pick: (r: () => number) => [number, number, number, number] | null) => {
    const r = rng(seed), mesh = new THREE.InstancedMesh(geo, treeMat, count), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
    let n = 0;
    for (let tries = 0; n < count && tries < count * 8; tries++) {
      const at = pick(r); if (!at) continue;
      const [x, y, z, h] = at, wide = 0.42 + r() * 0.16;
      q.setFromAxisAngle(up, r() * Math.PI * 2); s.set(h * wide, h, h * wide); p.set(x, y - 0.4, z);
      mesh.setMatrixAt(n, m.compose(p, q, s));
      const k = 0.78 + r() * 0.42;
      mesh.setColorAt(n, tint.setRGB(k * (0.88 + r() * 0.16), k, k * (0.9 + r() * 0.22)));
      n++;
    }
    mesh.count = n; mesh.frustumCulled = false; scene.add(mesh);
    return mesh;
  };
  const forest = (x: number, z: number, s: number) => fbm(n3, x / s, z / s, 3) > -0.22;
  plant(deodar(7, 7, 5), small ? 700 : 1500, 101, (r) => {
    const z = -110 - r() * 175, x = (r() - 0.5) * (-z * 2.2 + 60);
    return forest(x, z, 60) ? [x, nearH(x, z), z, 13 + r() * 10] : null;
  });
  plant(deodar(4, 5, 9), small ? 1300 : 2600, 202, (r) => {
    const z = -320 - r() * 320, x = (r() - 0.5) * (-z * 2.1), y = midH(x, z);
    return y < 120 && forest(x, z, 110) ? [x, y, z, 10 + r() * 6] : null;
  });

  /* mist in the valleys */
  const mists = [
    { tex: mistTexture(3), y: 58, z: -740, w: 4600, h: 230, speed: 0.0022 },
    { tex: mistTexture(8), y: 30, z: -300, w: 1800, h: 110, speed: 0.005 },
  ].map((o) => {
    o.tex.repeat.set(o.w / 1500, 1);
    const mat = new THREE.MeshBasicMaterial({ map: o.tex, transparent: true, depthWrite: false, color: BG[0].clone() });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), mat); mesh.position.set(0, o.y, o.z); scene.add(mesh);
    return { ...o, mat };
  });

  /* size, visibility, pointer */
  let W = 0, H = 0, visible = true, px = 0, pxT = 0;
  const ro = new ResizeObserver(() => {
    W = canvas.clientWidth; H = canvas.clientHeight; if (!W || !H) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.fov = W / H < 2 ? 32 : 28; camera.updateProjectionMatrix(); onDirty();
  });
  ro.observe(canvas);
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) onDirty(); }); io.observe(canvas);
  const ac = new AbortController();
  if (!reduce && matchMedia('(pointer: fine)').matches) addEventListener('pointermove', (e) => { pxT = (e.clientX / innerWidth - 0.5) * 14; }, { passive: true, signal: ac.signal });

  return {
    render(now, dt, w) {
      if (!visible || !W || !H) return;
      const t = reduce ? 40 : now / 1000;
      mix3(fog.color, BG, w); fog.near = mixN([120, 110, 60], w); fog.far = mixN([1900, 2600, 1350], w);
      mix3(sun.color, SUN, w); sun.intensity = mixN([3.1, 1.5, 1.3], w);
      mix3(hemi.color, SKY, w); mix3(hemi.groundColor, GROUND, w); hemi.intensity = mixN([1.25, 0.5, 1.9], w);
      wind.uTime.value = t; wind.uWind.value = mixN([1, 0.6, 1.9], w);
      for (const m of mists) { m.mat.color.copy(fog.color); m.mat.opacity = mixN([0.6, 0.4, 0.9], w); m.tex.offset.x = reduce ? 0 : t * m.speed; }
      px += (pxT - px) * (1 - Math.exp(-dt * 2));
      camera.position.copy(eye).setX(px + (reduce ? 0 : Math.sin(t * 0.05) * 6)); camera.lookAt(aim);
      renderer.render(scene, camera);
    },
    stop() {
      ac.abort(); ro.disconnect(); io.disconnect();
      scene.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
      for (const m of mists) { m.tex.dispose(); m.mat.dispose(); }
      land.dispose(); treeMat.dispose(); renderer.dispose();
    },
  };
}
