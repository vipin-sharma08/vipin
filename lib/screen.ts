// Screen constants and the CPU twin of the dot shader maths.
// The shader (lib/dot-screen.ts) and the ink checks both read from here, so they never drift apart.

export type RGB = [number, number, number];

export const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// Colour ramp, screen depth 0 to 1.75 (BRIEF.md tokens). Each stop: [hex, smoothstep from, smoothstep to]
export const RAMP = {
  base: '#EDF6EB',
  stops: [
    ['#A3D1ED', 0.0, 0.55],
    ['#3080CC', 0.48, 0.78],
    ['#08297A', 0.72, 0.98],
    ['#030D30', 0.95, 1.3],
    ['#010206', 1.25, 1.75],
  ] as [string, number, number][],
  pool: '#0A52B8',
  led: '#D1FFE6',
};

export const MOOD: Record<string, string> = {
  name: '#FFF7E6',
  work: '#59B2FF',
  books: '#FFB261',
  thoughts: '#80FFBD',
};

export const INK = { dark: '#0B0F1A', light: '#F3F6FA' };

// Every tunable constant. The dev panel edits this object live.
export const P = {
  cellDesktop: 7,
  cellPhone: 6,
  phoneBelow: 760,
  dotRadius: 0.41,
  highlight: 0.22,
  gutter: 0.05,
  nightShift: 0.42,
  driftX: 0.028,
  driftY: 0.022,
  warp: 0.38,
  wave: 0.05,
  pool: 0.55,
  cursorGlow: 0.35,
  cursorRadius: 150,
  rippleSpeed: 620,
  rippleWidth: 70,
  rippleDecay: 1.4,
  revealSpeed: 0.9,
  revealCell: 9,
  focusDim: 0.6,
  tintAmount: 0.85,
  billboardDim: 0.22,
};

/* ---------- maths shared with the shader ---------- */

const fract = (x: number) => x - Math.floor(x);
const sstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

export const h21 = (x: number, y: number) => {
  let px = fract(x * 123.34), py = fract(y * 456.21);
  const d = px * (px + 45.32) + py * (py + 45.32);
  px += d; py += d;
  return fract(px * py);
};
const vn = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  return mix(mix(h21(ix, iy), h21(ix + 1, iy), fx), mix(h21(ix, iy + 1), h21(ix + 1, iy + 1), fx), fy);
};
const fbm = (x: number, y: number) => {
  let s = 0, a = 0.5;
  for (let i = 0; i < 4; i++) { s += a * vn(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 17.1; a *= 0.5; }
  return s;
};

const RAMP_RGB = { base: hex(RAMP.base), stops: RAMP.stops.map(([h, a, b]) => [hex(h), a, b] as [RGB, number, number]) };
export const ramp = (s: number): RGB => {
  let c = RAMP_RGB.base;
  for (const [col, a, b] of RAMP_RGB.stops) c = mix3(c, col, sstep(a, b, s));
  return c;
};

export const istNow = () => new Date(Date.now() + 19800000);
export const istHour = () => { const d = istNow(); return d.getUTCHours() + d.getUTCMinutes() / 60; };
export const nightOf = (h: number) => 1 - sstep(5.6, 6.7, h) + sstep(17.6, 18.9, h);

export type ScreenState = {
  w: number; h: number; // CSS px
  time: number; night: number;
  tint: RGB; tintAmt: number;
  focus: [number, number]; focusAmt: number; // focus in uv, y up
  torch: number;
};

// Colour of the light at a CSS point, before the dot pattern (mirrors the shader).
export function lightAt(x: number, y: number, S: ScreenState): RGB {
  const px = x / S.w, py = 1 - y / S.h, asp = S.w / S.h, qx = px * asp, qy = py, t = S.time;
  const wx = fbm(qx * 1.5 + t * P.driftX, qy * 1.5) - 0.5;
  let s = (px * 0.9 + (1 - py) * 1.1) * 0.9 + wx * P.warp + Math.sin(qx * 2.1 + qy * 2.7 + t * 0.11) * P.wave + S.night * P.nightShift - 0.06;
  s += 0.3 * S.torch;
  const fx = (px - S.focus[0]) * asp, fy = py - S.focus[1];
  s -= S.focusAmt * P.focusDim * Math.exp(-(fx * fx + fy * fy) * 3.5);
  let col = ramp(s);
  const pqx = (px - 0.02) * 2.2, pqy = (py - 0.2) * 3;
  col = mix3(col, hex(RAMP.pool), Math.exp(-(pqx * pqx + pqy * pqy)) * P.pool * sstep(0.6, 1.1, s));
  if (S.tintAmt > 0) {
    const lum = col[0] * 0.3 + col[1] * 0.55 + col[2] * 0.15;
    const k = 0.08 + 1.05 * Math.pow(lum, 0.9), hi = 0.9 * sstep(0.7, 1, lum) * 0.25;
    col = mix3(col, [S.tint[0] * k + hi, S.tint[1] * k + hi, S.tint[2] * k + hi], S.tintAmt);
  }
  return col;
}

// Average screen colour over a patch of dots: lit disc, dark gutter, plus the calm halo (g) and billboard (r).
export function screenAt(x: number, y: number, S: ScreenState, halo: number, lit: number, textAmt: number): RGB {
  let col = lightAt(x, y, S);
  const led = hex(RAMP.led).map((v) => v * 1.12) as RGB;
  col = mix3(col, mix3(col.map((v) => v * P.billboardDim) as RGB, led, lit), textAmt);
  const cover = Math.PI * P.dotRadius * P.dotRadius; // share of each cell lit
  const dots = col.map((v) => v * (cover * 0.97 + (1 - cover) * P.gutter)) as RGB;
  return mix3(dots, col.map((v) => v * 0.9) as RGB, halo * 0.28);
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const relLum = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const DARK_L = relLum(hex(INK.dark)), LIGHT_L = relLum(hex(INK.light));

// Pick the ink with the higher WCAG contrast against what is under the word.
export function inkFor(bg: RGB): { dark: boolean; ratio: number } {
  const L = relLum(bg), cd = contrast(L, DARK_L), cl = contrast(L, LIGHT_L);
  return cd >= cl ? { dark: true, ratio: cd } : { dark: false, ratio: cl };
}

// CSS gradient for the no-GPU fallback, sampled from the same ramp along the diagonal.
export function fallbackGradient(night: number) {
  const stops: string[] = [];
  for (let i = 0; i <= 10; i++) {
    // top-left (depth 0) to bottom-right (depth 1.8), same diagonal as the shader
    const t = i / 10, s = t * 1.8 + night * P.nightShift - 0.06;
    const c = ramp(s).map((v) => Math.round(v * 255));
    stops.push(`rgb(${c.join(',')}) ${Math.round(t * 100)}%`);
  }
  return `linear-gradient(135deg, ${stops.join(', ')})`;
}
