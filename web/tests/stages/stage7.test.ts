import { stage7, ARROWS } from '../../src/core/stages/stage7';
import { stageArena, fullRound, put, run, setCell, codeAt, fakeBuilder, fakeAssets, fakeCtx } from './kit';
import { stage7Ai } from '../../src/core/ai/stages/stage7';
import { addBomb } from '../../src/core/bombs';
import { BTN, CODE } from '../../src/core/types';
import { cellOf, centerX, px } from '../../src/core/units';
import { romLayers, fallbackLayers, fallbackOverLayers } from '../../src/render/battle-layers';
import '../../src/render/rom/stages/stage7';
import '../../src/render/fallback/stages/stage7';

describe('arena 7: setas', () => {
  it('4 setas em circuito horário: (4,3) →, (4,9) ↑, (12,3) ↓, (12,9) ←', () => {
    expect(ARROWS.map(a => [a.cell, a.face, a.word])).toEqual([
      [cellOf(4, 3), 2, 0x1cc2], [cellOf(4, 9), 0, 0x1cc0], [cellOf(12, 3), 4, 0x1cc4], [cellOf(12, 9), 6, 0x1cc6]]);
  });
  it('rodada real: lógico 0040 nas 4 casas e 62 soft blocks', () => {
    const s = fullRound(7);
    for (const a of ARROWS) expect(s.grid[a.cell]).toBe(CODE.ARROW);
    expect(s.grid.filter(v => v === CODE.SOFT).length).toBe(62);
  });
  it('bomba chutada que entra na seta vira para a direção dela', () => {
    const s = stageArena(7);
    expect(stage7.kickedBombEnter!(s, null as never, cellOf(4, 3))).toEqual({ turn: 2 });
    expect(stage7.kickedBombEnter!(s, null as never, cellOf(5, 3))).toBe('go');
  });
  it('chute de ponta a ponta: para baixo em (4,2), vira em (4,3) para a direita, vira em (12,3) para baixo (b14)', () => {
    const s = stageArena(7, 2);
    const p = put(s, 0, 4, 1, 0, -6);                         // 6 px acima do centro: o chute dispara ao andar (máscara)
    p.kick = true;
    const b = addBomb(s, 0, cellOf(4, 2));
    const cells: number[] = [];
    for (let i = 0; i < 120 && s.bombs.includes(b); i++) {
      run(s, 1, i < 10 ? [BTN.DOWN, 0, 0, 0, 0] : [0, 0, 0, 0, 0]);
      if (cells[cells.length - 1] !== b.cell) cells.push(b.cell);
    }
    expect(cells).toContain(cellOf(5, 3));
    expect(cells).toContain(cellOf(12, 5));
    expect(cells).not.toContain(cellOf(4, 4));
  });
  it('jogador não é afetado pela seta', () => {
    const s = stageArena(7, 2);
    const p = put(s, 0, 4, 1);
    run(s, 70, [BTN.DOWN, 0, 0, 0, 0]);
    expect(px(p.x)).toBe(px(centerX(4)));
    expect(px(p.y)).toBeGreaterThan(16 * (5 + 2) - 1 - 16);
  });
  it('chama sobre a seta: vira FLAME (letal) e a seta volta quando a chama acaba (D16)', () => {
    const s = stageArena(7);
    stage7.onFlameCell!(s, cellOf(4, 3), 2, []);
    expect(codeAt(s, 4, 3)).toBe(CODE.FLAME);
    run(s, 26);
    expect(codeAt(s, 4, 3)).toBe(CODE.ARROW);
  });
});

describe('arena 7: IA e camadas', () => {
  it('kickEnd segue as setas: de (4,2) para baixo, com parede em (12,4), para em (12,3)', () => {
    const s = stageArena(7);
    setCell(s, 12, 4, CODE.HARD);
    expect(stage7Ai.kickEnd!(s, cellOf(4, 2), 4)).toBe(cellOf(12, 3));
  });
  it('ROM: palavra de cada seta no BG2, exceto sob chama', () => {
    const s = stageArena(7);
    setCell(s, 12, 9, CODE.FLAME);
    const { b, calls } = fakeBuilder();
    romLayers.find(l => l.id === 'stage7')!.draw(s, b, fakeAssets(), 0);
    expect([...calls.bg2.entries()].sort()).toEqual([['12,3', 0x1cc4], ['4,3', 0x1cc2], ['4,9', 0x1cc0]]);
  });
  it('fallback: setas (camada normal, antes de bombas/jogadores)', () => {
    const a = fakeCtx();
    fallbackLayers.find(l => l.id === 'stage7')!.draw(stageArena(7), a.ctx, {} as never, 0);
    expect(a.log.filter(x => x === 'fill').length).toBeGreaterThanOrEqual(4);
    expect(a.log.filter(x => x === 'fillRect').length).toBe(0);
  });
  it('fallback (M4): moitas na camada "over", desenhada depois de bombas e jogadores', () => {
    const a = fakeCtx();
    const bushes = fallbackOverLayers.find(l => l.id === 'stage7-bushes')!;
    expect(bushes.over).toBe(true);
    bushes.draw(stageArena(7), a.ctx, {} as never, 0);
    expect(a.log.filter(x => x === 'fillRect').length).toBe(36);
  });
});
