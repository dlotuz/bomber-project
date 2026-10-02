// Cor da bomba na mão (luva) e no ar: sempre a do DONO (quem pôs a bomba), nunca a de quem segura ou arremessa —
// nos três desenhos: pontos de cor do efeito (ROM e fallback), quadro "só bombas" do fallback e arte HD.
import { cellOf, px, type RoundState } from '../../src/core';
import { placeBombAt } from '../../src/core/mounts/core-api';
import { bombSpots } from '../../src/render/fx/draw';
import { BOMB_COLORS } from '../../src/render/fx/bomb-tint';
import { drawRound } from '../../src/render/draw-game';
import { createView, updateView } from '../../src/render/view';
import type { SpriteBank } from '../../src/render/sprite-bank';
import { drawHdBattle, hdClock } from '../../src/render/hdart/draw';
import { recCtx, still, testPack } from '../hdart/helpers';
import { BTN, mkRound, placePx, run, cx, cy } from '../mounts/helpers';

const [WHITE, , RED] = BOMB_COLORS;

/** P1 (branco) com luva em cima da bomba do P3 (vermelho), em (8, 5); P3 longe, em (11, 5). Ainda sem levantar. */
function onP3Bomb(): RoundState {
  const s = mkRound({ players: [0, 2] });
  const p1 = placePx(s, 0, cx(4), cy(5)), p3 = placePx(s, 2, cx(8), cy(5));
  p1.glove = true;
  expect(placeBombAt(s, p3, cellOf(8, 5), [])).toBe(true);
  placePx(s, 2, cx(11), cy(5));
  placePx(s, 0, cx(8), cy(5)).face = 2;
  return s;
}

describe('cor da bomba na mão: a do dono', () => {
  it('P1 (olhando para a direita) levanta a bomba do P3: ponto vermelho na pose medida no emulador, na mão do P1', () => {
    const s = onP3Bomb(), p1 = s.players[0];
    // k = tick − início do levantar → [dx, altura] do centro da bomba (emulador, olhando para a direita); k = 0 não aparece
    const ROM: ([number, number] | null)[] = [null, [4, 6], [8, 10], [4, 14], [0, 16], [4, 16], [4, 16], [4, 16], [4, 16], [4, 16]];
    for (let k = 0; k < 10; k++) {
      run(s, 1, { 0: BTN.A });
      expect(s.bombs[0].state).toBe('held');
      expect(s.tick - p1.actT0 === k || p1.act !== 'lift').toBe(true);
      const at = ROM[k];
      expect(bombSpots(s)).toEqual(at ? [[px(p1.x) + at[0], px(p1.y) - at[1], RED]] : []);
    }
    expect(p1.act).not.toBe('lift');
  });

  it('a própria bomba na mão fica na cor de quem a pôs', () => {
    const s = mkRound({ players: [0, 2] });
    const p1 = placePx(s, 0, cx(6), cy(5));
    p1.glove = true;
    run(s, 1, { 0: BTN.A }); run(s, 1);           // põe a bomba
    run(s, 4, { 0: BTN.A });                      // A de novo em cima dela: levanta
    expect(s.bombs[0].state).toBe('held');
    expect(bombSpots(s).map(t => t[2])).toEqual([WHITE]);
  });

  it('arremessada pelo P1, voando e quicando, continua vermelha (do P3), até parar no chão', () => {
    const s = onP3Bomb();
    run(s, 10, { 0: BTN.A });
    run(s, 1);                                    // solta o A: arremesso
    expect(s.flyers.some(f => f.kind === 'bomb')).toBe(true);
    let seen = 0;
    for (let k = 0; k < 120 && s.bombs[0]?.state === 'air'; k++) {
      expect(bombSpots(s).map(t => t[2])).toEqual([RED]);
      seen++;
      run(s, 1);
    }
    expect(seen).toBeGreaterThan(10);
    if (s.bombs[0]) expect(bombSpots(s).map(t => t[2])).toEqual([RED]);
  });
});

