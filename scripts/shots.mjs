// npm run shots: builds nothing, expects a server on BASE (default http://localhost:3000).
// 1440x900 @1x, 1280x800 @2x, 390x844 @3x, each for day and ?night=1, plus a note open. Logs console errors.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3000';
const out = 'shots';
mkdirSync(out, { recursive: true });
const sizes = [[1440, 900, 1], [1280, 800, 2], [390, 844, 3]];
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h, dpr] of sizes) {
  for (const night of [false, true]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`${w}x${h} ${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${w}x${h} pageerror: ${e.message}`));
    const tag = `${w}x${h}@${dpr}x-${night ? 'night' : 'day'}`;
    await page.goto(`${BASE}/?gui=0${night ? '&night=1' : '&night=0'}`);
    await page.waitForTimeout(3200);
    await page.screenshot({ path: `${out}/${tag}.png` });
    if (w > 760) {
      await page.hover('[data-word=name]');
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${out}/${tag}-hover.png` });
    }
    await page.click('[data-word=name]');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/${tag}-note.png` });
    if (!night && w === 1440) console.log('backend:', await page.getAttribute('canvas', 'data-backend'));
    await page.close();
  }
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no console errors or warnings');
