# Brief: Vipin Sharma, personal site

## One line
A giant LED dot screen in soft diagonal light, with four plain words on it (Name, Work, Books, Thoughts). Click one and a Notes-style sheet slides in. Minimal text, playful light, built like a craft object.

## Why it exists
Job search. Funded fintechs first (founder's office, growth, ops), VC second, Bengaluru or remote. Readers are founders, chiefs of staff and recruiters who skim. It has to say "wow" on open, then get out of the way so the words can be read.

## Principles (Vipin's words)
- "Less is better." No section-title banners, no filler.
- Playful and alive, but never at the cost of reading.
- Should not feel like it's on the internet.
- Pixel-level detail: stripe.press is the bar for craft.
- High contrast. Text always clearly readable.
- Daytime looks like day. The screen follows the hour in Bengaluru.

## Current direction (26 Nov 2026): reference/04-sky-index.html + reference/05-city.html
- `/`: the Sky page. 672px single column under a dot-sky band (clouds by day, stars at night, rain in monsoon), orb + name, Notes / Projects / Experience rows with LED leader dots, hash pages for Work, Books, Thoughts, Music, draw-on-the-sky egg (dot sky only), auto/day/night/monsoon toggle.
- Sky band: unvalley's ascii-sky (chosen 26 Nov). `?sky=dots` keeps the LED dot sky for comparison.
- Footer: Himalayan snow peaks over a deodar forest in three.js. Trees sway in gusting wind, mist drifts through the valleys, light follows day/night/monsoon.
- `/city`: the live Bengaluru banner on its own.

## Previous direction (22 Nov 2026): reference/01-dot-screen-variants.html
- Whole viewport = LED dot screen. Gradient runs diagonally: warm white top-left, through pale blue and azure, to navy and black bottom-right. Slow noise drift.
- 2x2 grid, one word per cell, regular weight, large.
- Words flip ink dark/light automatically based on the screen under them.
- Note sheet: white, 30px radius, right side on desktop (470px wide, grid scales back), bottom sheet on phones (78svh). Round back and next buttons, live date stamp, then plain text. Lines fade up in a stagger.
- Click empty space: ripple through the dots. Click outside the sheet: close.
- Intro: the screen dissolves in from the centre outward in noisy cells.

### The four variants (pick one; default Billboard + Mood)
1. **Billboard**: hover a word, it spells itself across the whole screen in big lit dots (Name spells "VIPIN"); the rest dims.
2. **Torch**: the light follows the cursor. Clicking a word pools the light there and the note title types itself in.
3. **Magnet**: dots bulge away from the cursor like a lens; words lean away and can be dragged, thrown, and spring home.
4. **Mood**: each word has its own light. Hover recolours the whole screen (Name daylight, Work azure, Books amber, Thoughts mint).

## Type (new: Geist family)
- **Geist Serif**: the four words and note titles. Display only, 32px and up. Regular weight only for now. `ELSH` axis changes dot shape (round, square, triangle, heart); stylistic sets ss01 to ss05. Hairlines are very thin, so keep it off the busiest dots and never below 32px.
- **Geist Pixel**: anything drawn *as* dots (the billboard word). A pixel face on an LED grid reads better than a bold sans or a serif, whose hairlines break up into broken dots.
- **Geist (Sans)**: note body text. Same cap height and x-height as Geist Serif, so mixing them doesn't shift the layout.
- **Geist Mono**: tiny labels only (clock, meta, dev switcher).
- Detail worth keeping from an earlier version: animate `ELSH` on the i-dots in "Vipin" (note title) when a note opens.

## Tokens (lifted from the reference shader)
Colour ramp (screen "depth" 0 to 1.75):
| Stop | Hex |
|---|---|
| warm white | #EDF6EB |
| pale blue | #A3D1ED |
| azure | #3080CC |
| deep blue | #08297A |
| navy | #030D30 |
| off-black | #010206 |
| glow pool (left edge) | #0A52B8 |
| LED lit (mint) | #D1FFE6 |

Mood tints: Name #FFF7E6 · Work #59B2FF · Books #FFB261 · Thoughts #80FFBD
Ink: dark #0B0F1A, light #F3F6FA. Sheet: bg #FFFFFF, title #1C1C1E, body #3A3A3C, secondary #8E8E93, divider #EFEFF2.

Dots:
- Cell 7 CSS px desktop, 6 under 760px, multiplied by dpr (max 2) and rounded
- Dot radius 0.41 of cell; small specular highlight offset up-left; dark gutter between dots
- Night shift: whole ramp slides darker by 0.42

Day/night (IST hours h): `night = 1 - smoothstep(5.6, 6.7, h) + smoothstep(17.6, 18.9, h)`. Press N to preview the other.

Motion:
- Easing: `cubic-bezier(.2,.8,.2,1)` for everything, `cubic-bezier(.2,.9,.2,1)` for the sheet
- Damping: `1 - exp(-dt * k)`, k = 6 default, 14 cursor follow, 7 text, 3 focus, 4 tint
- Word entrance: 10px rise + fade, 80ms stagger, starts at 450ms
- Sheet: 700ms slide; lines stagger 50ms
- Ripple: 620 px/s ring, 70px wide, decays `exp(-age * 1.4)`
- Reveal: 0 to 2 at 0.9/s, noisy 9px cells

## What to salvage from reference/02-chrome-card-page.html
Only if the feature comes back (see open decisions). Copy is in CONTENT.md.
- Multilingual welcome sequence + time-of-day line
- "Get my number" 3-step flow (UI only, `NUMBER_DEMO` flag)
- Social icon SVG paths (LinkedIn, GitHub, X, Substack, phone), the `SOC` array pattern: fill a URL and the link goes live everywhere
- IST clock logic

## History: what was tried and killed
| When | Direction | Verdict |
|---|---|---|
| Aug 2026 | Warm editorial, then green/glass Three.js strands (Sylva-inspired) | Superseded |
| Oct 2026 | Black/white Helvetica, moving artefact left, info right; green/rosé/pink accents | Superseded |
| Oct 2026 | One-page split-flap board (Vestaboard) | Parked: slows reading |
| Nov 2026 | 3D metal business card (stripe.press), garden window, seasonal duotones, Geist Serif dots morphing per section | Too colourful |
| Nov 2026 | Monochrome card over frosted foliage, fish variants | Fish killed |
| 21 Nov | Bengaluru pixel city behind the card (reference/03) | Side experiment |
| 22 Nov | Chrome card: socials, music, number flow, multilingual welcome, annotated city + hour ruler (reference/02) | "Too dull", dark in daytime |
| 22 Nov | LED dot screen, card gone, 2x2 words, Notes sheet (reference/01) | Superseded |
| 26 Nov | **Sky page + city page (reference/04, 05)** | **Current** |

Never again: fish, foliage, rusty or dull metal, a dark page in daytime, rainbow palettes, section-title banners, motion behind text while someone is reading (calm the screen when a note is open).

## Inspiration
- stripe.press (craft, detail, liveliness)
- benji.org (content tone, minimal)
- vestaboard.com/flagship (physical display feel)
- jevjobs.ai, typesafe.ai (minimal, not-internet feel)
- Apple Notes (the sheet)

## Open decisions (Claude Code: ask when you reach each one, with a recommended default)
1. Which variant ships (default: Billboard + Mood combined).
2. Do Music and "Get my number" come back? Suggested default: both as rows inside the Name note, not new words.
3. Welcome: none, or spell the multilingual greeting across the dots once on first load, then settle into the grid?
4. Education: keep folded into the Name note, or a line in Work?
5. Repo: new folder, or rebuild inside the existing Next.js portfolio repo on Vercel?
