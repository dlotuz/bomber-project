import { drawRound, PLAYER_COLORS } from '../../src/render/draw-game';
import { createView, updateView } from '../../src/render/view';
import { newRound } from '../core/helpers';
import { CELL, idx, GRID_W } from '../../src/core';
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
    const round = newRound({});
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
    const round = newRound({ mode: 'team', teams: [0, 1, 0, 1, 0] });
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
    const round = newRound({});
    const view = createView();
    updateView(view, round, []);
    round.players[0].dying = 40; // ainda "vivo" (alive=true) mas em animação de morte
    const bank = fakeBank();
    const ctx = fakeCtx();
    drawRound(ctx, round, view, bank, [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);
    expect(findTag(ctx.calls, '1P', PLAYER_COLORS[0])).toBeUndefined();
    expect(findTag(ctx.calls, '2P', PLAYER_COLORS[1])).toBeDefined();
  });

  it('clampa a etiqueta para nunca ficar sobre o HUD (y >= 24)', () => {
    const round = newRound({});
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
  it('desenha sombra 16×3 em célula EMPTY abaixo de pilar', () => {
    const round = newRound({ clear: true, stage: 1 });
    const view = createView();
    updateView(view, round, []);
    const bank = fakeBank();
    const ctx = fakeCtx();

    // Coloca um pilar em (2, 2) — célula EMPTY abaixo é (2, 3)
    round.arena.cells[idx(2, 2)] = CELL.HARD;

    drawRound(ctx, round, view, bank, [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);

    // Procura pela fillRect da sombra: x = 16*2+8 = 40, y = 16*3+24 = 72, w = 16, h = 3
    const shadow = ctx.fillRectCalls.find(r => r.x === 40 && r.y === 72 && r.w === 16 && r.h === 3);
    expect(shadow).toBeDefined();
  });

  it('não desenha sombra em célula EMPTY cujo vizinho superior é EMPTY', () => {
    const round = newRound({ clear: true, stage: 1 });
    const view = createView();
    updateView(view, round, []);
    const bank = fakeBank();
    const ctx = fakeCtx();

    // Ambas (3, 2) e (3, 3) começam vazias (EMPTY)
    // Não deve haver sombra em (3, 3)

    drawRound(ctx, round, view, bank, [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);

    // Procura por fillRect em (3, 3): x = 16*3+8 = 56, y = 16*3+24 = 72
    const shadow = ctx.fillRectCalls.find(r => r.x === 56 && r.y === 72 && r.w === 16 && r.h === 3);
    expect(shadow).toBeUndefined();
  });
});
