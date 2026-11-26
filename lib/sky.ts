// The Sky page engine: sky band, orb, draw-on-the-sky egg, Himalaya footer, IST clock and theme.
// Ported from reference/04-sky-index.html. Default sky is the vendored ascii-sky; "dots" is the LED dot sky.
import { mountSky, type MountedSky } from './ascii-sky';
import { startFooter, type Footer } from './footer';

export type Theme = 'day' | 'night' | 'monsoon';
export type Pref = 'auto' | Theme;
export type SkyMode = 'dots' | 'ascii';
export type Engine = { refresh: () => void; stop: () => void };

const THEMES: Pref[] = ['auto', 'day', 'night', 'monsoon'];
const W: Record<Theme, number[]> = { day: [1, 0, 0], night: [0, 1, 0], monsoon: [0, 0, 1] };
const ASCII_THEME: Record<Theme, 'light' | 'dark'> = { day: 'light', night: 'dark', monsoon: 'light' };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

const ist = () => new Date(Date.now() + 19800000);
const istH = () => { const d = ist(); return d.getUTCHours() + d.getUTCMinutes() / 60; };
const isNight = () => { const h = istH(); return h < 6.1 || h >= 18.5; };

const FS = `precision highp float;
uniform vec2 R,G; uniform float T,C,D,L; uniform vec3 W,M; uniform sampler2D P;
float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h1(i), h1(i + vec2(1., 0.)), f.x), mix(h1(i + vec2(0., 1.)), h1(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * n2(p); p = p * 2.03 + vec2(17.1, 9.2); a *= .5; } return s; }
void main(){
  vec2 px = vec2(gl_FragCoord.x, R.y - gl_FragCoord.y);
  vec2 cell = floor(px / C), lp = (fract(px / C) - .5) * C, cc = (cell + .5) * C;
  float v = cc.y / R.y;
  float fade = 1. - smoothstep(.16, .8, v);
  if (fade < .004){ gl_FragColor = vec4(0.); return; }
  vec2 q = cell / vec2(30., 15.), dr = vec2(T * .06, T * .004);
  float cover = .525 - .075 * W.z + .02 * W.y;
  float f1 = fbm(q + dr), f2 = fbm(q * 2.1 + dr * 1.7 + 5.2);
  float cl = f1 * .8 + f2 * .28;
  float cloud = smoothstep(cover, cover + .13, cl);
  float under = smoothstep(cover - .02, cover + .3, fbm(q + dr + vec2(0., -.09)) * .8 + f2 * .28);
  float g = smoothstep(0., .72, v);
  vec3 sky = W.x * mix(vec3(.17, .48, .8), vec3(.7, .85, .95), g)
           + W.y * mix(vec3(.008, .025, .11), vec3(.05, .1, .27), g)
           + W.z * mix(vec3(.31, .39, .45), vec3(.63, .7, .74), g);
  vec3 cdy = mix(vec3(1.), vec3(.8, .87, .94), (1. - under) * .7);
  vec3 cnt = mix(vec3(.17, .21, .33), vec3(.1, .13, .23), 1. - under);
  vec3 crn = mix(vec3(.88, .9, .92), vec3(.45, .52, .57), (1. - under) * .95);
  vec3 col = mix(sky, W.x * cdy + W.y * cnt + W.z * crn, cloud * (1. - .45 * W.y));
  float hs = h1(cell * 1.31 + 3.7);
  float star = step(.988, hs) * (1. - cloud) * (1. - smoothstep(.25, .7, v));
  float mag = fract(hs * 97.3), tw = .5 + .5 * sin(T * (1.1 + mag * 3.) + mag * 40.);
  col = mix(col, vec3(.93, .97, 1.), star * mix(.22, 1., mag * mag) * (.45 + .55 * tw) * W.y);
  float hc = h1(vec2(cell.x, 7.1));
  float drop = fract(cell.y * .042 - T * (.9 + hc * .8) + hc * 13.);
  col = mix(col, vec3(.93, .97, 1.), step(.42, hc) * smoothstep(.72, 1., drop) * W.z);
  col = mix(col, vec3(1.), L * .5 * (1. - v));
  float md = length(cc - M.xy) / (95. * D);
  col = mix(col, W.x * vec3(1.) + W.y * vec3(.62, .84, 1.) + W.z * vec3(1.), M.z * exp(-md * md * 2.2) * .55);
  float pt = texture2D(P, (cell + .5) / G).a;
  col = mix(col, W.x * vec3(.04, .17, .5) + W.y * vec3(.82, 1., .9) + W.z * vec3(1., .82, .45), pt);
  col *= .975 + .05 * h1(cell + floor(T * 5.));
  float r = C * .39, d = length(lp);
  float dm = 1. - smoothstep(r - D * .8, r + D * .5, d);
  vec3 gut = mix(sky, vec3(1.), .55 * (1. - W.y)) * mix(1., .55, W.y);
  vec3 o = mix(gut, col, dm);
  float a = fade * mix(.32 + .68 * dm, 1., fade * fade);
  gl_FragColor = vec4(o * a, a);
}`;

