import { stage2, st2 } from '../../src/core/stages/stage2';
import { addBomb } from '../../src/core/bombs';
import { BTN, type GameEvent } from '../../src/core/types';
import { cellOf, centerX } from '../../src/core/units';
import { romLayers, fallbackLayers } from '../../src/render/battle-layers';
import '../../src/render/rom/stages/stage2';
import '../../src/render/fallback/stages/stage2';
import { stageArena, fullRound, toPlay, runUntil, run, put, stageEvents, fakeBuilder, fakeAssets, fakeCtx } from './kit';

describe('arena 2: golden do emulador (5 jogadores, semente de boot) [D1, D2]', () => {
  it('1º sorteio no 1º tick de play: $3BC1 → $D6C3, temporizador 320 + 213', () => {
    const s = fullRound(2);
    expect(s.rng.seed).toBe(0x3bc1);
    toPlay(s);
    expect(s.rng.seed).toBe(0xd6c3);
    expect(st2(s).left).toBe(533 - 10);   // 10 ticks lógicos do intro já passaram (D3)
  });
  it('trocas nos ticks lógicos 534, 900, 1317, 1660 (relógio 2:52/7, 2:46/1, 2:39/4, 2:33/21)', () => {
    const s = fullRound(2);
    const seen: { sec: number; sub: number; mode: string; seed: number }[] = [];
    const warn: { sec: number; sub: number }[] = [];
    runUntil(s, (st, ev: GameEvent[]) => {
      for (const e of stageEvents(ev)) {
        if (e.id.startsWith('a2_mode')) seen.push({ sec: st.clock.sec, sub: st.clock.sub, mode: e.id, seed: st.rng.seed });
        if (e.id === 'a2_warn') warn.push({ ...st.clock });
      }
      return seen.length === 4;
    }, 3000);
    expect(seen).toEqual([
      { sec: 172, sub: 7, mode: 'a2_mode1', seed: 0x4bdb },
      { sec: 166, sub: 1, mode: 'a2_mode1', seed: 0x61b3 },
      { sec: 159, sub: 4, mode: 'a2_mode0', seed: 0xde4b },
      { sec: 153, sub: 21, mode: 'a2_mode2', seed: 0xb7a3 },
    ]);
    expect(warn[0]).toEqual({ sec: 174, sub: 15 });   // 128 ticks antes da 1ª troca
    expect(warn.length).toBe(4);
  });
});

describe('arena 2: efeitos do modo', () => {
  const speedDelta = (mode: 0 | 1 | 2, lv: number): number => {
    const s = stageArena(2);
    st2(s).mode = mode;
    const p = put(s, 0, 2, 1);
    p.speedLv = lv;
    run(s, 1, [BTN.RIGHT, 0, 0, 0, 0]);
    const x0 = p.x;
    run(s, 1, [BTN.RIGHT, 0, 0, 0, 0]);
    return p.x - x0;
  };
  it('rápido = nível 6 (512/tick) ignorando patins; lento = nível 7 (128/tick); normal = nível próprio', () => {
    expect(speedDelta(1, 5)).toBe(512);
    expect(speedDelta(2, 1)).toBe(128);
    expect(speedDelta(0, 5)).toBe(384);
    expect(speedDelta(0, 1)).toBe(256);
  });
  it('speedLevel sobrepõe a caveira $22', () => {
    const s = stageArena(2);
    st2(s).mode = 1;
    expect(stage2.speedLevel!(s, s.players[0], 7)).toBe(6);
  });
  const fuseTicks = (mode: 0 | 1 | 2, oddStart: boolean): number => {
    const s = stageArena(2);
    st2(s).mode = mode;
    if (oddStart) run(s, 1);
    const born = s.tick;
    addBomb(s, 0, cellOf(8, 5));
    const t = runUntil(s, (_s, ev) => ev.some(e => e.type === 'explosion'), 400);
    return t - born;
  };
  it('pavio 127 / 64 / 253 (colocada em tick par) e 252 (ímpar) [D5]', () => {
    expect(fuseTicks(0, false)).toBe(127);
    expect(fuseTicks(1, false)).toBe(64);
    expect(fuseTicks(2, false)).toBe(253);
    expect(fuseTicks(2, true)).toBe(252);
  });
  it('HOFS do BG1: +8 / +32 / +1 a cada 4 ticks, começando em 8', () => {
    for (const [mode, want] of [[0, 24], [1, 72], [2, 10]] as const) {
      const s = stageArena(2);
      st2(s).mode = mode;
      run(s, 8);                                           // ticks 101..108: somas em 104 e 108
      expect(st2(s).hofs).toBe(want);
    }
  });
});

describe('arena 2: camadas', () => {
  it('ROM: bg1Scroll com o HOFS do estado; nada em outra fase', () => {
    const s = stageArena(2);
    st2(s).hofs = 40;
    const { b, calls } = fakeBuilder();
    const layer = romLayers.find(l => l.id === 'stage2')!;
    layer.draw(s, b, fakeAssets(), 0);
    expect(calls.scroll).toEqual([40]);
    const s1 = stageArena(1);
    layer.draw(s1, b, fakeAssets(), 0);
    expect(calls.scroll).toEqual([40]);
  });
  it('fallback: véu no modo rápido/lento, nada no normal', () => {
    const layer = fallbackLayers.find(l => l.id === 'stage2')!;
    const s = stageArena(2);
    const a = fakeCtx();
    layer.draw(s, a.ctx, {} as never, 0);
    expect(a.log.length).toBe(0);
    st2(s).mode = 1;
    layer.draw(s, a.ctx, {} as never, 0);
    expect(a.log).toContain('fillRect');
  });
  it('ponto de referência: x de centro da col 2', () => { expect(centerX(2)).toBe(31 * 256); });
});
