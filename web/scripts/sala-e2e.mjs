// Teste de ponta a ponta da sala online, em navegadores reais (Chrome via playwright-core): sobe o servidor da sala
// (precisa de web/dist: npm run build), um jogador cria a sala, outro entra pelo link, o anfitrião inicia com CPUs, os
// dois apertam teclas e o script confere que as duas partidas andam juntas e com o mesmo estado (hash) a cada 120 ticks.
//   node scripts/sala-e2e.mjs   (SALA_E2E_SECONDS, padrão 25; SALA_URL=<url> testa uma sala já no ar, ex. o túnel)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8791, SECONDS = Number(process.env.SALA_E2E_SECONDS ?? 25);
const base = process.env.SALA_URL ? process.env.SALA_URL.replace(/\/?$/, '/') : `http://localhost:${PORT}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = process.env.SALA_URL ? null : spawn(process.execPath, [`${root}server/sala.mjs`], { cwd: root, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), SALA_DIST: process.env.SALA_DIST ?? `${root}dist` } });
let browser, failed = false;
const fail = msg => { console.error(`FALHOU: ${msg}`); failed = true; };
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch { /* subindo */ } await sleep(250); }
  browser = await chromium.launch({ channel: 'chrome' });
  const open = async name => {
    const page = await (await browser.newContext({ viewport: { width: 800, height: 700 } })).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    return { page, errors, name };
  };
  const A = await open('anfitrião'), B = await open('convidado');
  // tudo pela tela da sala no jogo, com as teclas do jogador 1 (W/S = cima/baixo, J = A) e digitando nome e código
  const key = async (p, k, n = 1) => { for (let i = 0; i < n; i++) { await p.page.keyboard.down(k); await sleep(70); await p.page.keyboard.up(k); await sleep(70); } };
  const typeEntry = async (p, text) => { await key(p, 'KeyJ'); await sleep(150); await p.page.keyboard.type(text); await p.page.keyboard.press('Enter'); await sleep(200); };
  const onScreen = p => p.page.waitForFunction(() => window.__sala?.screen === 'online', null, { timeout: 20000 });
  await A.page.goto(`${base}?sala`);
  await onScreen(A); await sleep(800);
  await typeEntry(A, 'Ana');                       // NOME
  await key(A, 'KeyS'); await key(A, 'KeyJ');       // CRIAR SALA
  await A.page.waitForFunction(() => window.__sala?.code, null, { timeout: 15000 });
  const code = await A.page.evaluate(() => window.__sala.code);
  console.log(`sala ${code}`);
  await B.page.goto(`${base}?sala=${code}`);
  await onScreen(B); await sleep(800);
  await key(B, 'KeyW', 3); await typeEntry(B, 'Beto');   // o convite abre no CÓDIGO: sobe ao NOME
  await key(B, 'KeyS', 4); await key(B, 'KeyJ');         // ENTRAR NA SALA
  await B.page.waitForFunction(() => window.__sala?.code, null, { timeout: 15000 });
  await sleep(1500);                                     // pacote de gráficos e ping dos dois
  await key(A, 'KeyW', 3); await key(A, 'KeyJ');         // da própria vaga, ↑↑↑ dá a volta até INICIAR PARTIDA
  await Promise.all([A, B].map(p => p.page.waitForFunction(() => window.__sala.tick > 10, null, { timeout: 15000 })));
  // os dois apertam teclas do jogador 1 (WASD + J = bomba) durante a partida
  const keys = ['KeyD', 'KeyS', 'KeyJ', 'KeyA', 'KeyW', 'KeyJ'];
  const t0 = Date.now();
  let n = 0, maxTick = 0, ended = false;
  while (Date.now() - t0 < SECONDS * 1000 && !ended) {
    const now = await A.page.evaluate(() => [window.__sala.tick, window.__sala.screen]);
    if (now[0] < 0 && maxTick > 0) ended = true;   // a partida acabou (vitória → volta para a sala)
    maxTick = Math.max(maxTick, now[0]);
    for (const p of [A, B]) { const k = keys[(n + (p === B ? 3 : 0)) % keys.length]; await p.page.keyboard.down(k); }
    await sleep(180);
    for (const p of [A, B]) { const k = keys[(n + (p === B ? 3 : 0)) % keys.length]; await p.page.keyboard.up(k); }
    n++;
  }
  const st = await Promise.all([A, B].map(p => p.page.evaluate(() => ({ tick: window.__sala.tick, screen: window.__sala.screen, desync: window.__sala.desync, hashes: window.__sala.hashes, msg: document.querySelector('.sala .msg')?.textContent ?? '' }))));
  for (const [i, s] of st.entries()) if (s.msg) console.log(`painel do ${[A, B][i].name}: ${s.msg}`);
  console.log(`anfitrião: tick ${st[0].tick} (${st[0].screen})  convidado: tick ${st[1].tick} (${st[1].screen})`);
  const secs = (Date.now() - t0) / 1000;
  console.log(`${maxTick} ticks em ${secs.toFixed(1)}s${ended ? ' (a partida terminou e voltou para a sala)' : ''}`);
  if (maxTick < 60 * secs * 0.5) fail(`a partida andou pouco (${maxTick} ticks em ${secs.toFixed(1)}s)`);
  if (!ended && Math.abs(st[0].tick - st[1].tick) > 30) fail('os dois navegadores ficaram muito afastados');
  if (st[0].desync || st[1].desync) fail(`dessincronizou: ${st[0].desync ?? st[1].desync}`);
  const common = st[0].hashes.filter(k => st[1].hashes.includes(k));
  let same = 0;
  for (const k of common) {
    const [ha, hb] = await Promise.all([A, B].map(p => p.page.evaluate(k => window.__sala.hash(k), k)));
    if (ha !== hb) fail(`estado diferente no tick ${k}`); else same++;
  }
  console.log(`${same} conferências de estado iguais`);
  if (!same) fail('nenhuma conferência de estado em comum');
  for (const p of [A, B]) if (p.errors.length) fail(`erros na página do ${p.name}: ${[...new Set(p.errors)].join(' | ')}`);
  // o convidado fecha a aba no meio da partida: a CPU assume a vaga e o anfitrião continua sem travar
  if (!ended) {
    const before = await A.page.evaluate(() => window.__sala.tick);
    await B.page.context().close();
    await sleep(4000);
    const after = await A.page.evaluate(() => [window.__sala.tick, window.__sala.screen]);
    console.log(`convidado saiu: anfitrião foi do tick ${before} ao ${after[0]} (${after[1]})`);
    if (after[0] >= 0 && after[0] - before < 120) fail('o anfitrião travou depois que o convidado saiu');
  }
} catch (e) {
  fail(e.message);
} finally {
  try { await browser?.close(); } finally { server?.kill(); }
}
console.log(failed ? 'sala-e2e: FALHOU' : 'sala-e2e: ok');
process.exit(failed ? 1 : 0);
