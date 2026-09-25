// Abre o jogo no Chrome instalado, joga alguns frames e salva screenshots em web/snapshots/.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}snapshots`;
mkdirSync(out, { recursive: true });
const PORT = 5188;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return; } catch { /* ainda subindo */ }
    await sleep(250);
  }
  throw new Error('vite não subiu');
}

let browser;
try {
  await waitServer();
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 768, height: 672 } });
  const shot = name => page.screenshot({ path: `${out}/${name}.png` });
  const tap = async code => { await page.keyboard.down(code); await sleep(60); await page.keyboard.up(code); await sleep(60); };
  const hold = async (code, ms) => { await page.keyboard.down(code); await sleep(ms); await page.keyboard.up(code); };

  await page.goto(`http://localhost:${PORT}/?seed=7&players=5&matches=1&spawns=0&debug=1`);
  await sleep(400); await shot('01-title');
  await tap('Enter'); await sleep(500); await shot('02-intro');
  await sleep(1200);
  await hold('KeyD', 250); await tap('KeyJ'); await hold('KeyA', 250); await hold('KeyS', 300);
  await sleep(300); await shot('03-battle');
  await page.waitForFunction(() => window.__crown.session.round.arena.flame.some(f => f > 20), null, { timeout: 5000 });
  await shot('04-explosion');
  await page.evaluate(() => { window.__crown.session.round.players.forEach((p, i) => { if (i !== 2) p.alive = false; }); });
  await sleep(400); await shot('05-round-over');
  await sleep(2600); await shot('06-scoreboard');
  await sleep(9200); await shot('07-victory');

  for (const stage of [5, 8]) {
    await page.goto(`http://localhost:${PORT}/?seed=3&players=5&stage=${stage}&debug=1`);
    await sleep(300); await tap('Enter'); await sleep(2000);
    await shot(stage === 5 ? '08-stage5' : '09-stage8');
  }
} finally {
  try {
    await browser?.close();
  } finally {
    server.kill();
  }
}
console.log(`screenshots em ${out}`);
