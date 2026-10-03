// Screenshots do fluxo inteiro (plano 10, T22). Requer o Google Chrome instalado (playwright-core usa channel 'chrome',
// não baixa o Chromium). Uma passada, `rom/`: os gráficos e o som vêm do pacote embutido (public/rom-pack.dat,
// rom/pack.ts), sem ROM do usuário. Saída: $SNAP_OUT (padrão
// web/snapshots/, fora do git). Os quadros exatos (f100 do "BATALHA!", f5/f20 do intro, S = 60/200/…) saem do gancho
// `__crown.hold/step` do main.ts (só em dev com ?debug), que para o relógio do loop e avança tick a tick.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.env.SNAP_OUT ?? `${root}snapshots`;
const PORT = Number(process.env.SNAP_PORT ?? 5188);
const BTN = { UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8, A: 16, B: 32, START: 128 };
// pelo próprio Node (no Windows, spawn('npx') falha sem shell)
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

/** Uma página com os ajudantes da passada (espera o pacote embutido carregar). */
async function session(browser, pass) {
  const dir = `${OUT}/${pass}`;
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 768, height: 672 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });

  const h = {
    page, errors,
    async open(query) {
      // Capturas fiéis por padrão (?fx=0); o cenário `effects` liga os efeitos com fx=1.
      await page.goto(`${base}?debug&${query}${query.includes('fx=') ? '' : '&fx=0'}`);
      await page.waitForFunction(() => !!window.__crown);
      await page.waitForFunction(() => window.__crown.rom.status === 'ok' || window.__crown.rom.status === 'erro', null, { timeout: 30000 });
      const st = await page.evaluate(() => [window.__crown.rom.status, window.__crown.rom.erro]);
      if (st[0] !== 'ok') throw new Error(`pacote da ROM não carregou: ${st[1]}`);
      await page.evaluate(() => window.__crown.hold(true));
    },
    step: (n = 1, btn = 0, slot = 0) => page.evaluate(([n, b, s]) => window.__crown.step(n, b, s), [n, btn, slot]),
    /** Aperta (1 tick) e solta (1 tick). */
    press: (btn, slot = 0) => h.step(2, btn, slot),
    id: () => page.evaluate(() => window.__crown.app.screen.id),
    /** Avança até a tela `id` existir e a transição acabar; devolve quantos ticks a tela nova já rodou. */
    async until(id, max = 6000) {
      const n = await page.evaluate(([id, max]) => {
        const c = window.__crown; let n = 0, since = 0;
        while (n < max && !(c.app.screen.id === id && !c.app.inTransition)) {
          c.step(1); n++; since = c.app.screen.id === id ? since + 1 : 0;
        }
        return c.app.screen.id === id ? since : -1;
      }, [id, max]);
      if (n < 0) throw new Error(`não chegou na tela ${id} (está em ${await h.id()})`);
      return n;
    },
    /** Avança até `pred(window.__crown)` (texto de função) ser verdade. */
    async stepUntil(pred, max = 6000) {
      const ok = await page.evaluate(([src, max]) => {
        const f = new Function('c', `return (${src})(c);`);
        const c = window.__crown;
        for (let n = 0; n < max; n++) { if (f(c)) return true; c.step(1); }
        return f(c);
      }, [pred.toString(), max]);
      if (!ok) throw new Error(`condição não aconteceu: ${pred}`);
    },
    async shot(name) {
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
      await page.locator('#screen').screenshot({ path: `${dir}/${name}.png` });
      console.log(`  ${pass}/${name}`);
    },
    close: () => context.close(),
  };
  return h;
}

