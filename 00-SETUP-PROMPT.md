# Setup prompt

How to use:
1. Make an empty folder (e.g. `vipin-site`) and open it in VS Code.
2. Put this kit inside it: `CLAUDE.md`, `BRIEF.md`, `CONTENT.md`, and the `reference/` folder.
3. Also drop your two images into `reference/`: the LED dot-screen reference (`led-reference.png`) and the Notes screenshot (`notes-reference.png`).
4. Start Claude Code in that folder and paste everything in the block below.

```
We're building my personal site from scratch in this folder, using Three.js and the Geist type family (Geist Serif for display). Treat it as a craft project: every pixel and every frame is deliberate.

Everything you need is in this folder:
- CLAUDE.md: the standing rules. Follow them for the whole project.
- BRIEF.md: direction, tokens, type, what we tried and killed, open decisions.
- CONTENT.md: every word on the site. Nothing else is a source of copy.
- reference/01-dot-screen-variants.html: the current design. This is what we're porting.
- reference/02-chrome-card-page.html: the previous version. Salvage only what BRIEF.md lists.
- reference/03-bengaluru-city-page.html: an older experiment, context only.
- reference/led-reference.png, reference/notes-reference.png: my visual references.

Step 0, before any code:
1. Read all of it.
2. Open reference/01 in Playwright at 1440x900 and 390x844, in day and night (press N), with one note open and with each of the four variants (keys 1 to 4). Save to reference/shots/. These are the parity targets.
3. Reply with your plan in under 15 lines, the questions from "Open decisions" in BRIEF.md with your recommended default for each, and anything in the reference you think is weak. Then wait for my go.

Build order (show me screenshots and a 3-bullet summary after each step, then wait):
1. Scaffold: Next.js 15 App Router + TypeScript, plain CSS tokens in app/globals.css, three pinned to an exact version, geist (Serif, Sans, Mono, Pixel through next/font), lil-gui and Playwright as dev deps, an `npm run shots` script, git init.
2. Dot screen: port the shader from reference/01 to Three.js with WebGPURenderer ('three/webgpu') and TSL on one fullscreen quad. Match it pixel for pixel: cell size, dot radius, highlight, colour ramp, drift, IST day/night curve, intro reveal, ripple. Put every constant in a dev-only lil-gui panel so I can tune by eye, with a "copy values" button. If TSL blocks you after one honest attempt, fall back to WebGLRenderer + ShaderMaterial with the GLSL ported as-is, and tell me.
3. Words and sheet: the 2x2 words in Geist Serif, automatic ink contrast (CPU-side, no readPixels), and the Notes-style sheet (right side on desktop, bottom sheet on phones). All copy typed from CONTENT.md into content.ts.
4. Interaction: ship the variant I pick in step 0 (default Billboard + Mood combined). Keep all four switchable through ?v=1..4 in dev only. The billboard word is drawn in Geist Pixel.
5. Polish: go through "Done means" in CLAUDE.md item by item, then deploy a Vercel preview and send me the URL.

Stay inside this scope. Ask before adding features or dependencies.
```
