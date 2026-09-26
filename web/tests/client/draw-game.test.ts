import { drawRound, PLAYER_COLORS } from '../../src/render/draw-game';
import { createView, updateView } from '../../src/render/view';
import { createRound, makeRng, defaultRules, CODE, cellOf } from '../../src/core';
import { registerFallbackLayer, fallbackLayers, fallbackOverLayers } from '../../src/render/battle-layers';
import type { SpriteBank } from '../../src/render/sprite-bank';

interface TagImg { width: number; height: number; tag: string }

function fakeBank(): SpriteBank {
  const plain = { width: 16, height: 16 };
  const tiles = { floor: plain, floorAlt: plain, hard: plain, wall: plain, soft: plain, burning: [plain, plain], bg: '#000' };
  const bank = {
    bomber: () => ({ width: 16, height: 24 }),
    head: () => ({ width: 16, height: 16 }),
    bomb: () => ({ width: 16, height: 16 }),
    item: () => ({ width: 16, height: 16 }),
    flame: () => ({ width: 16, height: 16 }),
    crown: () => ({ width: 16, height: 16 }),
    trophy: () => ({ width: 16, height: 16 }),
    clock: () => ({ width: 16, height: 16 }),
    text: (s: string, color: string): TagImg => ({ width: Math.max(0, s.length * 6 - 1), height: 12, tag: `${s}|${color}` }),
    plainText: (s: string, color: string): TagImg => ({ width: Math.max(0, s.length * 6 - 1), height: 10, tag: `plain:${s}|${color}` }),
    tiles: () => tiles,
  };
  return bank as unknown as SpriteBank;
}

interface DrawCall { img: unknown; x: number; y: number }
interface FillRectCall { x: number; y: number; w: number; h: number }

function fakeCtx() {
  const calls: DrawCall[] = [];
  const fillRectCalls: FillRectCall[] = [];
  const ctx = {
    calls,
    fillRectCalls,
    fillStyle: '', globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number) { fillRectCalls.push({ x, y, w, h }); },
    drawImage(img: unknown, x: number, y: number) { calls.push({ img, x, y }); },
  };
  return ctx as unknown as CanvasRenderingContext2D & { calls: DrawCall[]; fillRectCalls: FillRectCall[] };
}

function findTag(calls: DrawCall[], text: string, color: string): DrawCall | undefined {
  return calls.find(c => (c.img as TagImg).tag === `${text}|${color}`);
}