/** Banco falso: a bomba é uma imagem própria (para achar onde ela foi desenhada). */
function fakeBank(): SpriteBank {
  const im = (tag: string, w = 16, h = 16) => ({ width: w, height: h, tag });
  const plain = im('tile');
  const tiles = { floor: plain, floorAlt: plain, hard: plain, wall: plain, soft: plain, burning: [plain, plain], bg: '#000' };
  return {
    bomber: () => im('player', 16, 24), head: () => im('head'), headCry: () => im('head'), bomb: () => im('bomb'), item: () => im('item'),
    flame: () => im('flame'), crown: () => im('crown'), trophy: () => im('trophy'), clock: () => im('clock'),
    text: (t: string) => im(`text:${t}`, 12, 12), plainText: (t: string) => im(`text:${t}`, 12, 10), tiles: () => tiles,
  } as unknown as SpriteBank;
}
function rec() {
  const calls: { tag: string; x: number; y: number; w: number; h: number }[] = [];
  const ctx = {
    calls, fillStyle: '', globalAlpha: 1, fillRect() {}, clearRect() {},
    drawImage(img: { tag?: string; width: number; height: number }, x: number, y: number) {
      if (img.tag && img.tag !== 'tile') calls.push({ tag: img.tag, x, y, w: img.width, h: img.height });
    },
  };
  return ctx as unknown as CanvasRenderingContext2D & { calls: typeof calls };
}

describe('fallback (sem ROM): a bomba na mão entra no quadro "só bombas"', () => {
  for (const ticks of [2, 3, 10]) it(`${ticks} tick(s) de A: mesma posição no quadro completo, no "só bombas" e no ponto de cor`, () => {
    const s = onP3Bomb();
    run(s, ticks, { 0: BTN.A });
    const view = createView(); updateView(view, s, []);
    const full = rec(), only = rec();
    drawRound(full, s, view, fakeBank(), [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);
    drawRound(only, s, view, fakeBank(), [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0], { actors: false, bombs: true });
    const fb = full.calls.filter(c => c.tag === 'bomb'), ob = only.calls.filter(c => c.tag === 'bomb');
    expect(fb).toHaveLength(1);
    expect(ob).toEqual(fb);
    const [[x, y, color]] = bombSpots(s);
    expect([fb[0].x + 7, fb[0].y + 7, color]).toEqual([x, y, RED]);   // sprite em px − 7 (como as bombas-objeto)
    // a etiqueta "1P" não cobre a bomba na mão (senão a cor do dono nem aparece)
    const tag = full.calls.find(c => c.tag === 'text:1P')!;
    expect(tag.y + tag.h).toBeLessThanOrEqual(fb[0].y + 2);
  });
});

describe('fallback (sem ROM): ordem da bomba na mão como na ROM', () => {
  for (const face of [0, 2, 4, 6] as const) it(`olhando para ${face}: ${face ? 'na frente' : 'atrás'} de quem segura`, () => {
    const s = onP3Bomb();
    s.players[0].face = face;
    run(s, 10, { 0: BTN.A });
    const view = createView(); updateView(view, s, []);
    const full = rec();
    drawRound(full, s, view, fakeBank(), [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);
    const order = full.calls.map(c => c.tag);
    const bomb = order.indexOf('bomb'), body = full.calls.findIndex(c => c.tag === 'player' && c.x === px(s.players[0].x) - 7);
    expect(bomb).toBeGreaterThanOrEqual(0);
    expect(bomb > body).toBe(face !== 0);
  });
});

describe('arte HD: a bomba na mão é pintada na cor do dono', () => {
  it('P1 segurando a bomba do P3: o recorte pedido é o vermelho do P3', () => {
    const s = onP3Bomb();
    run(s, 10, { 0: BTN.A });
    const asked: number[] = [];
    drawHdBattle(recCtx(), s, testPack({ 'bomb/0': still(128) }), 1, 1, 0, 0, hdClock(s), {
      cats: new Set(['bombs']), bombTint: (_img, _rect, color) => { asked.push(color); return null; },
    });
    expect(asked).toEqual([RED]);
    expect(px(s.players[0].x)).toBe(cx(8));
  });
});
