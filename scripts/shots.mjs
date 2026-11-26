// npm run shots: expects a server on BASE (default http://localhost:3000).
// 1440x900 @1x, 1280x800 @2x, 390x844 @3x, day and night, for the dot sky and ?sky=ascii,
// plus a full page, the Work page, and /city. Logs console errors and warnings.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3000';
const out = 'shots';
mkdirSync(out, { recursive: true });
const sizes = [[1440, 900, 1], [1280, 800, 2], [390, 844, 3]];
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const errors = [];
const open = async (w, h, dpr, url) => {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`${w}x${h} ${url} ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${w}x${h} ${url} pageerror: ${e.message}`));
  await page.goto(BASE + url);
  await page.waitForTimeout(2800);
  return page;
};
for (const [w, h, dpr] of sizes) {
  for (const sky of ['dots', 'ascii']) {
    for (const theme of ['day', 'night']) {
      const tag = `${w}x${h}@${dpr}x-${sky}-${theme}`;
      const page = await open(w, h, dpr, `/?theme=${theme}${sky === 'ascii' ? '&sky=ascii' : ''}`);
      await page.screenshot({ path: `${out}/${tag}.png` });
      if (dpr === 1 || w === 390) await page.screenshot({ path: `${out}/${tag}-full.png`, fullPage: true });
      if (sky === 'dots') {
        await page.goto(`${BASE}/?theme=${theme}#work`);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${out}/${tag}-work.png` });
      }
      await page.close();
    }
  }
  const city = await open(w, h, dpr, '/city');
  await city.screenshot({ path: `${out}/${w}x${h}@${dpr}x-city.png` });
  await city.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no console errors or warnings');
