// The LED dot screen: one fullscreen quad, WebGPURenderer (falls back to WebGL2 on its own), shader in TSL.
// Ported line for line from reference/01. Works in "GL pixel space": origin bottom-left, physical pixels.
import {
  CanvasTexture, LinearFilter, Mesh, MeshBasicNodeMaterial, NoColorSpace, NoToneMapping,
  OrthographicCamera, PlaneGeometry, Scene, SRGBColorSpace, Vector2, Vector3, Vector4, WebGPURenderer,
} from 'three/webgpu';
import * as TSL from 'three/tsl';
import { P, RAMP, hex } from './screen';

type N = any; // TSL's generated types reject a dynamic node graph; keep the shader readable
const { dot, exp, float, floor, fract, length, mix, pow, sin, smoothstep, sRGBTransferEOTF, step, texture, uniform, uv, vec2, vec3, Fn } = TSL as N;

const v3 = (h: string) => vec3(...hex(h));

export class DotScreen {
  renderer: WebGPURenderer;
  scene = new Scene();
  camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mask: HTMLCanvasElement;
  maskTex: CanvasTexture;
  isWebGPU = false;

  u = {
    res: uniform(new Vector2(1, 1)),
    mouse: uniform(new Vector2(-1e5, -1e5)),
    grid: uniform(new Vector2(1, 1)),
    focus: uniform(new Vector2(0.5, 0.5)),
    time: uniform(0),
    dpr: uniform(1),
    night: uniform(0),
    textAmt: uniform(0),
    push: uniform(0),
    focusAmt: uniform(0),
    tintAmt: uniform(0),
    reveal: uniform(0),
    cellPx: uniform(7),
    tint: uniform(new Vector3(1, 1, 1)),
    rip: uniform(new Vector4(0, 0, 99, 0)), // x, y (GL px), age (s), amplitude
    lensOn: uniform(0),
    torchOn: uniform(0),
  };
  // tunables, mirrored from P every frame so the dev panel is live
  k = Object.fromEntries(Object.keys(P).map((n) => [n, uniform((P as Record<string, number>)[n])])) as Record<keyof typeof P, N>;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGPURenderer({ canvas, antialias: false, alpha: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.mask = document.createElement('canvas');
    this.mask.width = this.mask.height = 1;
    this.maskTex = new CanvasTexture(this.mask);
    this.maskTex.colorSpace = NoColorSpace;
    this.maskTex.minFilter = this.maskTex.magFilter = LinearFilter;
    this.maskTex.generateMipmaps = false;

    const mat = new MeshBasicNodeMaterial();
    mat.colorNode = this.shader() as N;
    mat.toneMapped = false;
    mat.depthTest = mat.depthWrite = false;
    this.scene.add(new Mesh(new PlaneGeometry(2, 2), mat));
  }

  async init() {
    await this.renderer.init();
    this.isWebGPU = !!(this.renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend;
  }

  setSize(w: number, h: number, pr: number) {
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    const b = this.renderer.getDrawingBufferSize(new Vector2());
    this.u.res.value.copy(b);
    this.u.dpr.value = pr;
    return b;
  }

  render() {
    for (const n in this.k) this.k[n as keyof typeof P].value = P[n as keyof typeof P];
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.maskTex.dispose();
  }

  private shader() {
    const U = this.u, K = this.k, tex = this.maskTex;

    const h21 = (p: N) => {
      const a = fract(p.mul(vec2(123.34, 456.21))).toVar();
      a.addAssign(dot(a, a.add(45.32)));
      return fract(a.x.mul(a.y));
    };
    const vn = (p: N) => {
      const i = floor(p), f0 = fract(p), f = f0.mul(f0).mul(float(3).sub(f0.mul(2)));
      return mix(mix(h21(i), h21(i.add(vec2(1, 0))), f.x), mix(h21(i.add(vec2(0, 1))), h21(i.add(vec2(1, 1))), f.x), f.y);
    };
    const fbm = (p0: N) => {
      let s: N = float(0), a = 0.5, p: N = p0;
      for (let i = 0; i < 4; i++) { s = s.add(vn(p).mul(a)); p = p.mul(2.03).add(17.1); a *= 0.5; }
      return s;
    };
    const ramp = (s: N) => {
      let c: N = v3(RAMP.base);
      for (const [h, a, b] of RAMP.stops) c = mix(c, v3(h), smoothstep(a, b, s));
      return c;
    };

    return Fn(() => {
      const res = U.res, t = U.time, asp = res.x.div(res.y);
      const fc = uv().mul(res);
      const dm = fc.sub(U.mouse), dl = length(dm).div(U.dpr);

      // magnet: a lens that pushes the dots away from the cursor
      const lens = U.lensOn.mul(U.push).mul(exp(dl.mul(dl).negate().div(2 * 130 * 130)));
      const Pp = fc.sub(dm.mul(lens).mul(0.42));
      const cell = U.cellPx;
      const cid = floor(Pp.div(cell)), cf = fract(Pp.div(cell)).sub(0.5), cc = cid.add(0.5).mul(cell);
      const p = cc.div(res), q = vec2(p.x.mul(asp), p.y);

      // the light: a diagonal ramp, slow noise drift, a long sine swell, shifted darker at night
      const wx = fbm(q.mul(1.5).add(vec2(t.mul(K.driftX), 0))).sub(0.5);
      const s = p.x.mul(0.9).add(float(1).sub(p.y).mul(1.1)).mul(0.9)
        .add(wx.mul(K.warp))
        .add(sin(q.x.mul(2.1).add(q.y.mul(2.7)).add(t.mul(0.11))).mul(K.wave))
        .add(U.night.mul(K.nightShift)).sub(0.06).toVar();

      // torch: the screen darkens and the light pools under the cursor
      const mp = U.mouse.div(res), md2 = length(p.sub(mp).mul(vec2(asp, 1)));
      s.addAssign(U.torchOn.mul(float(0.3).sub(exp(md2.mul(md2).mul(-5)).mul(0.75).mul(U.push))));
      // focus: light pools at the opened word
      const fq = p.sub(U.focus).mul(vec2(asp, 1));
      s.subAssign(U.focusAmt.mul(K.focusDim).mul(exp(dot(fq, fq).mul(-3.5))));

      const col = ramp(s).toVar();
      const pq = p.sub(vec2(0.02, 0.2)).mul(vec2(2.2, 3));
      col.assign(mix(col, v3(RAMP.pool), exp(dot(pq, pq).negate()).mul(K.pool).mul(smoothstep(0.6, 1.1, s))));

      // mood tint
      const lum0 = dot(col, vec3(0.3, 0.55, 0.15));
      const tinted = U.tint.mul(pow(lum0, 0.9).mul(1.05).add(0.08)).add(vec3(0.9).mul(smoothstep(0.7, 1, lum0)).mul(0.25));
      col.assign(mix(col, tinted, U.tintAmt));

      // cursor glow (softer in torch mode)
      col.mulAssign(exp(dl.mul(dl).negate().div(K.cursorRadius.mul(K.cursorRadius).mul(2))).mul(K.cursorGlow)
        .mul(float(1).sub(U.torchOn.mul(0.6))).add(1));

      // ripple ring
      const age = U.rip.z, gd = length(cc.sub(U.rip.xy)).div(U.dpr);
      const ring = gd.sub(age.mul(K.rippleSpeed)).div(K.rippleWidth);
      col.mulAssign(U.rip.w.mul(0.9).mul(exp(ring.mul(ring).negate())).mul(exp(age.mul(K.rippleDecay).negate())).mul(step(0, age)).add(1));

      // billboard word (red) and calm halos behind words (green)
      const M = texture(tex, vec2(cid.x.add(0.5).div(U.grid.x), cid.y.add(0.5).div(U.grid.y)));
      const led = v3(RAMP.led).mul(1.12);
      col.assign(mix(col, mix(col.mul(K.billboardDim), led, M.r), U.textAmt));

      // the dot: disc with a soft core, a small specular up-left, a dark gutter
      const r = length(cf), aa = float(1.3).div(cell);
      const R = K.dotRadius.add(lens.mul(0.07)).add(M.r.mul(U.textAmt).mul(0.05));
      const disc = float(1).sub(smoothstep(R.sub(aa), R.add(aa), r)), core = smoothstep(0.04, 0.15, r);
      const hq = cf.sub(vec2(-0.13, 0.13)), hl = exp(dot(hq, hq).mul(-45));
      const lum = dot(col, vec3(0.3, 0.55, 0.15));
      const o = mix(col.mul(K.gutter), col.mul(core.mul(0.5).add(0.5)).add(vec3(hl.mul(K.highlight).mul(lum))), disc).toVar();
      o.assign(mix(o, col.mul(0.9), M.g.mul(0.28)));

      // intro: dissolve in from the centre in noisy cells
      const rv = U.reveal.mul(1.35).sub(h21(floor(fc.div(U.dpr.mul(K.revealCell)))).mul(0.35));
      const out = length(fc.sub(res.mul(0.5)).div(res).mul(vec2(1.4, 1)));
      o.assign(mix(o, v3(RAMP.stops[4][0]), step(rv, out)));

      // the maths above is in display (sRGB) values, like the reference; hand three linear so the output encode returns them exactly
      return sRGBTransferEOTF(o);
    })();
  }
}
