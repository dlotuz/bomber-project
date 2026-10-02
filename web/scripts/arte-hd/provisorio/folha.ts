// Folha de contato do pacote provisório: uma página HTML que lê o manifesto e as imagens do pacote (como o jogo
// leria) e mostra todos os quadros em tamanho real, com o ponto de apoio marcado, mais uma mini-arena por fase
// montada pelos pontos de apoio (confere que piso, blocos, bomba, chama e personagem se encaixam na casa).
import type { HdManifest } from '../../../src/render/hdart/types.ts';

export function folhaHtml(manifest: HdManifest, imgBase: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Folha — pacote provisório</title>
<style>
  body { margin: 0; padding: 16px; background: #23252c; color: #e8e8ee; font: 14px/1.3 system-ui, sans-serif; }
  h1 { font-size: 22px; margin: 0 0 12px; } h2 { font-size: 17px; margin: 18px 0 8px; } h3 { font-size: 14px; margin: 10px 0 4px; color: #b9bccb; }
  section { padding: 8px 12px 16px; margin-bottom: 12px; background: #2c2f38; border-radius: 8px; }
  .row { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
  .grp { display: flex; flex-direction: column; gap: 3px; }
  .grp small { color: #9ea2b3; font-size: 11px; }
  canvas.t { background: repeating-conic-gradient(#5a6070 0 25%, #4c5262 0 50%) 0 0 / 16px 16px; }
  .arena { display: flex; gap: 14px; align-items: flex-start; }
</style></head><body>
<h1>${manifest.name} — cell ${manifest.cell} px · ${Object.keys(manifest.anims).length} animações</h1>
<div id="root"></div>
<script>
const M = ${JSON.stringify(manifest)};
const BASE = ${JSON.stringify(imgBase)};
const IMG = {};
const root = document.getElementById('root');
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, attrs); kids.forEach(k => e.append(k)); return e; };

function drawFrame(g, f, x, y) {   // x, y = ponto do jogo
  g.drawImage(IMG[f.img], f.rect[0], f.rect[1], f.rect[2], f.rect[3], x - f.anchor[0], y - f.anchor[1], f.rect[2], f.rect[3]);
}
function animGroup(key, mark = true) {
  const a = M.anims[key];
  const w = a.frames.reduce((s, f) => s + f.rect[2] + 4, -4), h = Math.max(...a.frames.map(f => f.rect[3]));
  const cv = el('canvas', { width: w, height: h, className: 't' });
  const g = cv.getContext('2d');
  let x = 0;
  for (const f of a.frames) {
    g.drawImage(IMG[f.img], f.rect[0], f.rect[1], f.rect[2], f.rect[3], x, 0, f.rect[2], f.rect[3]);
    if (mark) { g.fillStyle = '#ff2bd6'; g.fillRect(x + f.anchor[0] - 2, f.anchor[1] - 2, 4, 4); }
    x += f.rect[2] + 4;
  }
  return el('div', { className: 'grp' }, cv, el('small', { textContent: key + '  [' + a.ticks.join(',') + ']' + (a.loop ? ' ↻' : '') }));
}
function miniArena(n) {
  const C = M.cell, W = 9, H = 7;
  const cv = el('canvas', { width: W * C, height: H * C });
  const g = cv.getContext('2d');
  const at = (k, i = 0) => M.anims[k].frames[Math.min(i, M.anims[k].frames.length - 1)];
  const cx = c => c * C + C / 2;
  const grid = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let t = (x + y) % 2 ? 'floorAlt' : 'floor';
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) t = 'wall';
    else if (x % 2 === 0 && y % 2 === 0) t = 'hard';
    else if ((x === 1 && y === 2) || (x === 7 && y === 3) || (x === 3 && y === 5) || (x === 7 && y === 4)) t = 'soft';
    else if (x === 1 && y === 5) t = 'pressure';
    grid.push([x, y, t]);
  }
  for (const [x, y, t] of grid) drawFrame(g, at('stage/' + n + '/' + t), cx(x), cx(y));
  drawFrame(g, at('stage/' + n + '/burning', 1), cx(7), cx(1));
  drawFrame(g, at('item/03'), cx(3), cx(1));
  drawFrame(g, at('egg/' + ['a', 'c', 'd', 'e', 'f', '2', '3', '9', 'b', '1'][n - 1]), cx(1), cx(4));
  drawFrame(g, at('bomb/' + ((n - 1) % 3)), cx(1), cx(3));
  const fl = [[5, 3, 'center'], [4, 3, 'h'], [3, 3, 'left'], [6, 3, 'right'], [5, 2, 'v'], [5, 1, 'up'], [5, 4, 'v'], [5, 5, 'down']];
  for (const [x, y, p] of fl) drawFrame(g, at('flame/' + p, 1), cx(x), cx(y));
  const ch = (n - 1) % 6, other = n % 6;
  drawFrame(g, at('char/' + ch + '/walk/right', 1), cx(2) + 10, cx(1));
  drawFrame(g, at('char/' + other + '/idle/down'), cx(6), cx(5));
  return cv;
}
async function main() {
  await Promise.all(Object.entries(M.images).map(([k, f]) => new Promise((ok, no) => {
    const im = new Image(); im.onload = () => { IMG[k] = im; ok(); }; im.onerror = no; im.src = BASE + f;
  })));
  const keys = Object.keys(M.anims);
  const ar = el('section', { id: 'arenas' }, el('h2', { textContent: 'Arenas (mini-arena montada pelos pontos de apoio + peças)' }));
  for (let n = 1; n <= 10; n++) {
    const tiles = el('div', { className: 'row' }, ...keys.filter(k => k.startsWith('stage/' + n + '/')).map(k => animGroup(k, false)));
    ar.append(el('h3', { textContent: 'Fase ' + n }), el('div', { className: 'arena' }, miniArena(n), tiles));
  }
  root.append(ar);
  const ob = el('section', { id: 'objetos' }, el('h2', { textContent: 'Bombas, chamas, itens e ovos' }));
  for (const pre of ['bomb/', 'flame/', 'item/', 'egg/']) ob.append(el('div', { className: 'row' }, ...keys.filter(k => k.startsWith(pre)).map(k => animGroup(k))), el('div', { style: 'height:10px' }));
  root.append(ob);
  const chars = [...new Set(keys.filter(k => k.startsWith('char/')).map(k => k.split('/')[1]))];
  for (const c of chars) {
    const s = el('section', { id: 'personagem-' + c }, el('h2', { textContent: 'Personagem ' + c }));
    s.append(el('div', { className: 'row' }, ...keys.filter(k => k.startsWith('char/' + c + '/')).map(k => animGroup(k))));
    root.append(s);
  }
  window.pronto = true;
}
main();
</script></body></html>
`;
}
