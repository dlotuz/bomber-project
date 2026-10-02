import { drawRound } from '../../src/render/draw-game';
import { createView, updateView } from '../../src/render/view';
import { fallbackLayers, fallbackOverLayers } from '../../src/render/battle-layers';
import type { SpriteBank } from '../../src/render/sprite-bank';
import { mkRound, placePx, ride, cx, cy } from '../mounts/helpers';
import type { Bomb } from '../../src/core';

/** Banco falso: cada imagem diz o que é. */
function fakeBank(): SpriteBank {
  const im = (tag: string, w = 16, h = 16) => ({ width: w, height: h, tag });
  const plain = im('tile');
  const tiles = { floor: plain, floorAlt: plain, hard: plain, wall: plain, soft: plain, burning: [plain, plain], bg: '#000' };
  return {
    bomber: () => im('player', 16, 24), head: () => im('head'), headCry: () => im('head'), bomb: () => im('bomb'), item: () => im('item'),
    flame: () => im('flame'), crown: () => im('crown'), trophy: () => im('trophy'), clock: () => im('clock'),
    text: (s: string) => im(`text:${s}`, 12, 12), plainText: (s: string) => im(`text:${s}`, 12, 10), tiles: () => tiles,
  } as unknown as SpriteBank;
}

/** Contexto falso que registra a ordem do que é desenhado (imagens com etiqueta e camadas trocadas pelo teste). */
function rec() {
  const order: string[] = [];
  const ctx = {
    order, fillStyle: '', globalAlpha: 1,
    fillRect() {}, clearRect() {},
    drawImage(img: { tag?: string }) { if (img.tag && img.tag !== 'tile') order.push(img.tag); },
  };
  return ctx as unknown as CanvasRenderingContext2D & { order: string[] };
}

/** Troca o desenho das camadas de ator do fallback por marcadores, durante `fn`. */
function withMarkers(fn: () => void): void {
  const saved = [...fallbackLayers, ...fallbackOverLayers].map(l => [l, l.draw] as const);
  for (const l of [...fallbackLayers, ...fallbackOverLayers]) {
    l.draw = (_s, ctx) => (ctx as unknown as { order: string[] }).order.push(`layer:${l.id}`);
  }
  try { fn(); } finally { for (const [l, d] of saved) l.draw = d; }
}

function mountedOnOwnBomb(phase: 'mounting' | 'riding' | 'dismount' = 'riding') {
  const s = mkRound();
  const p = placePx(s, 0, cx(5), cy(5));
  ride(s, 0, 0x2, { phase });
  const b: Bomb = { id: 1, owner: 0, bad: false, cell: 0, x: p.x, y: p.y, fuse: 100, fire: 2, type: 0, state: 'idle', dir: 0,
    step: 0, kickedBy: -1, turn: -1, chainAt: 0, born: s.tick };
  s.bombs.push(b);
  const view = createView(); updateView(view, s, []);
  return { s, view };
}

describe('arte simples: bomba por baixo da montaria (como a bomba-BG da ROM)', () => {
  for (const phase of ['mounting', 'riding', 'dismount'] as const) {
    it(`${phase}: bomba → montaria/traje → jogador → frente da montaria`, () => {
      const { s, view } = mountedOnOwnBomb(phase);
      const ctx = rec();
      withMarkers(() => drawRound(ctx, s, view, fakeBank(), [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]));
      const o = ctx.order, i = (t: string) => o.indexOf(t);
      expect(i('bomb')).toBeGreaterThanOrEqual(0);
      expect(i('layer:mounts')).toBeGreaterThan(i('bomb'));
      expect(i('layer:costume')).toBeGreaterThan(i('bomb'));
      if (phase !== 'mounting') expect(i('player')).toBeGreaterThan(i('layer:mounts'));
      expect(i('layer:mounts-front')).toBeGreaterThan(i('bomb'));
    });
  }

  it('quadro "sem atores" com bombas (cor da bomba): só as bombas, sem montaria nem jogador', () => {
    const { s, view } = mountedOnOwnBomb();
    const ctx = rec();
    withMarkers(() => drawRound(ctx, s, view, fakeBank(), [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0], { actors: false, bombs: true }));
    expect(ctx.order).toContain('bomb');
    expect(ctx.order.some(t => t === 'player' || t.startsWith('layer:mounts') || t === 'layer:costume')).toBe(false);
    const none = rec();
    withMarkers(() => drawRound(none, s, view, fakeBank(), [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0], { actors: false }));
    expect(none.order).not.toContain('bomb');
  });
});
