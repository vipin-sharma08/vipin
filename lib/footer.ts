// Footer: the Himalaya in pixels. Snow peaks with lit and shadowed faces, a hazy foothill ridge,
// and the pixel forest in front: deodars, pines, red-flowering rhododendrons. Drawn into a small
// ImageData (one pixel = 4 CSS px, 3 on phones) and scaled up with image-rendering: pixelated.
// The far peaks are cached and redrawn only when the theme moves; the rest redraws at ~16 fps.

export type Footer = { render: (now: number, dt: number, w: number[]) => void; stop: () => void };
type RGB = number[];
type Tree = { x: number; h: number; kind: string; ph: number; seed: number; layer: number; hue: number };
type Peak = { cx: number; h: number; wl: number; wr: number; k: number; seed: number; snow: number; sh: number[][]; rx: Float32Array };
type Home = { x: number; kind: 'house' | 'hut'; half: number };
type Cloud = { x: number; y: number; v: number; w: number; px: number[][] };

const th = (n: number) => { const x = Math.sin(n * 127.1 + 3.3) * 43758.5453; return x - Math.floor(x); };
const vn = (x: number, seed: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return th(i + seed) * (1 - u) + th(i + 1 + seed) * u; };
const vn2 = (x: number, y: number, seed: number) => {
  const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g);
  const h = (a: number, b: number) => th(a * 1.31 + b * 57.7 + seed);
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
};
const shade = (c: RGB, f: number) => [c[0] * f, c[1] * f, c[2] * f];

// peaks as [centre across the width, height as a share of the room above the ground]
const FAR_PEAKS = [[0.03, 0.6], [0.16, 0.76], [0.3, 0.62], [0.43, 0.7], [0.57, 0.92], [0.7, 0.68], [0.84, 0.8], [0.97, 0.6]];

// one peak's skyline: uneven slopes, shoulders, and teeth that sharpen toward the top
function profile(p: Peak, x: number) {
  const dx = x - p.cx, t = 1 - Math.abs(dx) / (dx < 0 ? p.wl : p.wr);
  let v = t > 0 ? p.h * Math.min(1, t / 0.965) ** p.k : 0;
  for (const [sx, shh, sw] of p.sh) { const ts = 1 - Math.abs(x - sx) / sw; if (ts > 0) v = Math.max(v, shh * ts ** 1.25); }
  if (v <= 0) return 0;
  const hi = v / p.h;
  return v + ((vn(x / 2.2, p.seed) - 0.5) * 2.4 - Math.abs(vn(x / 5.3, p.seed + 3) - 0.5) * 3.2) * hi * hi;
}

