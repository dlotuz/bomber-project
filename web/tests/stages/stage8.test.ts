// Registro primeiro: importar stage8 antes dele fecha o ciclo stage8 → kit → bombs → stages/index com STAGES[8] = undefined.
import '../../src/core/stages';
import { stage8, st8, newStage8, stepReel, PADS, sym, PAD_IDLE, PAD_LIT } from '../../src/core/stages/stage8';
import { stage8Ai } from '../../src/core/ai/stages/stage8';
import { A8_PADS } from '../../src/core/stages/tables';
import { CODE } from '../../src/core/types';
import { cellOf } from '../../src/core/units';
import { stageArena, fullRound, toPlay, put, run, runUntil, setCell, codeAt, stageEvents, mirror } from './kit';

function lightPad(s: ReturnType<typeof stageArena>, i: number): void {
  s.grid[PADS[i]] = CODE.FLAME;
  s.cellT0[PADS[i]] = s.tick;
}

describe('arena 8: carga e 1º tick [D1]', () => {
  it('golden: sem sorteio na carga ($C689); no 1º tick de play 3 sorteios → $C2F3, rolos em 16, 24, 16', () => {
    const s = fullRound(8);
    expect(s.rng.seed).toBe(0xc689);
    for (const c of PADS) expect(s.grid[c]).toBe(CODE.PAD);
    toPlay(s);
    expect(s.rng.seed).toBe(0xc2f3);
    expect(st8(s).reels.map(r => r.pos)).toEqual([16, 24, 16]);
    expect(PADS.map(c => s.floor[c])).toEqual([PAD_IDLE, PAD_IDLE, PAD_IDLE]);
    expect(PADS).toEqual(A8_PADS.map(([c, l]) => cellOf(c, l)));
  });
});

describe('arena 8: rolo [D12]', () => {
  it('sem freio: anda 1 passo por chamada; freio automático em 384; para alinhado com atraso ≥ 4 (411 chamadas, pos 16)', () => {
    const a = newStage8();
    let n = 0;
    while (!(a.stopped & 4) && n < 2000) { stepReel(a, 0); n++; }
    expect([n, a.reels[0].pos, a.reels[0].delay, a.reels[0].calls]).toEqual([411, 16, 5, 411]);
    expect(a.lastStopped).toBe(4);
    expect(sym(a.reels[0])).toBe(2);
  });
  it('freado na 1ª chamada (calls = 384, atraso 3) a partir de pos 16: para em 19 chamadas, pos 24', () => {
    const a = newStage8();
    Object.assign(a.reels[1], { pos: 16, calls: 384, delay: 3 });
    let n = 0;
    while (!(a.stopped & 2) && n < 200) { stepReel(a, 1); n++; }
    expect([n, a.reels[1].pos]).toEqual([19, 24]);
  });
});

describe('arena 8: máquina', () => {
  it('chama no pad 1 liga: rolo 1 em 0, os outros com A8_PRESET[rnd255 & 3]; pads acesos; rodízio 1 por tick', () => {
    const s = stageArena(8);
    const m = mirror(0x12);
    lightPad(s, 0);
    const ev = run(s, 1);                                         // tick 101: 1º tick (3 sorteios) e liga (1 sorteio)
    const a = st8(s);
    expect([m.rnd(0xff) & 3, m.rnd(0xff) & 3, m.rnd(0xff) & 3].map(v => v * 8)).toEqual([16, 24, 0]);
    expect(m.rnd(0xff) & 3).toBe(3);
    expect(s.rng.seed).toBe(m.seed());
    expect(a.phase).toBe('spin');
    expect(a.reels.map(r => r.calls)).toEqual([0, 0x4c, 0x20]);
    expect(PADS.map(c => s.floor[c])).toEqual([PAD_LIT, PAD_LIT, PAD_LIT]);
    expect(stageEvents(ev, 'a8_start').map(e => e.cell)).toEqual([PADS[0]]);
    run(s, 3);
    expect(a.reels.map(r => r.calls)).toEqual([1, 0x4d, 0x21]);
  });
  it('chama criada neste tick só liga no próximo (D4)', () => {
    const s = stageArena(8);
    run(s, 1);
    s.grid[PADS[2]] = CODE.FLAME; s.cellT0[PADS[2]] = s.tick + 1;   // como se a chama nascesse no próximo passo de objetos
    run(s, 1);
    expect(st8(s).phase).toBe('idle');
  });
  it('todos os pads ocupados: cada rolo freia na 1ª atualização; resultado no tick 158 = (3, 0, 1) → nada', () => {
    const s = stageArena(8, 3);
    put(s, 0, 4, 7).inv = 400;                                    // de pé na chama do pad 1, invencível
    put(s, 1, 8, 7); put(s, 2, 12, 7);
    lightPad(s, 0);
    let brakes = 0;
    const t = runUntil(s, (_s, ev) => {
      brakes += stageEvents(ev, 'a8_brake').length;
      return stageEvents(ev).some(e => e.id === 'a8_nothing' || e.id === 'a8_prize');
    }, 400);
    const a = st8(s);
    expect(t).toBe(158);
    expect(brakes).toBe(3);
    expect(a.reels.map(r => r.pos)).toEqual([24, 0, 8]);
    expect(a.reels.map(sym)).toEqual([3, 0, 1]);
    expect(a.lastRoutine).toBe(0x14f7);
    expect(a.lastStopped).toBe(1);
    expect(a.phase).toBe('idle');
    expect(PADS.map(c => s.floor[c])).toEqual([PAD_IDLE, PAD_IDLE, PAD_IDLE]);
  });
  it('ninguém nos pads: resultado no tick 1334 = (0, 2, 2) → 3 caveiras ($14F9), último a parar = rolo 1', () => {
    const s = stageArena(8);
    lightPad(s, 0);
    const t = runUntil(s, (_s, ev) => stageEvents(ev).some(e => e.id === 'a8_prize' || e.id === 'a8_nothing'), 2000);
    const a = st8(s);
    expect(t).toBe(1334);
    expect(a.reels.map(sym)).toEqual([0, 2, 2]);
    expect(a.lastRoutine).toBe(0x14f9);
    expect(a.lastStopped).toBe(4);
  });
  it('chama sobre o pad vira FLAME (letal) e o pad volta depois da chama (D16)', () => {
    const s = stageArena(8);
    run(s, 1);
    stage8.onFlameCell!(s, PADS[1], 2, []);
    expect(codeAt(s, 8, 7)).toBe(CODE.FLAME);
    run(s, 26);
    expect(codeAt(s, 8, 7)).toBe(CODE.PAD);
  });
  it('IA: com a máquina girando, os pads dos rolos sem freio e não parados são alvos', () => {
    const s = stageArena(8);
    lightPad(s, 0);
    run(s, 1);
    st8(s).reels[1].braking = true;
    expect([...stage8Ai.goals!(s, 0)]).toEqual([PADS[0], PADS[2]]);
    st8(s).phase = 'idle';
    expect([...stage8Ai.goals!(s, 0)]).toEqual([]);
  });
});