async function menusAndMatch(h) {
  // Título → VS com o teclado de verdade (Teclado 1: J = A); o resto tick a tick.
  await h.open('reset');
  await h.step(40); await h.shot('01-title');
  await h.page.evaluate(() => window.__crown.hold(false));
  await h.page.keyboard.down('KeyJ'); await sleep(80); await h.page.keyboard.up('KeyJ');
  await h.page.waitForFunction(() => window.__crown.app.screen.id === 'vs', null, { timeout: 10000 });
  await h.page.evaluate(() => window.__crown.hold(true));
  await h.until('vs'); await h.step(10); await h.shot('02-vs');
  await h.press(BTN.A); await h.until('mode'); await h.step(10); await h.shot('03-mode');
  await h.press(BTN.A); await h.until('players'); await h.step(10); await h.shot('04-players');
  await h.press(BTN.A); await h.until('rules'); await h.step(10);
  // Coroas 3 → 1 e Corrida Bônus: Sim (para o placar final, a vitória e a corrida na mesma partida).
  await h.press(BTN.DOWN); await h.press(BTN.LEFT); await h.press(BTN.LEFT);
  for (let k = 0; k < 4; k++) await h.press(BTN.DOWN);
  await h.press(BTN.RIGHT);
  if (!(await h.page.evaluate(() => window.__crown.app.settings.setup.rules.racer))) await h.press(BTN.LEFT);
  await h.step(10); await h.shot('05-rules');
  await h.press(BTN.A); await h.until('characters'); await h.step(10); await h.shot('06-characters');
  await h.press(BTN.RIGHT, 1); await h.press(BTN.A, 1); await h.step(10); await h.shot('07-characters-2p-pronto');
  for (let k = 0; k < 4; k++) await h.press(BTN.A, 0);
  await h.until('stage'); await h.step(10); await h.shot('08-stage-1');
  for (let k = 0; k < 7; k++) { await h.press(BTN.RIGHT); await h.step(30); }
  await h.shot('09-stage-8');
  for (let k = 0; k < 7; k++) { await h.press(BTN.LEFT); await h.step(30); }
  await h.step(1, BTN.A); await h.step(99); await h.shot('10-stage-batalha-f100');
  await h.until('battle', 2000);
  await h.page.evaluate(() => { const c = window.__crown; while (c.app.inTransition || c.ms.round.tick < 5) c.step(1); });
  await h.shot('11-intro-f5');
  await h.page.evaluate(() => { const c = window.__crown; while (c.ms.round.tick < 20) c.step(1); });
  await h.shot('12-intro-f20');
  await h.stepUntil(c => c.ms.round.phase !== 'intro');
  await h.step(360); await h.shot('13-battle');
  await h.step(1, BTN.START); await h.step(3); await h.shot('14-pause');
  await h.step(1, BTN.START); await h.step(1);
  await h.page.evaluate(() => { window.__crown.ms.round.clock.sec = 62; window.__crown.ms.round.clock.sub = 1; });
  await h.stepUntil(c => c.app.screen.banners().hurry !== null, 300);
  await h.step(24); await h.shot('15-rapido');
  await h.stepUntil(c => c.app.screen.banners().hurry === null, 600);
  await h.page.evaluate(() => { window.__crown.ms.round.clock.sec = 1; window.__crown.ms.round.clock.sub = 1; });
  await h.stepUntil(c => c.app.screen.banners().timeUp !== null, 300);
  await h.step(30); await h.shot('16-tempo-esgotado');
  await h.stepUntil(c => c.app.screen.id === 'draw', 2000);
  await h.step(60); await h.shot('17-empate-s60');
  await h.step(240); await h.shot('18-empate-s300');
  await h.press(BTN.A); await h.until('battle', 2000);
  await h.stepUntil(c => c.ms.round.phase !== 'intro');
  await h.page.evaluate(() => { window.__crown.ms.round.players.forEach((p, i) => { if (p.present && i !== 0) p.state = 'out'; }); });
  await h.stepUntil(c => c.app.screen.id === 'scoreboard', 2000);
  await h.step(60); await h.shot('19-placar-s60');
  await h.step(140); await h.shot('20-placar-s200');
  await h.step(400); await h.shot('21-placar-final-s600-descida');
  await h.stepUntil(c => c.app.screen.id === 'victory', 3000);
  await h.step(800); await h.shot('22-vitoria-s800');
  await h.press(BTN.A); await h.until('racer', 2000); await h.step(120); await h.shot('23-corrida');
}

