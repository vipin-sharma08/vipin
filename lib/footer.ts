// Footer: the Himalaya in pixels. Snow peaks with lit and shadowed faces, a hazy foothill ridge,
// and the pixel forest in front: deodars, pines, red-flowering rhododendrons. Drawn into a small
// ImageData (one pixel = 4 CSS px, 3 on phones) and scaled up with image-rendering: pixelated.
// The far peaks are cached and redrawn only when the theme moves; the rest redraws at ~16 fps.

export type Footer = { render: (now: number, dt: number, w: number[]) => void; stop: () => void };
type RGB = number[];
type Tree = { x: number; h: number; kind: string; ph: number; seed: number; layer: number; hue: number };
type Peak = { cx: number; h: number; w: number; seed: number; haze: number; snow: number };
type Cloud = { x: number; y: number; v: number; w: number; px: number[][] };

const th = (n: number) => { const x = Math.sin(n * 127.1 + 3.3) * 43758.5453; return x - Math.floor(x); };
const vn = (x: number, seed: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return th(i + seed) * (1 - u) + th(i + 1 + seed) * u; };
const shade = (c: RGB, f: number) => [c[0] * f, c[1] * f, c[2] * f];

// peaks as [centre across the width, height as a share of the room above the ground]
const FAR_PEAKS = [[0.03, 0.6], [0.16, 0.76], [0.3, 0.62], [0.43, 0.7], [0.57, 0.92], [0.7, 0.68], [0.84, 0.8], [0.97, 0.6]];

export function startFooter(tr: HTMLCanvasElement, reduce: boolean, onDirty: () => void): Footer {
  const tg = tr.getContext('2d')!;
  let TW = 0, TH = 0, TS = 4, G = 0, A = 0, TB = 50;
  let trees: Tree[] = [], far: Tree[] = [], tufts: { x: number; h: number; f: number }[] = [], rocks: { x: number; w: number }[] = [];
  let peaks: Peak[] = [], hero: Peak | null = null, clouds: Cloud[] = [], ridge = new Int16Array(0);
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
    far = mk(0, [3, 4], 500); trees = mk(1, [5, 6], 100).concat(mk(2, [6, 8], 900));
    tufts = Array.from({ length: Math.ceil(TW / 2) }, (_, i) => ({ x: i * 2 + ((th(i + 40) * 2) | 0), h: 1 + ((th(i + 41) * 3) | 0), f: th(i + 42) }));
    rocks = Array.from({ length: Math.ceil(TW / 60) }, (_, i) => ({ x: (th(i + 80) * TW) | 0, w: 3 + ((th(i + 81) * 4) | 0) }));
    // peaks: far snow range, then lower, less snowy peaks in front of it
    const room = A - 2;
    peaks = FAR_PEAKS.map(([f, s], i) => ({ cx: f * TW + (th(i + 200) - 0.5) * 10, h: room * s, w: 0, seed: 300 + i * 31, haze: 0.22, snow: 0.27 }));
    for (const p of peaks) p.w = p.h * (1.05 + th(p.seed) * 0.45);
    hero = peaks.reduce((a, b) => (b.h > a.h ? b : a));
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
        const RKL = mw3([128, 142, 166], [58, 66, 98], [124, 136, 146]), RKS = mw3([84, 96, 122], [32, 38, 64], [88, 100, 110]), RKD = mw3([66, 76, 100], [22, 26, 46], [70, 80, 90]);
        const SNL = mw3([238, 244, 252], [160, 176, 216], [226, 231, 236]), SNS = mw3([178, 194, 220], [98, 112, 154], [174, 184, 196]);
        for (const P of peaks) {
          const top = Math.round(G - P.h); let L = P.cx, R = P.cx, rx = P.cx; const s = P.w / P.h;
          for (let y = top; y <= G; y++) {
            const d = y - top;
            L -= s * (0.5 + th(P.seed + y * 1.7) * 1.0); R += s * (0.5 + th(P.seed + 50 + y * 2.3) * 1.0);
            rx = Math.max(L + 1, Math.min(R - 1, rx + (th(P.seed + 90 + y) - 0.5) * 1.2 + 0.1));
            for (let x = Math.floor(L); x <= Math.ceil(R); x++) {
              if (x < 0 || x >= TW) continue;
              // snow runs down each face in couloirs that follow the slope, not the columns
              const lit = x < rx, u = lit ? x + d * s : x - d * s, gully = Math.max(0, vn(u / 3.2, P.seed + (lit ? 5 : 9)) - 0.5) * 2 * P.h * 0.5;
              const line = P.h * P.snow * (0.85 + 0.3 * vn(u / 8, P.seed)) + gully, snow = d < line;
              let c = snow ? (lit ? SNL : SNS) : lit ? RKL : RKS;
              if (!snow && th(Math.round(u) * 3.7 + y * 0.31 + P.seed) > 0.9) c = lit ? RKS : RKD;
              if (Math.abs(d - line) < 1 && (x + y) % 2) c = snow ? (lit ? RKL : RKS) : lit ? SNL : SNS;
              set(x, y, haze(c, P.haze));
            }
          }
        }
        // a darker rim where rock or snow meets sky, so every summit reads crisply
        const rim = D.slice();
        for (let y = 1; y < TH; y++) for (let x = 0; x < TW; x++) {
          const o = (y * TW + x) * 4; if (!rim[o + 3] || rim[o - TW * 4 + 3]) continue;
          for (let k = 0; k < 3; k++) D[o + k] = rim[o + k] * 0.86;
        }
        farBuf = D.slice();
      } else D.set(farBuf);

      /* snow blowing off the highest summit */
      if (hero && w[1] < 0.8) {
        const top = Math.round(G - hero.h), SN = haze(mw3([255, 255, 255], [170, 185, 220], [240, 242, 244]), 0.3);
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
