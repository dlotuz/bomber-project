// Requer o Google Chrome instalado (playwright-core usa channel 'chrome', não baixa o Chromium).
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

  const base = `http://localhost:${PORT}/`;
  const waitScreen = id => page.waitForFunction(i => window.__crown.app.screen.id === i, id, { timeout: 15000 });

  // 1) Fluxo de menus (configurações zeradas: cada página abre com localStorage vazio)
  await page.goto(`${base}?debug=1`);
  await sleep(400); await shot('01-title');
  await tap('Enter'); await waitScreen('vs'); await shot('02-vs');
  await tap('Enter'); await waitScreen('mode'); await shot('03-mode');
  await tap('Enter'); await waitScreen('players'); await shot('04-players');
  await tap('Enter'); await waitScreen('rules'); await shot('05-rules');
  await tap('Enter'); await waitScreen('characters');
  await tap('KeyD'); await tap('ArrowDown'); await sleep(150); await shot('06-characters');
  await tap('KeyJ'); await tap('Numpad1'); await sleep(150); await shot('07-characters-ready');
  await tap('Enter'); await waitScreen('stage');
  await tap('KeyD'); await sleep(150); await shot('08-stage');
  await tap('Enter'); await sleep(200); await shot('09-battle-start');
  await waitScreen('battle'); await sleep(900); await shot('10-intro');

  // 2) Partida rápida (?quick): batalha, explosão, fim de rodada, placar, vitória e volta à fase
  await page.goto(`${base}?quick&seed=7&players=5&matches=1&spawns=0&debug=1`);
  await sleep(1700);
  await hold('KeyD', 250); await tap('KeyJ'); await hold('KeyA', 250); await hold('KeyS', 300);
  await sleep(300); await shot('11-battle');
  await page.waitForFunction(() => window.__crown.session.round.arena.flame.some(f => f > 20), null, { timeout: 5000 });
  await shot('12-explosion');
  await tap('Enter'); await sleep(150); await shot('13-pause');
  await tap('Enter');
  await page.evaluate(() => { window.__crown.session.round.players.forEach((p, i) => { if (i !== 2) p.alive = false; }); });
  await sleep(400); await shot('14-round-over');
  await page.waitForFunction(() => window.__crown.session?.phase === 'scoreboard', null, { timeout: 15000 });
  await sleep(300); await shot('15-scoreboard');
  await page.waitForFunction(() => window.__crown.session?.phase === 'victory', null, { timeout: 15000 });
  await sleep(1300); await shot('16-victory');
  await tap('Enter'); await waitScreen('stage'); await shot('17-back-to-stage');

  // 3) Configurações e nomes
  await page.goto(`${base}?debug=1`);
  await sleep(300); await tap('KeyS'); await tap('Enter'); await waitScreen('settings'); await shot('18-settings');
  for (let k = 0; k < 5; k++) await tap('KeyS');
  await tap('Enter'); await waitScreen('names');
  await tap('Enter'); for (let k = 0; k < 3; k++) await tap('KeyW');
  await sleep(100); await shot('19-name-edit');

  // 4) Partida só de CPUs (IA nível normal)
  await page.goto(`${base}?quick&seed=11&players=5&humans=0&level=1&debug=1`);
  await sleep(9000); await shot('22-cpu-match');

  // 5) Outras arenas
  for (const stage of [5, 8]) {
    await page.goto(`${base}?quick&seed=3&players=5&stage=${stage}&debug=1`);
    await sleep(2000);
    await shot(stage === 5 ? '20-stage5' : '21-stage8');
  }
} finally {
  try {
    await browser?.close();
  } finally {
    server.kill();
  }
}
console.log(`screenshots em ${out}`);
