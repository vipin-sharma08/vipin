# CLAUDE.md: Vipin Sharma personal site

Read BRIEF.md and CONTENT.md before any change. reference/04-sky-index.html (the Sky page, `/`) and reference/05-city.html (`/city`) are the visual source of truth. reference/01 to 03 are history.

## Stack
- Next.js 15 (App Router), React 19, TypeScript, deployed on Vercel
- Plain CSS: tokens as custom properties in `app/globals.css`, CSS modules per component. No Tailwind, no CSS-in-JS, no UI kits
- Sky page: one WebGL fragment shader for the dot sky, 2D canvas for the orb and trees (`lib/sky.ts`). `?sky=ascii` swaps in ascii-sky (MIT, vendored in `lib/ascii-sky`, assets in `public/ascii-sky`)
- `/city` is a self-contained static file, `public/city.html`
- Fonts from the `geist` package via next/font: Geist Serif, Geist. `/city` uses the same files from `public/fonts`. Self-hosted, no Google Fonts requests
- Dev only: Playwright for screenshots

## Rendering rules
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`; size from a ResizeObserver on the canvas container
- Dot cells = CSS px x dpr, rounded to whole device pixels, so dots stay round and crisp at every zoom
- `outputColorSpace = SRGBColorSpace`, `toneMapping = NoToneMapping`: a hex in the shader must match the same hex in CSS
- One loop: `renderer.setAnimationLoop`. All motion uses dt (clamped to 1/20 s). Damp with `1 - Math.exp(-k * dt)`, never fixed per-frame steps
- No GPU readbacks. Work out the screen brightness under each word on the CPU with the same ramp maths as the shader
- Text stays HTML over the canvas (crisp, selectable, accessible). Only the billboard word is drawn as dots, via a CanvasTexture mask that is updated only when it changes
- Pause when the tab is hidden. `prefers-reduced-motion`: one static frame, no drift, no ripples
- No WebGPU or WebGL: CSS gradient built from the ramp; every note still opens

## Design rules
- Less is better. Every element earns its place
- Contrast: note text WCAG AA; the big words at least 3:1 against the dots under them, at all times of day
- Two easings only: `--ease: cubic-bezier(.2,.8,.2,1)` and `--ease-sheet: cubic-bezier(.2,.9,.2,1)`
- In the DOM, animate only transform and opacity
- Day/night follows the hour in Bengaluru (IST), not the visitor's OS theme
- When a note is open, the screen calms down: no motion behind text being read
- Copy comes only from `content.ts` (built from CONTENT.md). Never invent copy; a missing link shows "soon"
- No em dashes anywhere, in copy, UI, comments or commit messages. Use commas, colons or periods

## Never
Fish, foliage (the pixel tree line at the foot of the Sky page is the one approved exception), rusty or dull metal, a dark page in daytime, rainbow palettes, section-title banners, Lorem ipsum, stock icons other than the brand marks.

## Loop for every visual change
1. Make the change
2. `npm run shots`: Playwright at 1440x900 @1x, 1280x800 @2x, 390x844 @3x, day and `?theme=night`, dots and `?sky=ascii`, plus the Work page and `/city`
3. Look at the PNGs yourself and fix what's off before showing me
4. Show me the shots with a 3-bullet summary: what changed, what's still off, next step

## Done means
- Matches the reference/01 screenshots, or every difference is deliberate and listed
- Steady 60fps at 390px on a mid-range phone (check the DevTools Performance panel with 4x CPU throttle)
- Lighthouse mobile: Performance 90+, Accessibility 100
- Keyboard: Tab through the words, Enter opens, Esc closes, focus goes back to the word
- Zero console errors or warnings
- OG image and meta tags set; favicon from the dot motif
- `CHANGELOG.md`: one line per change

## How to talk to me
Short bullets, no essays. Ask before adding a dependency or a new feature. If you're stuck for more than one try, say so and give options.
