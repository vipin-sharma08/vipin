// npm run og: renders the live page at 1200x630 into public/og.png
import { chromium } from '@playwright/test';
const BASE = process.env.BASE || 'http://localhost:3000';
const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.goto(`${BASE}/?theme=day`);
await p.waitForTimeout(3500);
await p.screenshot({ path: 'public/og.png' });
await b.close();
console.log('public/og.png');