export function startSky(mode: SkyMode, forced: Theme | null, assets = '/ascii-sky/'): Engine {
  const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector(s) as T | null;
  const body = document.body;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const ac = new AbortController();
  const on = { signal: ac.signal } as const;
  const observers: (ResizeObserver | IntersectionObserver)[] = [];
  const timers: number[] = [];

  /* ---------- theme: auto follows Bengaluru; the button names the next one ---------- */
  let pref: Pref = 'auto';
  try { pref = (localStorage.getItem('vs-theme') as Pref) || 'auto'; } catch {}
  if (!THEMES.includes(pref)) pref = 'auto';
  if (forced) pref = forced;
  const btn = $<HTMLButtonElement>('#theme')!;
  const metaTC = $<HTMLMetaElement>('meta[name=theme-color]');
  let theme: Theme = 'day';
  let wT = [1, 0, 0], w = [1, 0, 0];
  let orbDirty = true;
  let ascii: MountedSky | null = null;

  function applyTheme(snap?: boolean) {
    theme = pref === 'auto' ? (isNight() ? 'night' : 'day') : pref;
    body.classList.toggle('night', theme === 'night');
    body.classList.toggle('monsoon', theme === 'monsoon');
    const next = THEMES[(THEMES.indexOf(pref) + 1) % THEMES.length];
    btn.textContent = (pref === 'auto' ? 'auto, ' + theme : theme) + ' ↻';
    btn.title = 'Theme: ' + (pref === 'auto' ? 'auto, follows the time in Bengaluru' : pref);
    btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    if (metaTC) metaTC.content = theme === 'night' ? '#05070d' : theme === 'monsoon' ? '#eef1f2' : '#f6f8f9';
    wT = W[theme];
    if (snap || reduce) w = wT.slice();
    orbDirty = true;
    ascii?.setTheme(ASCII_THEME[theme]);
    if (reduce) requestFrame();
  }
  btn.addEventListener('click', () => {
    pref = THEMES[(THEMES.indexOf(pref) + 1) % THEMES.length];
    try { localStorage.setItem('vs-theme', pref); } catch {}
    applyTheme();
  }, on);
  timers.push(window.setInterval(() => { if (pref === 'auto') applyTheme(); }, 60000));

  /* ---------- the sky: an LED screen of dots ---------- */
  const cv = ($<HTMLCanvasElement>('#sky') ?? $<HTMLCanvasElement>('#ascii'))!;
  let gl: WebGLRenderingContext | null = null;
  const U: Record<string, WebGLUniformLocation | null> = {};
  let tex: WebGLTexture | null = null;
  const paint = document.createElement('canvas');
  const pctx = paint.getContext('2d', { willReadFrequently: true })!;
  let grid = [1, 1], C = 7, dpr = 1;
  if (mode === 'dots') {
    try { gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false }); } catch {}
    if (gl) {
      const g = gl;
      const sh = (t: number, s: string) => { const o = g.createShader(t)!; g.shaderSource(o, s); g.compileShader(o); if (!g.getShaderParameter(o, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(o) || 'shader'); return o; };
      try {
        const prog = g.createProgram()!;
        g.attachShader(prog, sh(g.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
        g.attachShader(prog, sh(g.FRAGMENT_SHADER, FS));
        g.linkProgram(prog); g.useProgram(prog);
        const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b);
        g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
        const loc = g.getAttribLocation(prog, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
        for (const n of ['R', 'G', 'T', 'C', 'D', 'L', 'W', 'M', 'P']) U[n] = g.getUniformLocation(prog, n);
        tex = g.createTexture(); g.bindTexture(g.TEXTURE_2D, tex);
        for (const [k, v] of [[g.TEXTURE_MIN_FILTER, g.NEAREST], [g.TEXTURE_MAG_FILTER, g.NEAREST], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, k, v);
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array(4));
        g.uniform1i(U.P, 0);
      } catch { gl = null; }
    }
    if (!gl) body.classList.add('no-gl');
  } else {
    const box = $<HTMLCanvasElement>('#ascii');
    if (box) {
      ascii = mountSky(box, { theme: ASCII_THEME[isNight() ? 'night' : 'day'], assets });
      ascii.ready.then(() => box.classList.add('on')).catch(() => body.classList.add('no-gl'));
    }
  }

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    if (!gl) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    C = Math.round((innerWidth < 600 ? 6 : 7) * dpr);
    const wd = Math.round(cv.clientWidth * dpr), ht = Math.round(cv.clientHeight * dpr);
    if (!wd || !ht) return;
    if (cv.width !== wd || cv.height !== ht) { cv.width = wd; cv.height = ht; gl.viewport(0, 0, wd, ht); }
    const g = [Math.ceil(wd / C), Math.ceil(ht / C)];
    if (g[0] !== grid[0] || g[1] !== grid[1]) {
      const old = paint.width ? pctx.getImageData(0, 0, paint.width, paint.height) : null;
      grid = g; paint.width = g[0]; paint.height = g[1]; if (old) pctx.putImageData(old, 0, 0); paintDirty = true;
    }
    requestFrame();
  }
  const ro = new ResizeObserver(size); ro.observe(cv); observers.push(ro);

  /* pointer: a soft light follows the cursor across the sky */
  let mouse = [-999, -999], mS = 0, mT = 0;
  addEventListener('pointermove', (e) => { if (!fine || drawing) return; mouse = [e.pageX * dpr, e.pageY * dpr]; mT = e.pageY < cv.clientHeight * 0.78 ? 1 : 0; requestFrame(); }, { passive: true, signal: ac.signal });
  document.addEventListener('pointerleave', () => { mT = 0; }, on);

  /* easter egg: draw on the sky */
  let drawing = false, paintDirty = false, paintLive = 0, last: number[] | null = null;
  const pad = $('#pad')!;
  function setDraw(v: boolean) {
    drawing = v; body.classList.toggle('drawing', v); mT = 0;
    if (v) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    requestFrame();
  }
  function bindEgg() { const e = $<HTMLButtonElement>('#egg'); if (e) e.onclick = () => setDraw(!drawing); }
  $<HTMLButtonElement>('#done')!.onclick = () => setDraw(false);
  $<HTMLButtonElement>('#clear')!.onclick = () => { pctx.clearRect(0, 0, paint.width, paint.height); paintDirty = true; requestFrame(); };
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawing) setDraw(false); }, on);
  const toCell = (e: PointerEvent) => [(e.pageX * dpr) / C, (e.pageY * dpr) / C];
  function stroke(a: number[], b: number[]) {
    pctx.strokeStyle = pctx.fillStyle = '#fff'; pctx.lineWidth = 1.5; pctx.lineCap = 'round';
    pctx.beginPath(); pctx.moveTo(a[0], a[1]); pctx.lineTo(b[0], b[1]); pctx.stroke();
    paintDirty = true; paintLive = 1; requestFrame();
  }
  pad.addEventListener('pointerdown', (e) => { if (!gl) return; pad.setPointerCapture(e.pointerId); last = toCell(e); stroke(last, [last[0] + 0.01, last[1]]); }, on);
  pad.addEventListener('pointermove', (e) => { if (!last) return; const p = toCell(e); stroke(last, p); last = p; }, on);
  const lift = () => { last = null; };
  pad.addEventListener('pointerup', lift, on); pad.addEventListener('pointercancel', lift, on);

  /* lightning, only in monsoon */
  let L = 0, nextBolt = 0;

  /* ---------- loop ---------- */
  let raf = 0, t0 = performance.now(), visible = true;
  const T0 = Math.random() * 400;
  function requestFrame() { if (!raf && !ac.signal.aborted) raf = requestAnimationFrame(frame); }
  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
    const k = 1 - Math.exp(-dt * 3.2);
    for (let i = 0; i < 3; i++) w[i] += (wT[i] - w[i]) * k;
    mS += (mT - mS) * (1 - Math.exp(-dt * 6));
    const T = reduce ? T0 : T0 + now / 1000;
    if (theme === 'monsoon' && !reduce) { if (now > nextBolt) { nextBolt = now + 7000 + Math.random() * 12000; L = 1; } L *= Math.exp(-dt * 7); if (L < 0.02) L = 0; if (L > 0 && Math.random() < 0.04) L = 0.8; } else L = 0;
    if (paintLive > 0 && !drawing) { pctx.globalCompositeOperation = 'destination-out'; pctx.fillStyle = 'rgba(0,0,0,.006)'; pctx.fillRect(0, 0, paint.width, paint.height); pctx.globalCompositeOperation = 'source-over'; paintDirty = true; paintLive -= dt / 14; }
    if (gl && visible) {
      if (paintDirty) { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paint); paintDirty = false; }
      gl.uniform2f(U.R, cv.width, cv.height); gl.uniform2f(U.G, grid[0], grid[1]);
      gl.uniform1f(U.T, T); gl.uniform1f(U.C, C); gl.uniform1f(U.D, dpr); gl.uniform1f(U.L, L);
      gl.uniform3f(U.W, w[0], w[1], w[2]); gl.uniform3f(U.M, mouse[0], mouse[1], mS);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!cv.classList.contains('on')) cv.classList.add('on');
    }
    drawOrb(now); range?.render(now, dt, w);
    if (!reduce) requestFrame();
  }
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) requestFrame(); }); io.observe(cv); observers.push(io);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { t0 = performance.now(); requestFrame(); } }, on);

  /* ---------- the orb: a dot-matrix sphere, lit by a slowly turning light ---------- */
  let orb: HTMLCanvasElement | null = null, octx: CanvasRenderingContext2D | null = null, orbT = 0;
  function orbSetup() { orb = $<HTMLCanvasElement>('#orb'); if (!orb) return; const d = Math.min(devicePixelRatio || 1, 2); orb.width = orb.height = Math.round(46 * d); octx = orb.getContext('2d'); orbDirty = true; }
  function drawOrb(now: number) {
    if (!orb || !octx || !orb.isConnected) return;
    if (!orbDirty && (reduce || now - orbT < 70)) return; orbT = now; orbDirty = false;
    const s = orb.width, cs = Math.max(2, Math.round(s / 15)), r = s / 2 - 1, cx = s / 2, cy = s / 2, a = reduce ? 0 : now / 4200;
    const lx = Math.cos(a) * 0.6 - 0.25, ly = -0.55, lz = 0.58;
    const st = getComputedStyle(body), lit = st.getPropertyValue('--acc').trim(), dim = st.getPropertyValue('--lead').trim();
    octx.clearRect(0, 0, s, s);
    for (let y = -r; y < r; y += cs) for (let x = -r; x < r; x += cs) {
      const nx = (x + cs / 2) / r, ny = (y + cs / 2) / r, dd = nx * nx + ny * ny; if (dd > 1) continue;
      const nz = Math.sqrt(1 - dd), l = Math.max(0, nx * lx + ny * ly + nz * lz) * 0.95 + 0.08;
      const bx = (((x + r) / cs) | 0) & 3, by = (((y + r) / cs) | 0) & 3, lightOn = l > BAYER[by * 4 + bx];
      octx.fillStyle = lightOn ? lit : dim; octx.globalAlpha = lightOn ? 1 : 0.55;
      octx.beginPath(); octx.arc(cx + x + cs / 2, cy + y + cs / 2, cs * 0.36, 0, 7); octx.fill();
    }
    octx.globalAlpha = 1;
  }

  /* ---------- footer: the Himalaya in pixels ---------- */
  const rc = $<HTMLCanvasElement>('#range');
  const range: Footer | null = rc ? startFooter(rc, reduce, requestFrame) : null;

  /* live time and day in Bengaluru */
  function tickNow() { const el = $('#nowT'); if (!el) return; const d = ist(), h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, '0');
    const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getUTCDay()];
    el.innerHTML = `bangalore • ${day} • ${h % 12 || 12}<b>:</b>${m} ${h < 12 ? 'am' : 'pm'}`; }
  timers.push(window.setInterval(tickNow, 15000));

  /* ---------- boot ---------- */
  applyTheme(true); orbSetup(); bindEgg(); tickNow(); size(); requestFrame();

  return {
    refresh() { orbSetup(); bindEgg(); tickNow(); requestFrame(); },
    stop() {
      ac.abort(); cancelAnimationFrame(raf); raf = 0;
      observers.forEach((o) => o.disconnect()); timers.forEach((t) => clearInterval(t));
      ascii?.stop(); range?.stop(); body.classList.remove('drawing', 'no-gl');
    },
  };
}