export function startFooter(tr: HTMLCanvasElement, reduce: boolean, onDirty: () => void): Footer {
  const tg = tr.getContext('2d')!;
  let TW = 0, TH = 0, TS = 4, G = 0, A = 0, TB = 50;
  let trees: Tree[] = [], far: Tree[] = [], tufts: { x: number; h: number; f: number }[] = [], rocks: { x: number; w: number }[] = [];
  let peaks: Peak[] = [], hero: Peak | null = null, clouds: Cloud[] = [], ridge = new Int16Array(0), homes: Home[] = [];
  let back = new Float32Array(0), backS = new Float32Array(0);
  let img: ImageData | null = null, farBuf: Uint8ClampedArray | null = null, farKey = '', visible = true, t0 = 0;

  function size() {
    TS = innerWidth < 600 ? 3 : 4; const cw = tr.clientWidth, ch = tr.clientHeight; if (!cw || !ch) return;
    TW = Math.ceil(cw / TS); TH = Math.ceil(ch / TS); tr.width = TW; tr.height = TH; img = tg.createImageData(TW, TH);
    G = TH - 4; A = G - 3; TB = Math.min(TH, 58);
    // trees: the forest edge, now mostly deodars and pines, with rhododendrons among them
    const mk = (layer: number, gap: number[], seed: number) => { const out: Tree[] = []; let x = -6, i = seed;
      while (x < TW + 8) {
        const r = th(i), kind = layer === 0 ? (r < 0.6 ? 'pine' : 'round') : r < 0.36 ? 'deodar' : r < 0.6 ? 'pine' : r < 0.78 ? 'rhodo' : r < 0.9 ? 'tall' : 'bush';
        const k = layer === 0 ? 0.7 : layer === 1 ? 0.86 : 1;
        const h = (kind === 'deodar' ? 20 + th(i + 1) * 16 : kind === 'pine' ? 18 + th(i + 1) * 16 : kind === 'tall' ? 24 + th(i + 1) * 12 : kind === 'bush' ? 5 + th(i + 1) * 4 : 13 + th(i + 1) * 11) * k * (TB / 50);
        out.push({ x: x | 0, h, kind, ph: th(i + 3) * 6, seed: i * 17.3, layer, hue: th(i + 7) });
        x += gap[0] + th(i + 5) * gap[1]; i++;
      }
      return out; };
    // two Himachali homes in a clearing; front-row trees step aside for them
    homes = [{ x: Math.round(TW * 0.31), kind: 'house', half: 14 }, { x: Math.round(TW * 0.74), kind: 'hut', half: 12 }];
    far = mk(0, [3, 4], 500); trees = mk(1, [5, 6], 100).concat(mk(2, [6, 8], 900).filter((t) => homes.every((h) => Math.abs(t.x - h.x) > h.half + t.h * 0.3)));
    tufts = Array.from({ length: Math.ceil(TW / 2) }, (_, i) => ({ x: i * 2 + ((th(i + 40) * 2) | 0), h: 1 + ((th(i + 41) * 3) | 0), f: th(i + 42) }));
    rocks = Array.from({ length: Math.ceil(TW / 60) }, (_, i) => ({ x: (th(i + 80) * TW) | 0, w: 3 + ((th(i + 81) * 4) | 0) }));
    // peaks: uneven slopes, shoulders and a toothed crest, merged into one skyline
    const room = A - 2;
    peaks = FAR_PEAKS.map(([f, sz], i) => {
      const seed = 300 + i * 31, h = room * sz, base = h * (1.15 + th(seed) * 0.4), tilt = (th(seed + 1) - 0.5) * 0.55, cx = f * TW + (th(i + 200) - 0.5) * 10;
      const sh: number[][] = [];
      for (let j = 0; j < 1 + (th(seed + 2) > 0.45 ? 1 : 0); j++) {
        const side = th(seed + 3 + j) > 0.5 ? 1 : -1;
        sh.push([cx + side * base * (0.3 + th(seed + 5 + j) * 0.28), h * (0.58 + th(seed + 7 + j) * 0.2), base * (0.28 + th(seed + 9 + j) * 0.14)]);
      }
      // the main ridge (arete) wanders down from the summit; left of it faces the light
      const rx = new Float32Array(Math.ceil(h) + 8); let r = cx;
      for (let y = 0; y < rx.length; y++) { r += (th(seed + 90 + y) - 0.5) * 1.1 + tilt * 0.6; rx[y] = r; }
      return { cx, h, wl: base * (1 - tilt), wr: base * (1 + tilt), k: 1.15 + th(seed + 11) * 0.35, seed, snow: 0.3, sh, rx };
    });
    hero = peaks.reduce((a, b) => (b.h > a.h ? b : a));
    // tallest peaks sit furthest back; lower ones are drawn over them
    peaks.sort((a, b) => b.h - a.h);
    back = new Float32Array(TW); backS = new Float32Array(TW);
    for (let x = 0; x < TW; x++) { backS[x] = room * (0.4 + 0.22 * (1 - (vn(x / 30, 71) * 2 - 1) ** 2) ** 2 + 0.05 * vn(x / 9, 73)); back[x] = backS[x] - Math.abs(vn(x / 2.5, 77) - 0.5) * 2; }
    // foothill ridge: a long, low line with a pixel treeline on its crest
    ridge = new Int16Array(TW);
    for (let x = 0; x < TW; x++) ridge[x] = Math.round(G - A * (0.4 + 0.14 * (vn(x / 22, 7) * 0.7 + vn(x / 7, 9) * 0.3)));
    // clouds: soft pixel blobs with flat bellies
    clouds = Array.from({ length: Math.max(4, Math.round(TW / 45)) }, (_, i) => mkCloud(th(i + 400) * TW, i));
    farKey = ''; t0 = 0; onDirty();
  }
  function mkCloud(x: number, i: number): Cloud {
    const w = 14 + ((th(i + 410) * 18) | 0), h = 5 + ((th(i + 411) * 3) | 0), px: number[][] = [];
    const bumps = [[0.3, 0.55], [0.55, 0.85], [0.78, 0.5]].map(([f, r]) => [f * w, r * h]);
    for (let y = 0; y < h; y++) for (let k = 0; k < w; k++) {
      const inside = bumps.some(([bx, br]) => (k - bx) ** 2 / (br * 1.6) ** 2 + (y - h) ** 2 / br ** 2 < 1) && Math.abs(k - w / 2) < w / 2 - (y > h - 2 ? 0 : 1);
      if (inside) px.push([k, y, y > h - 2 ? 0.9 : y < h * 0.45 ? 1.08 : 1]);
    }
    return { x, y: 2 + th(i + 412) * A * 0.42, v: 0.5 + th(i + 413) * 1.1, w, px };
  }
  const ro = new ResizeObserver(size); ro.observe(tr);
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) onDirty(); }); io.observe(tr);

  return {
    render(now, _dt, w) {
      if (!visible || !TW || !img || now - t0 < 60) return; t0 = now;
      const t = reduce ? 0 : now / 1000, D = img.data;
      const mw3 = (d: RGB, n: RGB, m: RGB) => d.map((v, k) => v * w[0] + n[k] * w[1] + m[k] * w[2]);
      const BG = mw3([246, 248, 249], [5, 7, 13], [238, 241, 242]);
      const haze = (c: RGB, a: number) => [c[0] + (BG[0] - c[0]) * a, c[1] + (BG[1] - c[1]) * a, c[2] + (BG[2] - c[2]) * a];
      const set = (x: number, y: number, c: RGB, a = 1) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= TW || y >= TH) return; const o = (y * TW + x) * 4;
        if (a >= 1 || !D[o + 3]) { D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = 255 * Math.min(1, a + (D[o + 3] ? 1 : 0)); return; }
        D[o] += (c[0] - D[o]) * a; D[o + 1] += (c[1] - D[o + 1]) * a; D[o + 2] += (c[2] - D[o + 2]) * a; };

      /* far peaks: cached, redrawn only when the theme moves */
      const key = w.map((v) => v.toFixed(3)).join();
      if (key !== farKey || !farBuf) {
        farKey = key; D.fill(0);
        const RKL = mw3([128, 142, 166], [58, 66, 98], [124, 136, 146]), RKS = mw3([84, 96, 122], [32, 38, 64], [88, 100, 110]), RKD = mw3([62, 72, 96], [20, 24, 42], [66, 76, 86]);
        const SNH = mw3([252, 253, 255], [192, 206, 240], [240, 243, 246]), SNL = mw3([236, 242, 251], [160, 176, 216], [224, 229, 234]);
        const SNM = mw3([212, 222, 238], [128, 142, 184], [202, 210, 218]), SNS = mw3([176, 192, 218], [96, 110, 152], [172, 182, 194]), SND = mw3([150, 166, 196], [78, 90, 132], [150, 160, 174]);
        const room = A - 2;
        /* the range behind: paler, softer, filling the gaps between the big peaks */
        for (let x = 0; x < TW; x++) {
          const top = Math.round(G - back[x]), lit = backS[Math.min(TW - 1, x + 3)] >= backS[Math.max(0, x - 3)];
          for (let y = top; y <= G; y++) {
            const alt = G - y, snow = alt > room * 0.42 + vn(x / 4, 75) * 5;
            set(x, y, haze(snow ? (lit ? SNL : SNM) : lit ? RKL : RKS, 0.4 + 0.22 * (1 - alt / room)));
          }
        }
        /* the big peaks, each drawn whole, back to front */
        peaks.forEach((P, order) => {
          const topP = G - P.h, hz = 0.2 - order * 0.012;
          const x0 = Math.min(P.cx - P.wl, ...P.sh.map(([sx, , sw]) => sx - sw)), x1 = Math.max(P.cx + P.wr, ...P.sh.map(([sx, , sw]) => sx + sw));
          for (let x = Math.max(0, Math.floor(x0 - 2)); x < Math.min(TW, Math.ceil(x1 + 2)); x++) {
            const v = profile(P, x); if (v <= 0) continue;
            const ys = Math.round(G - v);
            for (let y = ys; y <= G; y++) {
              const d = y - topP, row = Math.max(0, Math.min(P.rx.length - 1, Math.round(d))), rx = P.rx[row], lit = x < rx;
              const s = (lit ? P.wl : P.wr) / P.h, u = lit ? x + d * s : x - d * s;
              // snow fingers follow the slope, but start and stop like real couloirs
              const gully = Math.max(0, vn2(u / 3, d / 7, P.seed + (lit ? 5 : 9)) - 0.56) * 2.2 * P.h * 0.4;
              const line = P.h * P.snow * (0.85 + 0.3 * vn(u / 8, P.seed)) + gully;
              let snow = d < line;
              // bare rock: patches on the steep shadow face, a few outcrops in the sun
              if (snow && !lit && vn2(u / 2.6, d / 3.5, P.seed + 13) > 0.64) snow = false;
              if (snow && lit && d > 3 && vn2(u / 2.4, d / 3, P.seed + 17) > 0.74) snow = false;
              const band = vn2(u / 4, d / 5, P.seed + 21);
              let c: RGB;
              if (snow) c = lit ? (band > 0.66 ? SNH : band < 0.3 ? SNM : SNL) : band > 0.68 ? SNM : band < 0.3 ? SND : SNS;
              else { c = lit ? (band < 0.35 ? RKS : RKL) : band < 0.35 ? RKD : RKS; if (th(Math.round(u) * 3.7 + y * 0.31 + P.seed) > 0.92) c = lit ? RKS : RKD; }
              // the arete: a lit edge on the sunny side of the ridge, a hard shadow on the other
              if (d < P.h * 0.55 && rx - x > 0 && rx - x <= 1) c = snow ? SNH : RKL;
              if (d < P.h * 0.55 && x - rx >= 0 && x - rx < 1) c = snow ? SND : RKD;
              // a soft checker where snow meets rock
              if (Math.abs(d - line) < 1 && (x + y) % 2) c = snow ? (lit ? RKL : RKS) : lit ? SNL : SNS;
              // the skyline edge of a front peak, so it separates from the one behind
              if (y === ys && order > 0) c = shade(c, lit ? 0.94 : 0.86);
              const low = Math.min(1, Math.max(0, (y - (G - P.h * 0.55)) / (P.h * 0.55)));
              set(x, y, haze(c, hz + 0.24 * low * low));
            }
          }
        });
        // a darker rim where rock or snow meets sky, so every summit reads crisply
        const rim = D.slice();
        for (let y = 1; y < TH; y++) for (let x = 0; x < TW; x++) {
          const o = (y * TW + x) * 4; if (!rim[o + 3] || rim[o - TW * 4 + 3]) continue;
          for (let k = 0; k < 3; k++) D[o + k] = rim[o + k] * 0.9;
        }
        farBuf = D.slice();
      } else D.set(farBuf);

      /* snow blowing off the highest summit */
      if (hero && w[1] < 0.8) {
        const top = Math.round(G - profile(hero, Math.round(hero.cx))), SN = haze(mw3([255, 255, 255], [170, 185, 220], [240, 242, 244]), 0.3);
        for (let k = 0; k < 18; k++) { const age = (t * 0.45 + k * 0.137) % 1;
          set(hero.cx + 1 + age * 24 + Math.sin(k * 2.1) * 1.2, top + 1 - age * 4 + Math.sin(t * 2 + k) * 0.7, SN, (1 - age) * 0.7 * (1 - w[1])); }
      }
      /* stars over the peaks at night */
      if (w[1] > 0.05) for (let k = 0; k < TW * 0.12; k++) {
        const sx = (th(k + 600) * TW) | 0, sy = (th(k + 601) * A * 0.6) | 0, o = (sy * TW + sx) * 4;
        if (D[o + 3]) continue;
        const b = 0.55 + 0.45 * Math.sin(t * (1 + th(k) * 2.5) + k * 3);
        set(sx, sy, [226, 234, 255], w[1] * b * (0.35 + th(k + 602) * 0.65));
      }
      /* clouds drift across the range; heavier in monsoon */
      const CL = mw3([228, 235, 244], [70, 80, 112], [206, 213, 220]), ca = 0.95 * w[0] + 0.45 * w[1] + 0.95 * w[2];
      clouds.forEach((cl, i) => {
        if (i % 2 && w[2] < 0.5 && i > 2) return;
        if (!reduce) { cl.x -= cl.v * 0.06; if (cl.x + cl.w < -2) Object.assign(cl, mkCloud(TW + 4 + th(i + t) * 30, i)); }
        for (const [k, y, b] of cl.px) set(cl.x + k, cl.y + y, shade(CL, b), ca);
      });
      /* birds by day */
      if (w[0] > 0.5) for (let k = 0; k < 3; k++) {
        const bx = ((t * (3.2 + k * 0.6) + k * 47) % (TW + 30)) - 15, by = A * 0.22 + k * 3 + Math.sin(t * 0.9 + k) * 1.5, up = Math.sin(t * 7 + k * 2) > 0;
        const B = haze([44, 52, 66], 0.3);
        set(bx, by, B); set(bx - 1, up ? by - 1 : by, B); set(bx + 1, up ? by - 1 : by, B); set(bx - 2, up ? by - 1 : by + 1, B); set(bx + 2, up ? by - 1 : by + 1, B);
      }

      /* foothill ridge with a treeline on its crest */
      const FT = mw3([96, 130, 122], [18, 28, 38], [98, 118, 114]), FL = mw3([122, 156, 140], [26, 38, 50], [120, 138, 132]), FD = mw3([74, 106, 100], [12, 20, 28], [80, 98, 96]);
      for (let x = 0; x < TW; x++) {
        const yr = ridge[x], lit = ridge[Math.min(TW - 1, x + 2)] < ridge[Math.max(0, x - 2)], tip = th(x * 1.9) > 0.5 ? 1 + ((th(x * 4.1) * 2.4) | 0) : 0;
        for (let y = yr - tip; y <= G; y++) {
          let c = y < yr ? FD : lit ? FL : FT;
          if (y >= yr && th(x * 2.3 + y * 5.7) > 0.8) c = FD;
          set(x, y, haze(c, 0.16));
        }
      }

      /* the forest */
      const LEAF = [mw3([52, 120, 72], [14, 34, 34], [46, 90, 72]), mw3([74, 140, 84], [20, 44, 44], [62, 104, 86]), mw3([38, 96, 60], [12, 28, 30], [36, 74, 60])];
      const HI = mw3([150, 204, 118], [44, 80, 74], [118, 152, 132]), SH = mw3([22, 62, 44], [6, 14, 18], [24, 48, 42]);
      const DEO = mw3([60, 112, 98], [14, 32, 38], [54, 92, 84]), DHI = mw3([132, 184, 156], [40, 72, 78], [116, 150, 138]), DSH = mw3([26, 64, 56], [6, 14, 20], [26, 50, 46]);
      const FAR = mw3([150, 190, 176], [24, 38, 58], [132, 152, 150]), BARK = mw3([96, 68, 44], [28, 22, 22], [72, 58, 48]), BARK2 = mw3([64, 44, 30], [18, 14, 14], [50, 40, 34]);
      const GRASS = mw3([70, 128, 64], [16, 30, 28], [60, 94, 72]), GRASS2 = mw3([104, 160, 80], [26, 46, 40], [86, 120, 92]), SOIL = mw3([84, 70, 52], [20, 18, 18], [62, 56, 50]);
      const RED = mw3([214, 52, 76], [96, 30, 46], [190, 62, 82]), PINK = mw3([238, 112, 132], [110, 46, 62], [214, 104, 120]);
      const tone = (base: RGB, x: number, y: number, r: number, seed: number) => { /* light from the upper left, with dithered leaf texture */
        const l = (-x * 0.55 - y * 0.8) / (r + 0.01), n = th(x * 3.1 + y * 7.7 + seed);
        if (l + n * 0.5 > 0.75) return HI; if (l - n * 0.4 < -0.55) return SH; return n > 0.7 ? shade(base, 1.08) : base; };
      /* far hazy treeline */
      for (const T of far) { const sway = Math.sin(t * 0.8 + T.ph) * 0.6, base = G - 3;
        for (let y = 0; y < T.h; y++) { const u = y / T.h, wdt = T.kind === 'pine' ? (1 - u) * T.h * 0.3 : Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)) * T.h * 0.35;
          for (let x = -wdt; x <= wdt; x++) set(T.x + x + sway * u, base - y, FAR, 0.9); } }
      for (const T of trees) {
        const Ly = T.layer, base = Ly === 1 ? G - 1 : G, sw = Math.sin(t * 1.15 + T.ph) * (T.h / 18), F = LEAF[(T.hue * 3) | 0], dim = Ly === 1 ? 0.82 : 1;
        const col = (c: RGB) => shade(c, dim);
        if (T.kind === 'bush') { const r = T.h; for (let y = -r; y <= 0; y++) for (let x = -r * 1.6; x <= r * 1.6; x++) { if ((x / 1.6) ** 2 + y * y > r * r * (0.8 + th(x + y * 9 + T.seed) * 0.35)) continue; set(T.x + x, base + y, col(tone(F, x / 1.6, y + r / 2, r, T.seed))); }
          if (th(T.seed) > 0.5) for (let k = 0; k < 3; k++) set(T.x - r + th(T.seed + k) * 2 * r, base - th(T.seed + k + 3) * r, col(RED)); continue; }
        const trunkH = T.kind === 'pine' || T.kind === 'deodar' ? 4 : T.kind === 'tall' ? T.h * 0.45 : T.h * 0.42;
        for (let y = 0; y < trunkH; y++) { const sx = sw * (y / T.h); set(T.x + sx, base - y, col(BARK)); if (T.h > 16) set(T.x + 1 + sx, base - y, col(BARK2)); }
        set(T.x - 1, base, col(BARK2)); set(T.x + 2, base, col(BARK2));
        if (T.kind === 'deodar') {
          /* deodar: wide, flat tiers that droop at the tips, blue-green, with a nodding leader */
          const tiers = 4 + ((T.h / 9) | 0);
          for (let y = 0; y < T.h; y++) {
            const u = y / T.h, tier = (u * tiers) % 1, env = (1 - u) * T.h * 0.42 + 1, wdt = env * (0.42 + 0.58 * (1 - tier)), off = sw * u;
            for (let x = -wdt; x <= wdt; x++) {
              let c = tier > 0.7 && x < wdt * 0.3 ? DHI : x > wdt * 0.4 || tier < 0.18 ? DSH : DEO;
              if (th(x * 5 + y * 3 + T.seed) > 0.88) c = shade(c, 0.86);
              set(T.x + x + off, base - 3 - y, col(c));
              if (tier < 0.2 && Math.abs(x) > wdt - 1.5) set(T.x + x + off + Math.sign(x), base - 2 - y, col(DSH));
            }
          }
          set(T.x + sw + 1, base - 3 - T.h, col(DHI)); set(T.x + sw + 2, base - 2 - T.h, col(DHI));
        } else if (T.kind === 'pine') {
          const tiers = 3 + ((T.h / 10) | 0);
          for (let y = 0; y < T.h; y++) { const u = y / T.h, tier = (u * tiers) % 1, wdt = (1 - u) * T.h * 0.3 * (0.65 + 0.35 * (1 - tier)) + 1, off = sw * u;
            for (let x = -wdt; x <= wdt; x++) { let c = x < -wdt * 0.2 ? HI : x > wdt * 0.35 ? SH : F; if (tier > 0.82 && Math.abs(x) > wdt - 1.5) c = SH; if (th(x * 5 + y * 3 + T.seed) > 0.86) c = shade(c, 0.85);
              set(T.x + x + off, base - 3 - y, col(c)); } }
          set(T.x + sw, base - 4 - T.h, col(HI));
        } else {
          const tall = T.kind === 'tall', r = tall ? T.h * 0.22 : T.h * 0.42, cy = base - trunkH - r * (tall ? 1.6 : 0.7), ry = tall ? 2.1 : 1;
          /* a few branches */
          for (let k = 0; k < 2; k++) { const by = base - trunkH * (0.5 + k * 0.25), dir = k ? 1 : -1; for (let j = 1; j < r * 0.7; j++) set(T.x + dir * j + sw * 0.4, by - j * 0.6, col(BARK)); }
          /* canopy as overlapping clumps */
          const clumps = 4 + ((r / 3) | 0);
          for (let c = 0; c < clumps; c++) { const ang = th(T.seed + c) * 6.28, dist = c ? r * 0.55 * th(T.seed + c + 9) : 0, cr = r * (c ? 0.5 + th(T.seed + c + 4) * 0.25 : 0.75);
            const ccx = Math.cos(ang) * dist, ccy = Math.sin(ang) * dist * ry * 0.8;
            for (let y = -cr * ry; y <= cr * ry; y++) for (let x = -cr; x <= cr; x++) { const yy = y / ry; if (x * x + yy * yy > cr * cr * (0.82 + th(x * 3 + y * 5 + T.seed + c) * 0.3)) continue;
              const gx = x + ccx, gy = y + ccy, sway = sw * (1 - ((gy + r * ry) / (2 * r * ry)) * 0.6);
              set(T.x + gx + sway, cy + gy, col(tone(F, gx, gy / ry, r, T.seed + c))); } }
          /* rhododendron blossoms: red clusters scattered over the crown */
          if (T.kind === 'rhodo') for (let k = 0; k < 6 + r; k++) {
            const bx = T.x + (th(T.seed + k * 2) - 0.5) * r * 1.5 + sw, by = cy + (th(T.seed + k * 2 + 1) - 0.6) * r * 1.2, c = col(th(T.seed + k) > 0.3 ? RED : PINK);
            set(bx, by, c); if (th(T.seed + k * 5) > 0.5) set(bx + 1, by, c);
          }
        }
      }

      /* homes: a two-storey kath-kuni house and a small stone hut, with slate roofs */
      const STONE = mw3([150, 144, 134], [44, 46, 56], [128, 126, 120]), STONED = mw3([112, 106, 98], [30, 32, 42], [98, 96, 92]), MORTAR = mw3([188, 182, 170], [58, 60, 70], [164, 162, 154]);
      const TIMB = mw3([124, 80, 46], [38, 28, 24], [98, 68, 44]), TIMBD = mw3([80, 50, 30], [22, 16, 16], [64, 44, 30]), TIMBL = mw3([162, 112, 68], [52, 38, 30], [130, 92, 62]);
      const SLATE = mw3([102, 108, 122], [34, 38, 54], [88, 94, 104]), SLATED = mw3([70, 76, 90], [20, 24, 38], [62, 68, 78]), SLATEL = mw3([140, 146, 158], [50, 56, 74], [120, 126, 134]);
      const GLOW = [255, 196, 110], WIN = mw3([46, 52, 66], GLOW, [52, 58, 70]), SMOKE = mw3([150, 156, 168], [92, 98, 116], [150, 156, 164]), LOGEND = mw3([200, 156, 104], [60, 46, 34], [170, 132, 92]);
      const stone = (x: number, r: number, side: number) => { const m = (x + (r % 2 ? 2 : 0)) % 4 === 0; const c = m ? MORTAR : th(x * 5.3 + r * 9.1) > 0.75 ? STONED : STONE; return side ? shade(c, 0.84) : c; };
      const roof = (cx: number, top: number, half: number, rh: number) => {
        for (let k = 0; k < rh; k++) {
          const hw = Math.round(half * (1 - k / rh)), y = top - k;
          for (let x = -hw; x <= hw; x++) {
            let c = x < 0 ? SLATEL : SLATE;
            if ((x + 40 + (k % 2) * 2) % 4 === 0) c = SLATED;
            if (Math.abs(x) >= hw || k === 0) c = SLATED;
            set(cx + x, y, c);
          }
        }
        set(cx, top - rh, SLATED);
      };
      const glowHalo = (x: number, y: number, w2: number, h2: number) => { if (w[1] < 0.2) return; for (let yy = -1; yy <= h2; yy++) for (let xx = -1; xx <= w2; xx++) if (xx < 0 || yy < 0 || xx >= w2 || yy >= h2) set(x + xx, y + yy, GLOW, 0.18 * w[1]); };
      const smoke = (x: number, y: number) => { if (reduce) return; for (let j = 0; j < 8; j++) { const age = (t * 0.3 + j / 8) % 1; const sx = x + age * 7 + Math.sin(t * 1.3 + j) * 1.1, sy = y - age * 15, a = (1 - age) * 0.6; set(sx, sy, SMOKE, a); if (age > 0.3) set(sx + 1, sy, SMOKE, a * 0.6); } };
      for (const hm of homes) {
        const cx = hm.x;
        if (hm.kind === 'house') {
          const W = 20, x0 = cx - 10, wallH = 9, galH = 5;
          for (let y = 0; y < 2; y++) for (let x = -1; x <= W; x++) set(x0 + x, G - y, shade(stone(x, y + 7, 0), 0.92));
          for (let r = 0; r < wallH; r++) for (let x = 0; x < W; x++) {
            const y = G - 2 - r; set(x0 + x, y, r % 3 === 2 ? (x % 5 === 0 ? TIMBD : x >= W - 3 ? shade(TIMB, 0.84) : TIMB) : stone(x, r, x >= W - 3 ? 1 : 0));
          }
          for (let r = 0; r < 6; r++) for (let x = 3; x <= 6; x++) set(x0 + x, G - 2 - r, x === 3 || x === 6 || r === 5 ? TIMBL : r === 2 && x === 5 ? TIMBL : TIMBD);
          for (let r = 3; r < 6; r++) for (let x = 12; x <= 14; x++) set(x0 + x, G - 2 - r, x === 13 && r === 4 ? TIMBD : WIN);
          for (let x = 11; x <= 15; x++) set(x0 + x, G - 4, TIMBL);
          glowHalo(x0 + 12, G - 7, 3, 3);
          const gy = G - 2 - wallH;
          for (let r = 0; r < galH; r++) for (let x = -2; x < W + 2; x++) {
            let c = r === 0 || r === galH - 1 ? TIMBD : x % 2 ? TIMBL : TIMB;
            if (r >= 1 && r <= 2 && ((x >= 4 && x <= 7) || (x >= 12 && x <= 15))) c = x === 6 || x === 14 ? TIMBD : WIN;
            if (x >= W) c = shade(c, 0.84);
            set(x0 + x, gy - r, c);
          }
          for (const wx of [4, 12]) glowHalo(x0 + wx, gy - 2, 4, 2);
          const rt = gy - galH;
          for (let r = 0; r < 6; r++) { set(x0 + 14, rt - r - 2, STONE); set(x0 + 15, rt - r - 2, STONED); }
          set(x0 + 13, rt - 8, STONED); set(x0 + 16, rt - 8, STONED);
          roof(cx, rt, 14, 10);
          for (let x = -13; x <= 13; x++) set(cx + x, rt + 1, TIMBD, 0.5);
          smoke(x0 + 15, rt - 9);
        } else {
          const W = 12, x0 = cx - 6, wallH = 7;
          for (let r = 0; r < wallH; r++) for (let x = 0; x < W; x++) set(x0 + x, G - r, r === 4 ? (x % 4 === 0 ? TIMBD : TIMB) : stone(x, r, x >= W - 2 ? 1 : 0));
          for (let r = 0; r < 5; r++) for (let x = 2; x <= 4; x++) set(x0 + x, G - r, x === 2 || r === 4 ? TIMBL : TIMBD);
          for (let r = 2; r < 4; r++) for (let x = 8; x <= 9; x++) set(x0 + x, G - r, WIN);
          glowHalo(x0 + 8, G - 3, 2, 2);
          roof(cx, G - wallH, 9, 7);
          for (let x = -8; x <= 8; x++) set(cx + x, G - wallH + 1, TIMBD, 0.45);
          // a woodpile: stacked log ends
          for (let r = 0; r < 3; r++) for (let k = 0; k < 5 - r; k++) set(x0 + W + 2 + k + r * 0.5, G - r, (k + r) % 2 ? TIMBL : LOGEND);
        }
      }
      /* ground: soil band, grass tufts, small flowers, rocks */
      for (let y = G + 1; y < TH; y++) for (let x = 0; x < TW; x++) set(x, y, y === G + 1 ? GRASS : th(x * 1.7 + y * 3.1) > 0.8 ? shade(SOIL, 1.15) : SOIL);
      for (const r of rocks) for (let x = 0; x < r.w; x++) { set(r.x + x, G, mw3([150, 150, 142], [46, 50, 58], [128, 132, 132])); if (x && x < r.w - 1) set(r.x + x, G - 1, mw3([178, 178, 170], [60, 64, 74], [150, 154, 154])); }
      for (const g of tufts) { const bend = Math.round(Math.sin(t * 2 + g.x * 0.3) * 0.6);
        for (let y = 0; y < g.h; y++) set(g.x + (y === g.h - 1 ? bend : 0), G - y, y ? GRASS2 : GRASS);
        if (g.f > 0.93 && w[1] < 0.5) set(g.x + bend, G - g.h, g.f > 0.97 ? [250, 220, 70] : g.f > 0.95 ? [250, 250, 250] : [236, 120, 170]); }
      /* fireflies at night, butterflies by day, rain in monsoon */
      if (w[1] > 0.05) for (let k = 0; k < Math.ceil(TW / 30); k++) { const fx = th(k + 300) * TW + Math.sin(t * 0.5 + k) * 6, fy = G - 3 - th(k + 301) * TB * 0.45 + Math.sin(t * 0.9 + k * 2) * 2, b = 0.5 + 0.5 * Math.sin(t * (2 + th(k) * 3) + k);
        if (b > 0.45) set(fx, fy, [210, 255, 140], w[1] * b); }
      if (w[0] > 0.5) for (let k = 0; k < 3; k++) { const bx = ((t * (3 + k) + k * 120) % (TW + 20)) - 10, by = G - 8 - k * 3 + Math.sin(t * 3 + k) * 2, fl = Math.sin(t * 14 + k) > 0;
        const c = [[250, 200, 60], [240, 240, 250], [120, 170, 250]][k]; set(bx, by, c); if (fl) { set(bx - 1, by - 1, c); set(bx + 1, by - 1, c); } else { set(bx - 1, by, c); set(bx + 1, by, c); } }
      if (w[2] > 0.05) for (let k = 0; k < TW * 0.5; k++) { const rx = th(k + 600) * TW, ry = (th(k + 601) * TH + t * (30 + th(k) * 20)) % TH; set(rx, ry, [210, 224, 232], 0.45 * w[2]); }
      tg.putImageData(img, 0, 0);
    },
    stop() { ro.disconnect(); io.disconnect(); },
  };
}
