'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { notes, ORDER, footer, stamp as stampOf, type NoteKey } from '@/content';
import { P, MOOD, INK, hex, istNow, istHour, nightOf, screenAt, relLum, contrast, fallbackGradient, type RGB, type ScreenState } from '@/lib/screen';
import Sheet from './Sheet';
import st from './Site.module.css';

// WCAG contrast of an ink against a background colour
const contrastOf = (bg: RGB, dark: boolean) => contrast(relLum(bg), relLum(hex(dark ? INK.dark : INK.light)));

// Variant 0 ships: Billboard + Mood. 1 to 4 are the single variants, dev only, via ?v=
const DEV = process.env.NODE_ENV === 'development';
const VARIANTS = ['Billboard + Mood', 'Billboard', 'Torch', 'Magnet', 'Mood'];
const billboardOn = (v: number) => v === 0 || v === 1;
const moodOn = (v: number) => v === 0 || v === 4;

type Engine = {
  hover: (k: NoteKey | null) => void;
  opened: (k: NoteKey | null) => void;
  ripple: (x: number, y: number, a: number) => void;
  toggleNight: () => void;
  dispose: () => void;
};

export default function Site() {
  const [variant, setVariant] = useState(0);
  const [open, setOpen] = useState<NoteKey | null>(null);
  const [inState, setIn] = useState(false);
  const [wide, setWide] = useState(true);
  const [clock, setClock] = useState({ stamp: '', meta: '' });
  const [reduce, setReduce] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wordRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const metaRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const engine = useRef<Engine | null>(null);
  const openRef = useRef<NoteKey | null>(null);
  const moved = useRef(false);

  /* ---------- clock: live IST ---------- */
  useEffect(() => {
    const tick = () => {
      const d = istNow(), hhmm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
      setClock({ stamp: stampOf(d, hhmm), meta: footer(hhmm) });
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  /* ---------- variant from the URL (dev only), reduced motion ---------- */
  useEffect(() => {
    const q = new URLSearchParams(location.search), v = Number(q.get('v'));
    if (DEV && v >= 1 && v <= 4) setVariant(v);
    const r = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduce(r);
    const t = setTimeout(() => setIn(true), r ? 0 : 450);
    return () => clearTimeout(t);
  }, []);

  /* ---------- the engine: screen, mask, ink, loop ---------- */
  useEffect(() => {
    const stage = stageRef.current!, canvas = canvasRef.current!;
    const words = wordRefs.current as HTMLButtonElement[];
    const q = new URLSearchParams(location.search);
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const forced = q.get('night');
    let forceNight: number | null = forced === null ? null : Number(forced);
    let disposed = false;

    const S = {
      w: 1, h: 1, dpr: 1, cell: 7, gw: 1, gh: 1,
      tm: [-1e5, -1e5] as [number, number], mouse: [-1e5, -1e5] as [number, number],
      hover: null as NoteKey | null, word: '', text: 0, textT: 0,
      push: 0, pushT: variant === 2 || variant === 3 ? 1 : 0,
      focus: [0.5, 0.5] as [number, number], fA: 0, fT: 0,
      tint: [1, 1, 1] as RGB, tintT: [1, 1, 1] as RGB, tA: 0, tAT: 0,
      rip: [0, 0, 99, 0], time: 0, rate: 1, reveal: rm ? 2 : 0,
      lit: [0, 0, 0, 0], ink: ['', '', '', ''], metaInk: '',
      dirty: true,
    };
    const phys = words.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));

    /* the mask the shader reads: red = billboard word, green = calm halos behind the words */
    const mask = document.createElement('canvas');
    const mx = mask.getContext('2d', { willReadFrequently: true })!;
    let pixelFamily = 'monospace';
    let pixelUnit = 0.1; // font pixels per CSS px of font size, measured once the font loads
    function measurePixelUnit() {
      const c = document.createElement('canvas'); c.width = 200; c.height = 200;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.font = `500 100px ${pixelFamily}`; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      g.fillText('I', 20, 100);
      const row = g.getImageData(0, 100, 200, 1).data;
      let run = 0, best = 0;
      for (let i = 0; i < 200; i++) { if (row[i * 4 + 3] > 127) { run++; best = Math.max(best, run); } else run = 0; }
      if (best > 0) pixelUnit = 1 / best;
    }
    let onMask: () => void = () => {};
    function drawMask() {
      const W = mask.width, H = mask.height, k = 1 / (S.cell / S.dpr);
      mx.globalCompositeOperation = 'source-over';
      mx.filter = 'none';
      mx.fillStyle = '#000';
      mx.fillRect(0, 0, W, H);
      if (S.word) {
        // Geist Pixel draws on its own grid: size it so one font pixel is a whole number of dots
        mx.fillStyle = '#f00';
        mx.textAlign = 'left';
        mx.textBaseline = 'alphabetic';
        mx.font = `500 100px ${pixelFamily}`;
        const tw100 = mx.measureText(S.word).width;
        const fit = Math.min(H * 0.5, (100 * W * 0.86) / tw100);
        const n = Math.max(1, Math.floor(fit * pixelUnit));
        const fs = n / pixelUnit;
        mx.font = `500 ${fs}px ${pixelFamily}`;
        const m = mx.measureText(S.word);
        const capH = m.actualBoundingBoxAscent;
        const x0 = Math.round((W - m.width) / 2), y0 = Math.round((H + capH) / 2);
        mx.fillText(S.word, x0, y0);
        // snap to whole dots: each cell is either lit or not
        const img = mx.getImageData(0, 0, W, H), d = img.data;
        for (let i = 0; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
        mx.putImageData(img, 0, 0);
      }
      // where the word is lit, per word cell (for the ink check)
      const img = S.word ? mx.getImageData(0, 0, W, H).data : null;
      words.forEach((w, i) => {
        S.lit[i] = 0;
        if (!img) return;
        const r = w.firstElementChild!.getBoundingClientRect();
        let n = 0, sum = 0;
        for (let y = Math.floor(r.top * k); y < Math.ceil(r.bottom * k); y++)
          for (let x = Math.floor(r.left * k); x < Math.ceil(r.right * k); x++) {
            if (x < 0 || y < 0 || x >= W || y >= H) continue;
            sum += img[(y * W + x) * 4] / 255; n++;
          }
        S.lit[i] = n ? sum / n : 0;
      });
      if (!S.word) {
        mx.globalCompositeOperation = 'lighter';
        mx.filter = 'blur(6px)';
        mx.fillStyle = '#0f0';
        for (const w of words) {
          const r = w.firstElementChild!.getBoundingClientRect();
          if (!r.width) continue;
          const x = r.left * k, y = r.top * k, ww = r.width * k, hh = r.height * k;
          mx.beginPath();
          mx.ellipse(x + ww / 2, y + hh / 2, ww * 0.7 + 4, hh * 0.9 + 3, 0, 0, Math.PI * 2);
          mx.fill();
        }
        mx.filter = 'none';
      }
      onMask();
      S.dirty = true;
    }

    /* ink: work out the screen under each word on the CPU, pick the ink with more contrast */
    const nightNow = () => (forceNight === null ? nightOf(istHour()) : forceNight);
    function screenState(): ScreenState {
      return {
        w: S.w, h: S.h, time: S.time, night: nightNow(),
        tint: S.tint, tintAmt: S.tA * P.tintAmount,
        focus: S.focus, focusAmt: S.fA, torch: variant === 2 ? 1 : 0,
      };
    }
    function glowAt(x: number, y: number) {
      if (S.mouse[0] < -1e4) return 1;
      const d2 = (x - S.mouse[0]) ** 2 + (y - S.mouse[1]) ** 2;
      return 1 + P.cursorGlow * Math.exp(-d2 / (2 * P.cursorRadius ** 2)) * (variant === 2 ? 0.4 : 1);
    }
    function inkCheck() {
      const ss = screenState(), halo = S.word ? 0 : 1;
      const pick = (el: HTMLElement, lit: number, prev: string) => {
        const r = el.getBoundingClientRect();
        if (!r.width) return prev;
        const pts = [
          [r.left + r.width / 2, r.top + r.height / 2], [r.left + 4, r.top + r.height / 2], [r.right - 4, r.top + r.height / 2],
          [r.left + r.width / 2, r.top + 4], [r.left + r.width / 2, r.bottom - 4],
        ];
        // the ink whose worst contrast across the patch is best
        let dMin = Infinity, lMin = Infinity;
        for (const [x, y] of pts) {
          const g = glowAt(x, y), c = screenAt(x, y, ss, halo, lit, S.text).map((v) => Math.min(1, v * g)) as RGB;
          dMin = Math.min(dMin, contrastOf(c, true));
          lMin = Math.min(lMin, contrastOf(c, false));
        }
        const want = dMin >= lMin ? 'dark' : 'light';
        // a little hysteresis so the ink does not flicker at the crossover
        if (prev && want !== prev && Math.abs(dMin - lMin) / Math.max(dMin, lMin) < 0.1) return prev;
        return want;
      };
      words.forEach((w, i) => {
        const ink = pick(w.firstElementChild as HTMLElement, S.lit[i], S.ink[i]);
        if (ink !== S.ink[i]) { S.ink[i] = ink; w.dataset.ink = ink; }
      });
      const m = metaRef.current;
      if (m) {
        const ink = pick(m, 0, S.metaInk);
        if (ink !== S.metaInk) { S.metaInk = ink; m.dataset.ink = ink; }
      }
    }

    /* fallback: no WebGPU and no WebGL. A CSS gradient from the same ramp; notes still open */
    let screen: import('@/lib/dot-screen').DotScreen | null = null;
    const fallback = () => {
      stage.style.background = fallbackGradient(nightNow());
      canvas.style.display = 'none';
      S.reveal = 2; S.time = 0;
    };

    function size() {
      const r = stage.getBoundingClientRect();
      S.w = Math.max(1, r.width); S.h = Math.max(1, r.height);
      S.dpr = Math.min(window.devicePixelRatio || 1, 2);
      S.cell = Math.max(2, Math.round((S.w < P.phoneBelow ? P.cellPhone : P.cellDesktop) * S.dpr));
      setWide(S.w >= P.phoneBelow);
      if (screen) {
        const b = screen.setSize(S.w, S.h, S.dpr);
        S.gw = Math.ceil(b.x / S.cell); S.gh = Math.ceil(b.y / S.cell);
      } else {
        S.gw = Math.ceil((S.w * S.dpr) / S.cell); S.gh = Math.ceil((S.h * S.dpr) / S.cell);
      }
      mask.width = S.gw; mask.height = S.gh;
      drawMask();
      inkCheck();
    }

    const ro = new ResizeObserver(size);

    /* ---------- the loop ---------- */
    let last = performance.now(), lastInk = 0, lastMask = 0, settleUntil = 0;
    const damp = (a: number, b: number, k: number, dt: number) => (rm ? b : a + (b - a) * (1 - Math.exp(-k * dt)));
    function frame(now: number) {
      const dt = Math.min(1 / 20, Math.max(0, (now - last) / 1000));
      last = now;
      // calm the screen while a note is open: drift eases to a stop
      S.rate = damp(S.rate, openRef.current ? 0 : 1, 3, dt);
      if (!rm) S.time += dt * S.rate;
      S.reveal = Math.min(2, S.reveal + dt * P.revealSpeed);
      if (S.tm[0] < -1e4) S.mouse = [-1e5, -1e5];
      else if (S.mouse[0] < -1e4) S.mouse = [...S.tm];
      else S.mouse = [damp(S.mouse[0], S.tm[0], 14, dt), damp(S.mouse[1], S.tm[1], 14, dt)];
      S.text = damp(S.text, S.textT, 7, dt);
      S.push = damp(S.push, S.pushT * (S.tm[0] < -1e4 ? 0 : 1), 6, dt);
      S.fA = damp(S.fA, S.fT, 3, dt);
      S.tA = damp(S.tA, S.tAT, 4, dt);
      for (let i = 0; i < 3; i++) S.tint[i] = damp(S.tint[i], S.tintT[i], 4, dt);
      if (S.rip[2] < 60) S.rip[2] += dt;

      // magnet (dev variant 3): words lean away from the cursor and spring home
      if (variant === 3) {
        words.forEach((w, i) => {
          const p = phys[i];
          const r = w.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          const dx = cx - S.tm[0], dy = cy - S.tm[1], d = Math.hypot(dx, dy) || 1;
          const f = S.tm[0] < -1e4 ? 0 : Math.max(0, 1 - d / 260) * 900;
          p.vx += (-p.x * 60 + (dx / d) * f) * dt; p.vy += (-p.y * 60 + (dy / d) * f) * dt;
          p.vx *= Math.exp(-dt * 7); p.vy *= Math.exp(-dt * 7);
          p.x += p.vx * dt; p.y += p.vy * dt;
          w.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) rotate(${(p.vx * 0.02).toFixed(2)}deg)`;
        });
        if (now - lastMask > 120) { lastMask = now; drawMask(); }
      } else if (now < settleUntil && now - lastMask > 100) {
        // the grid is moving (sheet opening): keep the halos under the words
        lastMask = now; drawMask();
      }

      if (now - lastInk > 220) { lastInk = now; inkCheck(); }

      if (screen && (!rm || S.dirty)) {
        const u = screen.u;
        u.mouse.value.set(S.mouse[0] * S.dpr, (S.h - S.mouse[1]) * S.dpr);
        u.grid.value.set(S.gw, S.gh);
        u.focus.value.set(S.focus[0], S.focus[1]);
        u.time.value = S.time;
        u.night.value = nightNow();
        u.cellPx.value = S.cell;
        u.textAmt.value = S.text;
        u.push.value = S.push;
        u.focusAmt.value = S.fA;
        u.tintAmt.value = S.tA * P.tintAmount;
        u.tint.value.set(S.tint[0], S.tint[1], S.tint[2]);
        u.reveal.value = S.reveal;
        u.rip.value.set(S.rip[0], S.rip[1], S.rip[2], rm ? 0 : S.rip[3]);
        u.lensOn.value = variant === 3 ? 1 : 0;
        u.torchOn.value = variant === 2 ? 1 : 0;
        screen.render();
        S.dirty = false;
      }
    }

    const start = () => { last = performance.now(); screen?.renderer.setAnimationLoop(frame); };
    const stop = () => screen?.renderer.setAnimationLoop(null);
    let fbLoop = 0;
    const startFallback = () => {
      const tick = (t: number) => { frame(t); fbLoop = requestAnimationFrame(tick); };
      fbLoop = requestAnimationFrame(tick);
    };
    const onVis = () => {
      if (document.hidden) { stop(); cancelAnimationFrame(fbLoop); }
      else if (screen) start();
      else startFallback();
    };

    /* ---------- boot ---------- */
    (async () => {
      const family = getComputedStyle(document.documentElement).getPropertyValue('--font-geist-pixel-square').trim();
      if (family) {
        pixelFamily = family;
        try { await document.fonts.load(`500 40px ${family}`); } catch {}
        measurePixelUnit();
      }
      try {
        const { DotScreen } = await import('@/lib/dot-screen');
        if (disposed) return;
        const ds = new DotScreen(canvas);
        await ds.init();
        if (disposed) { ds.dispose(); return; }
        screen = ds;
        ds.mask = mask;
        ds.maskTex.image = mask;
        onMask = () => { ds.maskTex.needsUpdate = true; };
        canvas.dataset.backend = ds.isWebGPU ? 'webgpu' : 'webgl2';
      } catch {
        fallback();
      }
      ro.observe(stage);
      size();
      if (screen) start(); else startFallback();
      document.addEventListener('visibilitychange', onVis);
      if (DEV) setupGui();
    })();

    let gui: { destroy: () => void } | null = null;
    async function setupGui() {
      if (q.get('gui') === '0') return;
      const { default: GUI } = await import('lil-gui');
      if (disposed) return;
      const g = new GUI({ title: 'Dots' });
      const rows: [keyof typeof P, number, number, number][] = [
        ['cellDesktop', 3, 16, 1], ['cellPhone', 3, 16, 1], ['dotRadius', 0.2, 0.5, 0.005], ['highlight', 0, 1, 0.01],
        ['gutter', 0, 0.3, 0.005], ['nightShift', 0, 1, 0.01], ['driftX', 0, 0.2, 0.001], ['driftY', 0, 0.2, 0.001],
        ['warp', 0, 1, 0.01], ['wave', 0, 0.3, 0.005], ['pool', 0, 1, 0.01], ['cursorGlow', 0, 1, 0.01],
        ['cursorRadius', 20, 400, 1], ['rippleSpeed', 100, 1500, 10], ['rippleWidth', 10, 200, 1], ['rippleDecay', 0.2, 4, 0.05],
        ['revealSpeed', 0.1, 3, 0.05], ['revealCell', 2, 30, 1], ['focusDim', 0, 1.5, 0.01], ['tintAmount', 0, 1, 0.01],
        ['billboardDim', 0, 1, 0.01],
      ];
      for (const [n, a, b, s] of rows) {
        const c = g.add(P, n, a, b, s);
        if (n.startsWith('cell')) c.onChange(size);
      }
      g.add({ copy: () => navigator.clipboard.writeText(JSON.stringify(P, null, 2)) }, 'copy').name('copy values');
      g.close();
      gui = g;
    }

    /* ---------- events ---------- */
    const onMove = (e: PointerEvent) => { S.tm = [e.clientX, e.clientY]; };
    const onLeave = () => { S.tm = [-1e5, -1e5]; };
    const ripple = (x: number, y: number, a: number) => {
      if (rm) return;
      S.rip = [x * S.dpr, (S.h - y) * S.dpr, 0, a];
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-word],[data-sheet],[data-switcher]')) return;
      ripple(e.clientX, e.clientY, 0.7);
      if (openRef.current) closeRef.current();
    };
    window.addEventListener('pointermove', onMove);
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointerdown', onDown);

    const showWord = (k: NoteKey | null) => {
      if (!billboardOn(variant)) return;
      const n = k && notes.find((x) => x.key === k);
      S.word = n ? n.billboard : '';
      S.textT = S.word ? 1 : 0;
      drawMask();
    };
    const tintTo = (k: NoteKey | null) => {
      if (!moodOn(variant)) return;
      if (k) { S.tintT = hex(MOOD[k]); S.tAT = 1; } else S.tAT = 0;
    };

    engine.current = {
      hover(k) {
        S.hover = k;
        const m = k || openRef.current;
        showWord(m); tintTo(m);
      },
      opened(k) {
        settleUntil = performance.now() + 900;
        if (!k) { S.fT = 0; showWord(S.hover); tintTo(S.hover); return; }
        const w = words[ORDER.indexOf(k)], r = w.getBoundingClientRect();
        S.focus = [(r.left + r.width / 2) / S.w, 1 - (r.top + r.height / 2) / S.h];
        S.fT = variant === 2 ? 1 : 0.55;
        showWord(k); tintTo(k);
      },
      ripple,
      toggleNight() {
        forceNight = forceNight === null ? (nightOf(istHour()) > 0.5 ? 0 : 1) : null;
        if (!screen) stage.style.background = fallbackGradient(nightNow());
        S.dirty = true;
      },
      dispose() {},
    };

    return () => {
      disposed = true;
      ro.disconnect();
      stop();
      cancelAnimationFrame(fbLoop);
      screen?.dispose();
      gui?.destroy();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerdown', onDown);
      words.forEach((w) => { w.style.transform = ''; });
      engine.current = null;
    };
    // the engine is rebuilt only when the (dev) variant changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  /* ---------- notes ---------- */
  const openNote = useCallback((k: NoteKey, x?: number, y?: number) => {
    openRef.current = k;
    setOpen(k);
    engine.current?.opened(k);
    if (x !== undefined && y !== undefined) engine.current?.ripple(x, y, variant === 3 ? 1.4 : 1);
    setTimeout(() => backRef.current?.focus({ preventScroll: true }), 400);
  }, [variant]);

  const closeNote = useCallback(() => {
    const k = openRef.current;
    openRef.current = null;
    setOpen(null);
    engine.current?.opened(null);
    if (k) wordRefs.current[ORDER.indexOf(k)]?.focus({ preventScroll: true });
  }, []);
  const closeRef = useRef(closeNote);
  closeRef.current = closeNote;

  const nextNote = useCallback(() => {
    const k = ORDER[(ORDER.indexOf(openRef.current ?? 'name') + 1) % ORDER.length];
    const r = wordRefs.current[ORDER.indexOf(k)]!.getBoundingClientRect();
    openNote(k, r.left + r.width / 2, r.top + r.height / 2);
  }, [openNote]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape' && openRef.current) closeNote();
      if (e.key === 'n' || e.key === 'N') engine.current?.toggleNight();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeNote]);

  const onWordClick = (k: NoteKey, e: React.MouseEvent<HTMLButtonElement>) => {
    if (moved.current) { moved.current = false; return; }
    const r = e.currentTarget.getBoundingClientRect();
    const fromKey = e.detail === 0;
    openNote(k, fromKey ? r.left + r.width / 2 : e.clientX, fromKey ? r.top + r.height / 2 : e.clientY);
  };

  const cls = [inState && st.in, open && st.open, wide && st.wide, variant === 3 && st.magnet].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <div ref={stageRef} className={st.stage} aria-hidden="true">
        <canvas ref={canvasRef} className={st.canvas} />
      </div>
      <main className={st.grid} aria-label="Vipin Sharma">
        <h1 className="sr-only">Vipin Sharma</h1>
        {notes.map((n, i) => (
          <div key={n.key} className={st.cell}>
            <button
              ref={(el) => { wordRefs.current[i] = el; }}
              className={st.word}
              data-word={n.key}
              data-ink="dark"
              aria-haspopup="dialog"
              aria-expanded={open === n.key}
              onPointerEnter={() => engine.current?.hover(n.key)}
              onPointerLeave={() => engine.current?.hover(null)}
              onFocus={() => engine.current?.hover(n.key)}
              onBlur={() => engine.current?.hover(null)}
              onClick={(e) => onWordClick(n.key, e)}
            >
              <span className={`${st.ink} ${st.inkDark}`}>{n.word}</span>
              <span className={`${st.ink} ${st.inkLight}`} aria-hidden="true">{n.word}</span>
            </button>
          </div>
        ))}
      </main>
      <div ref={metaRef} className={st.meta} data-ink="light">
        <span className={`${st.ink} ${st.inkDark}`}>{clock.meta}</span>
        <span className={`${st.ink} ${st.inkLight}`} aria-hidden="true">{clock.meta}</span>
      </div>
      {DEV && (
        <nav className={st.switcher} aria-label="Variants" data-switcher>
          {VARIANTS.map((name, v) => (
            <a key={v} href={v ? `?v=${v}` : '?'} aria-current={variant === v}>{v} {name}</a>
          ))}
        </nav>
      )}
      <Sheet ref={backRef} open={open} stamp={clock.stamp} typeTitle={variant === 2} reduce={reduce} onBack={closeNote} onNext={nextNote} />
    </div>
  );
}