async function teams(h) {
  await h.open('reset');
  await h.step(40);
  await h.press(BTN.A); await h.until('vs');
  await h.press(BTN.A); await h.until('mode');
  await h.press(BTN.DOWN); await h.press(BTN.A); await h.until('players');
  await h.press(BTN.A); await h.until('rules');
  await h.press(BTN.A); await h.until('characters');
  await h.press(BTN.A, 1); for (let k = 0; k < 4; k++) await h.press(BTN.A, 0);
  await h.until('teams'); await h.step(10); await h.shot('24-equipes');
}

async function options(h) {
  await h.open('reset');
  await h.step(40);
  await h.press(BTN.DOWN); await h.press(BTN.A); await h.until('options'); await h.step(10); await h.shot('25-opcoes');
  for (let k = 0; k < 5; k++) await h.press(BTN.DOWN);
  await h.press(BTN.A); await h.until('remap'); await h.step(10); await h.shot('26-remapeamento');
  await h.press(BTN.A); await h.step(10); await h.shot('27-remapeamento-captura');
}

async function arenas(h) {
  for (const stage of [1, 3, 5, 8, 10]) {
    await h.open(`quick&seed=3&players=5&humans=0&level=1&stage=${stage}`);
    await h.stepUntil(c => c.ms.round.phase !== 'intro');
    await h.step(600);
    await h.shot(`28-arena-${String(stage).padStart(2, '0')}`);
  }
}

/** Efeitos visuais ligados (spec 2026-10-01): partida de CPUs até haver chama na arena e logo depois de um acerto. */
async function effects(h) {
  for (const stage of [1, 4, 9]) {
    await h.open(`quick&fx=1&seed=5&players=5&humans=0&level=1&stage=${stage}`);
    await h.stepUntil(c => c.ms.round.phase !== 'intro');
    await h.stepUntil(c => c.ms.round.grid.filter(v => v === 0x1000).length >= 5, 3000);
    await h.step(2);
    await h.shot(`29-fx-explosao-${String(stage).padStart(2, '0')}`);
    await h.step(8);
    await h.shot(`29-fx-explosao-${String(stage).padStart(2, '0')}-b`);
  }
  // Bombas na cor de cada jogador: várias bombas paradas na arena.
  await h.open('quick&fx=1&seed=5&players=5&humans=0&level=1&stage=1');
  await h.stepUntil(c => c.ms.round.bombs.filter(b => b.state === 'idle').length >= 3, 3000);
  await h.shot('30-fx-bombas-cor');
}

// SNAP_ONLY=effects,arenas roda só esses cenários.
const ONLY = process.env.SNAP_ONLY?.split(',') ?? null;
let browser;
try {
  await waitServer();
  browser = await chromium.launch({ channel: 'chrome' });
  for (const pass of ['rom']) {
    console.log(`passada ${pass}:`);
    for (const scenario of [menusAndMatch, teams, options, arenas, effects].filter(s => !ONLY || ONLY.includes(s.name))) {
      const h = await session(browser, pass);
      try { await scenario(h); }
      catch (e) { console.error(`  FALHOU ${scenario.name}: ${e.message}`); process.exitCode = 1; }
      finally {
        const errs = h.errors.filter(e => !/Download the React DevTools|\[vite\]/.test(e));
        if (errs.length) console.log(`  avisos/erros no console (${scenario.name}):\n    ${[...new Set(errs)].join('\n    ')}`);
        await h.close();
      }
    }
  }
} finally {
  try { await browser?.close(); } finally { server.kill(); }
}
console.log(`screenshots em ${OUT}`);
