// Gera o pacote de arte HD provisório em web/public/arte-hd/provisorio/ (PNG + pacote.json).
//
// Por que pelo Chrome: os desenhos usam a API Canvas 2D (gradientes, curvas, contornos) e o Node não tem canvas sem
// uma dependência nova. O projeto já usa playwright-core + o Google Chrome instalado (scripts/snapshots.mjs), então o
// script sobe o Vite em memória, abre o Chrome sem janela, importa `src/render/hdart/placeholder.ts` na página e
// devolve cada folha como PNG. Nada é baixado nem instalado.
//
// Uso (na pasta web/):
//   node scripts/arte-hd/provisorio/gerar.ts                 # grava o pacote
//   node scripts/arte-hd/provisorio/gerar.ts --folha <pasta> # também grava folha-provisorio.{html,png} em <pasta>
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { folhaHtml } from './folha.ts';

const WEB = fileURLToPath(new URL('../../../', import.meta.url));
const OUT = join(WEB, 'public/arte-hd/provisorio');
const folhaIdx = process.argv.indexOf('--folha');
const FOLHA = folhaIdx > 0 ? resolve(process.argv[folhaIdx + 1]) : null;

const server = await createServer({ root: WEB, logLevel: 'error', server: { port: 5191, strictPort: false } });
await server.listen();
const base = server.resolvedUrls?.local[0] ?? 'http://localhost:5191/';
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  await page.route(`${base}__gerar.html`, r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8">' }));
  await page.goto(`${base}__gerar.html`);
  const res = await page.evaluate(async () => {
    const mod = '/src/render/hdart/placeholder.ts';
    const m = await import(/* @vite-ignore */ mod);
    const { manifest, sheets } = m.buildPlaceholder();
    const files: Record<string, string> = {};
    for (const s of sheets) {
      const cv = document.createElement('canvas');
      cv.width = s.w; cv.height = s.h;
      m.paintSheet(s, cv.getContext('2d'));
      files[s.file] = cv.toDataURL('image/png').split(',')[1];
    }
    return { manifest, files };
  });

  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (f.endsWith('.png')) rmSync(join(OUT, f));
  for (const [file, b64] of Object.entries(res.files)) writeFileSync(join(OUT, file), Buffer.from(b64, 'base64'));
  writeFileSync(join(OUT, 'pacote.json'), `${JSON.stringify(res.manifest, null, 1)}\n`);
  console.log(`pacote: ${Object.keys(res.files).length} imagens, ${Object.keys(res.manifest.anims).length} animações → ${OUT}`);

  if (FOLHA) {
    mkdirSync(FOLHA, { recursive: true });
    const html = join(FOLHA, 'folha-provisorio.html');
    writeFileSync(html, folhaHtml(res.manifest, pathToFileURL(OUT + '/').href));
    const p2 = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
    await p2.goto(pathToFileURL(html).href);
    await p2.waitForFunction(() => (window as unknown as { pronto?: boolean }).pronto === true);
    await p2.screenshot({ path: join(FOLHA, 'folha-provisorio.png'), fullPage: true });
    // recortes por seção, para conferir de perto
    const secs = await p2.evaluate(() => [...document.querySelectorAll('section')].map(s => {
      const r = s.getBoundingClientRect();
      return { id: s.id, x: r.x, y: r.y + window.scrollY, w: r.width, h: r.height };
    }));
    for (const s of secs) {
      await p2.screenshot({ path: join(FOLHA, `folha-provisorio-${s.id}.png`), fullPage: true, clip: { x: s.x, y: s.y, width: s.w, height: s.h } });
    }
    console.log(`folha: ${html} (+ png)`);
  }
} finally {
  await browser.close();
  await server.close();
}
