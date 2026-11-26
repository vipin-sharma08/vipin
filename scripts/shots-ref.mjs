// Parity targets: reference/01 at desktop and phone, day and night, note open, each variant.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve('reference/shots');
mkdirSync(out, { recursive: true });
const url = 'file://' + resolve('reference/01-dot-screen-variants.html');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
for (const [w, h, tag] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  for (const night of [false, true]) {
    for (const v of [1, 2, 3, 4]) {
      await page.goto(url + '#' + v);
      await page.waitForTimeout(2600);
      if (night) await page.keyboard.press('n');
      await page.mouse.move(w * 0.25, h * 0.25);
      await page.waitForTimeout(900);
      const t = night ? 'night' : 'day';
      await page.screenshot({ path: `${out}/${tag}-${t}-v${v}-hover.png` });
      if (v === 1) {
        await page.click('.w[data-k=name]');
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${out}/${tag}-${t}-note.png` });
      }
    }
  }
  await page.close();
}
await browser.close();
console.log('saved to', out);