describe('drawRound: identificador de jogador acima do bomber', () => {
  it('modo livre: mostra "NP" na cor do jogador, centrado, acima da cabeça', () => {
    const round = createRound(1, defaultRules(), makeRng());
    const view = createView();
    updateView(view, round, []);
    const bank = fakeBank();
    const ctx = fakeCtx();
    drawRound(ctx, round, view, bank, [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);
    for (let slot = 0; slot < 5; slot++) {
      const call = findTag(ctx.calls, `${slot + 1}P`, PLAYER_COLORS[slot]);
      expect(call).toBeDefined();
      expect(call!.y).toBeGreaterThanOrEqual(24);
    }
  });

  it('modo time: usa a cor do time (vermelho time 0, branco time 1), não a cor individual', () => {
    const round = createRound(1, { ...defaultRules(), mode: 'team', teams: [0, 1, 0, 1, 0] }, makeRng());
    const view = createView();
    updateView(view, round, []);
    const bank = fakeBank();
    const ctx = fakeCtx();
    drawRound(ctx, round, view, bank, [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);
    expect(findTag(ctx.calls, '1P', '#ff5f5f')).toBeDefined();
    expect(findTag(ctx.calls, '2P', '#ffffff')).toBeDefined();
    // time 1 é branco, não a cor individual de P2 (azul) — confirma que o time manda, não o slot.
    expect(findTag(ctx.calls, '2P', PLAYER_COLORS[1])).toBeUndefined();
  });

  it('não desenha a etiqueta enquanto o jogador está morrendo', () => {
    const round = createRound(1, defaultRules(), makeRng());
    const view = createView();
    updateView(view, round, []);
    round.players[0].state = 'dying'; round.players[0].hitT0 = round.tick; // em animação de morte
    const bank = fakeBank();
    const ctx = fakeCtx();
    drawRound(ctx, round, view, bank, [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);
    expect(findTag(ctx.calls, '1P', PLAYER_COLORS[0])).toBeUndefined();
    expect(findTag(ctx.calls, '2P', PLAYER_COLORS[1])).toBeDefined();
  });

  it('clampa a etiqueta para nunca ficar sobre o HUD (y >= 24)', () => {
    const round = createRound(1, defaultRules(), makeRng());
    const view = createView();
    updateView(view, round, []);
    round.players[0].y = 0; // bem no topo da arena
    const bank = fakeBank();
    const ctx = fakeCtx();
    drawRound(ctx, round, view, bank, [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);
    const call = findTag(ctx.calls, '1P', PLAYER_COLORS[0]);
    expect(call).toBeDefined();
    expect(call!.y).toBeGreaterThanOrEqual(24);
  });
});

describe('drawRound: sombra no chão', () => {
  it('desenha sombra 16×3 em casa livre abaixo de pilar', () => {
    const round = createRound(1, defaultRules(), makeRng());
    const view = createView();
    updateView(view, round, []);
    const bank = fakeBank();
    const ctx = fakeCtx();
    round.grid[cellOf(4, 3)] = CODE.HARD;
    round.grid[cellOf(4, 4)] = CODE.FLOOR;
    drawRound(ctx, round, view, bank, [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);
    // x = 16·4 − 8 = 56, y = 16·4 + 24 = 88
    const shadow = ctx.fillRectCalls.find(r => r.x === 56 && r.y === 88 && r.w === 16 && r.h === 3);
    expect(shadow).toBeDefined();
  });

  it('não desenha sombra em casa livre cujo vizinho de cima é livre', () => {
    const round = createRound(1, defaultRules(), makeRng());
    const view = createView();
    updateView(view, round, []);
    const bank = fakeBank();
    const ctx = fakeCtx();
    round.grid[cellOf(5, 3)] = CODE.FLOOR;
    round.grid[cellOf(5, 4)] = CODE.FLOOR;
    drawRound(ctx, round, view, bank, [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);
    const shadow = ctx.fillRectCalls.find(r => r.x === 72 && r.y === 88 && r.w === 16 && r.h === 3);
    expect(shadow).toBeUndefined();
  });
});

describe('drawRound: camada "over" do fallback (M4)', () => {
  it('desenha depois dos jogadores; a camada normal continua desenhando antes', () => {
    const order: string[] = [];
    registerFallbackLayer({ id: 'test-under', draw() { order.push('under'); } });
    registerFallbackLayer({ id: 'test-over', over: true, draw() { order.push('over'); } });
    try {
      const round = createRound(1, defaultRules(), makeRng());
      const view = createView(); updateView(view, round, []);
      const bank = fakeBank();
      const ctx = fakeCtx();
      const rawDraw = ctx.drawImage.bind(ctx);
      ctx.drawImage = ((img: unknown, x: number, y: number) => {
        const im = img as { width: number; height: number };
        if (im.width === 16 && im.height === 24) order.push('player');     // só bank.bomber() tem essas dimensões
        rawDraw(img as CanvasImageSource, x, y);
      }) as typeof ctx.drawImage;
      drawRound(ctx, round, view, bank, [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);
      expect(order[0]).toBe('under');
      expect(order).toContain('player');
      expect(order.indexOf('over')).toBeGreaterThan(order.lastIndexOf('player'));
    } finally {
      fallbackLayers.length = 0; fallbackOverLayers.length = 0;
    }
  });
});

describe('drawRound: grade de códigos', () => {
  it('desenha chama, soft, item e bomba pelas casas da ROM (x = 16·col − 8, y = 16·lin + 24)', () => {
    const round = createRound(1, defaultRules(), makeRng());
    round.grid[cellOf(4, 1)] = CODE.FLAME; round.cellT0[cellOf(4, 1)] = round.tick;
    const view = createView(); updateView(view, round, []);
    const ctx = fakeCtx();
    drawRound(ctx, round, view, fakeBank(), [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);
    expect(ctx.calls.some(c => c.x === 16 * 4 - 8 && c.y === 16 * 1 + 24)).toBe(true);
  });
});
