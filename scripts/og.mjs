// npm run og: renders the live screen at 1200x630 into public/og.png
import { chromium } from '@playwright/test';
const BASE = process.env.BASE || 'http://localhost:3000';
const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.goto(`${BASE}/?gui=0&night=0`);
await p.waitForTimeout(3500);
await p.screenshot({ path: 'public/og.png' });
await b.close();
console.log('public/og.png');
