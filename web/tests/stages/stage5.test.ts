import { stage5, fenceHit } from '../../src/core/stages/stage5';
import { stageArena, fullRound, put, run, stageEvents, fakeCtx } from './kit';
import { shock } from '../../src/core/stages/kit';
import { BTN, CODE, type GameEvent } from '../../src/core/types';
import { fallbackLayers } from '../../src/render/battle-layers';
import '../../src/render/fallback/stages/stage5';

describe('arena 5: cerca [D8]', () => {
  it('empurrado na borda indo para a cerca: choque (act shocked, SFX via a5_shock), empurrão zerado', () => {
    for (const [col, lin, vx, vy] of [[2, 5, -1024, 0], [14, 5, 1024, 0], [6, 1, 0, -1024], [6, 11, 0, 1024]] as const) {
      const s = stageArena(5);
      const p = put(s, 0, col, lin);
      p.push = { vx, vy, left: 5 };
      const ev: GameEvent[] = [];
      stage5.outOfBounds!(s, p, ev);
      expect(p.act, `${col},${lin}`).toBe('shocked');
      expect(p.push.left).toBe(0);
      expect(stageEvents(ev, 'a5_shock').map(e => e.slot)).toEqual([0]);
    }
  });
  it('na borda mas indo para dentro: nada', () => {
    const s = stageArena(5);
    const p = put(s, 0, 2, 5);
    p.push = { vx: 1024, vy: 0, left: 5 };
    expect(fenceHit(p)).toBe(false);
  });
  it('fora da caixa x ∈ [24,232), y ∈ [40,216): choque', () => {
    const s = stageArena(5);
    const p = put(s, 0, 2, 5);
    p.x = 23 * 256;
    expect(fenceHit(p)).toBe(true);
    p.x = 24 * 256;
    expect(fenceHit(p)).toBe(false);
    p.x = 100 * 256; p.y = 216 * 256;
    expect(fenceHit(p)).toBe(true);
  });
  it('golpe P contra a cerca: a vítima leva choque (medido: P2 em (2,1) empurrado para a esquerda)', () => {
    const s = stageArena(5);
    const p1 = put(s, 0, 3, 1);
    p1.pItem = true; p1.face = 6;
    const p2 = put(s, 1, 2, 1);
    const ev = run(s, 20, st => (st.tick < 101 ? [BTN.Y, 0, 0, 0, 0] : [0, 0, 0, 0, 0]));
    expect(stageEvents(ev, 'a5_shock').map(e => e.slot)).toEqual([1]);
    expect(p2.act).toBe('shocked');
  });
  it('andar contra a cerca não dá choque (conferido no emulador)', () => {
    const s = stageArena(5);
    const p = put(s, 0, 2, 1);
    const ev = run(s, 30, [BTN.LEFT, 0, 0, 0, 0]);
    expect(stageEvents(ev, 'a5_shock').length).toBe(0);
    expect(p.act).not.toBe('shocked');
  });
  it('rodada real: sem blocos', () => {
    expect(fullRound(5).grid.filter(v => v === CODE.SOFT).length).toBe(0);
  });
  it('fallback: desenha a cerca', () => {
    const a = fakeCtx();
    fallbackLayers.find(l => l.id === 'stage5')!.draw(stageArena(5), a.ctx, {} as never, 0);
    expect(a.log).toContain('strokeRect');
  });
  // T1 review: `shock` não deve marcar act `shocked` nem emitir `a5_shock` quando `stunPlayer` não faria nada.
  it('shock: nada se o jogador não está vivo ou está imune (stunPlayer não faria nada)', () => {
    const s = stageArena(5);
    const dead = put(s, 0, 2, 5);
    dead.state = 'dying';
    const ev1: GameEvent[] = [];
    shock(s, dead, ev1);
    expect(dead.act).not.toBe('shocked');
    expect(stageEvents(ev1, 'a5_shock').length).toBe(0);

    const immune = put(s, 1, 2, 5);
    s.phase = 'won';
    const ev2: GameEvent[] = [];
    shock(s, immune, ev2);
    expect(immune.act).not.toBe('shocked');
    expect(stageEvents(ev2, 'a5_shock').length).toBe(0);
  });
});
