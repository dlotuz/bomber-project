// Rastreio do jogo rodando (complementa o dos testes): abre o jogo em dev com ?romtrace (a ROM real, rastreada), joga
// partidas só de CPUs em todas as arenas — com montarias, Bad Bomber, morte súbita, placar e vitória — e grava as
// faixas lidas em $SB4_TRACE/cov-play-*.json, que o build.mjs junta às dos testes. Pega o que só o desenho da partida
// alcança (animações de arena, de montaria, de vitória). Requer o Google Chrome (playwright-core, channel 'chrome').
//   SB4_ROM=<rom.sfc> SB4_TRACE=<pasta> node scripts/rom-pack/play.mjs
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const ROM = process.env.SB4_ROM, OUT = process.env.SB4_TRACE;
if (!ROM || !OUT) { console.error('use: SB4_ROM=<rom.sfc> SB4_TRACE=<pasta> node scripts/rom-pack/play.mjs'); process.exit(1); }
const PORT = Number(process.env.SNAP_PORT ?? 5189);
/** Ticks por partida (rodadas + placar + vitória); a cada bloco aperta A para passar as telas entre as rodadas. */
const TICKS = Number(process.env.PLAY_TICKS ?? 9000);
const CHUNK = 240;
const RENDER_EVERY = Number(process.env.PLAY_RENDER_EVERY ?? 3);
const BTN_A = 16;

// o Vite serve a ROM só durante o rastreio, de uma pasta ignorada pelo git (.rom/ e *.sfc)
const romDir = `${root}.rom`;
mkdirSync(romDir, { recursive: true });
copyFileSync(ROM, `${romDir}/sb4.sfc`);
const server = spawn(process.execPath, [`${root}node_modules/vite/bin/vite.js`, '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = `http://localhost:${PORT}/`;

async function waitServer() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(base); if (r.ok) return; } catch { /* ainda subindo */ }
    await sleep(250);
  }
  throw new Error('vite não subiu');
}

/** Variações por arena: regras diferentes alcançam partes diferentes (Bad Bomber, morte súbita, times, corrida). */
const VARIANTS = [
  'players=5&level=2&matches=2&time=0&bad=1',
  'players=4&level=1&matches=1&time=0&sd=1&mode=team',
  'players=3&level=0&matches=1&time=0&racer=1',
];

let browser;
try {
  await waitServer();
  browser = await chromium.launch({ channel: 'chrome' });
  mkdirSync(OUT, { recursive: true });
  for (let stage = 1; stage <= 10; stage++) {
    for (const [vi, variant] of VARIANTS.entries()) {
      const page = await (await browser.newContext({ viewport: { width: 512, height: 448 } })).newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(`${base}?debug&quick&humans=0&stage=${stage}&${variant}&seed=${stage * 7 + vi}&romtrace=/.rom/sb4.sfc`);
      await page.waitForFunction(() => window.__crown?.rom.status === 'ok', null, { timeout: 30000 });
      await page.evaluate(() => window.__crown.hold(true));
      // desenha a cada RENDER_EVERY ticks (step(n) roda n ticks e desenha 1 quadro): as animações duram vários ticks
      for (let t = 0; t < TICKS; t += CHUNK) {
        await page.evaluate(([n, a, r]) => { window.__crown.step(r, a, 0); for (let k = r; k < n; k += r) window.__crown.step(r); }, [CHUNK, BTN_A, RENDER_EVERY]);
      }
      const ranges = await page.evaluate(() => window.__crown.romRanges());
      const bytes = ranges.reduce((s, [a, b]) => s + b - a, 0);
      writeFileSync(`${OUT}/cov-play-${stage}-${vi}.json`, JSON.stringify({ test: `play:${stage}:${variant}`, ranges }));
      console.log(`arena ${stage} (${variant}): ${bytes} bytes lidos${errors.length ? `, erros: ${[...new Set(errors)].join(' | ')}` : ''}`);
      await page.context().close();
    }
  }
} finally {
  try { await browser?.close(); } finally { server.kill(); rmSync(romDir, { recursive: true, force: true }); }
}
