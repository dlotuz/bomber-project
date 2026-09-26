import { startPrize, tickPrize, tickFalls, colsFor } from '../../src/core/stages/stage8-prizes';
import { st8 } from '../../src/core/stages/stage8';
import type { Stage8State } from '../../src/core/stages/state';
import { A8_FALL_DY, A8_RAIN } from '../../src/core/stages/tables';
import { CODE, type GameEvent, type RoundState } from '../../src/core/types';
import { cellOf } from '../../src/core/units';
import { itemCode } from '../../src/core/state';
import { stageArena, codeAt, setCell, stageEvents, mirror } from './kit';

function prizeArena(routine: number, lastStopped = 4, tick = 100) {
  const s = stageArena(8);
  s.tick = tick;
  const a = st8(s);
  a.started = true; a.phase = 'prize'; a.lastStopped = lastStopped;
  const ev: GameEvent[] = [];
  startPrize(s, a, routine, ev);
  return { s, a, ev };
}
/** n ticks do caça-níquel em prêmio: quedas e depois o prêmio (ordem de stage8.tick). */
function advance(s: RoundState, a: Stage8State, n: number): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    s.tick++;
    tickFalls(s, a, out);
    if (a.phase === 'prize' && tickPrize(s, a, out)) { a.prize = null; a.phase = 'idle'; }
  }
  return out;
}
const fallTotal = (script: number): number => A8_FALL_DY[script].reduce((x, y) => x + y, 0);

describe('arena 8: prêmios [D13]', () => {
  it('$14F9: 3 caveiras sorteadas (24, 24, 2A); SFX do prêmio; 1º lote aos 48 ticks nas colunas do rolo 1', () => {
    const { s, a, ev } = prizeArena(0x14f9);
    expect(a.prize!.queue).toEqual([0x24, 0x24, 0x2a]);
    expect(s.rng.seed).toBe(0xc581);
    expect(stageEvents(ev, 'a8_prize').length).toBe(1);
    advance(s, a, 47);
    expect(a.falls.length).toBe(0);
    const e2 = advance(s, a, 1);                                   // tick 148
    expect(stageEvents(e2, 'a8_drop').length).toBe(3);
    expect(a.falls.map(f => [f.id, f.x, f.y, fallTotal(f.script)])).toEqual([[0x24, 48, 64, 16], [0x24, 64, 64, 64], [0x2a, 80, 64, 96]]);
    expect(s.rng.seed).toBe(0x331b);
    advance(s, a, 11);                                             // tick 159: aterrissam
    expect(codeAt(s, 3, 3)).toBe(itemCode(0x24));
    expect(codeAt(s, 4, 6)).toBe(itemCode(0x24));
    expect(s.flyers.some(f => f.kind === 'item' && f.ref === 0x2a)).toBe(true);   // (5,8) é pilar: quica
    advance(s, a, 53);                                             // tick 212: fila vazia → fim
    expect(a.phase).toBe('idle');
  });
  it('colunas pelo último rolo a parar: 1 → 48/64/80, 2 → 112/128/144, 3 → 176/192/208', () => {
    const a = st8(stageArena(8));
    a.lastStopped = 4; expect(colsFor(a)).toEqual([48, 64, 80, 64]);
    a.lastStopped = 2; expect(colsFor(a)).toEqual([112, 128, 144, 128]);
    a.lastStopped = 1; expect(colsFor(a)).toEqual([176, 192, 208, 192]);
  });
  it('$1611: 3 itens (01, 05, 0E) e 2 ovos já caindo (33 em X 64, 3F em X 80)', () => {
    const { s, a } = prizeArena(0x1611);
    expect(a.prize!.queue).toEqual([0x01, 0x05, 0x0e]);
    expect(a.falls.map(f => [f.id, f.x, fallTotal(f.script)])).toEqual([[0x33, 64, 96], [0x3f, 80, 64]]);
    expect(s.rng.seed).toBe(0x9b59);
  });
  it('teto de ovos: com 2 ovos no chão, nenhum ovo e nenhum sorteio de ovo', () => {
    const s = stageArena(8);
    setCell(s, 5, 5, 0x0972); setCell(s, 7, 5, 0x097c);
    const a = st8(s); a.started = true; a.phase = 'prize'; a.lastStopped = 4;
    const m = mirror(s.rng.seed);
    startPrize(s, a, 0x1611, []);
    expect(a.falls.length).toBe(0);
    m.rnd(7); m.rnd(7); m.rnd(7);
    expect(s.rng.seed).toBe(m.seed());
  });
  it('$163A: 3 × item $11 sem sorteio na fila', () => {
    expect(prizeArena(0x163a).a.prize!.queue).toEqual([0x11, 0x11, 0x11]);
  });
  it('$1682: 03 04 03 03 04 03 03 04 03 em 3 lotes (+48, +112, +176) e fim em +240', () => {
    const { s, a } = prizeArena(0x1682);
    expect(a.prize!.queue).toEqual([3, 4, 3, 3, 4, 3, 3, 4, 3]);
    const drops: number[] = [];
    for (let i = 0; i < 240; i++) if (stageEvents(advance(s, a, 1), 'a8_drop').length) drops.push(s.tick - 100);
    expect(drops).toEqual([48, 112, 176]);
    expect(a.phase).toBe('idle');
  });
  it('$1526: bomba de fogo 4 cai 128 ticks depois do fim da fila (+240) e vira bomba sem dono', () => {
    const { s, a } = prizeArena(0x1526);
    advance(s, a, 239);
    expect(a.falls.some(f => f.kind === 'bomb')).toBe(false);
    advance(s, a, 1);
    expect(a.falls.filter(f => f.kind === 'bomb').map(f => f.born)).toEqual([340]);
    expect(a.phase).toBe('idle');
    advance(s, a, 12);
    expect(s.bombs.some(b => b.fire === 4 && b.owner === -1)).toBe(true);
  });
  it('$15BF: 12 caveiras e pressão total (143 passos) uma vez por rodada', () => {
    const { s, a } = prizeArena(0x15bf, 4, 400);
    expect(a.prize!.queue.length).toBe(12);
    expect(s.pressure.total).toBe(143);
    expect(s.pressure.trigger).toBe(400 - 191);
    expect(a.jackpotUsed).toBe(true);
    s.pressure.trigger = -1; s.pressure.total = 80;
    startPrize(s, a, 0x15bf, []);
    expect([s.pressure.trigger, s.pressure.total]).toEqual([-1, 80]);
  });
  it('$17AD: 16 ondas a cada 64 ticks (a 1ª em +48), 3–5 itens iguais A8_RAIN[onda & 7], depois parada', () => {
    const { s, a } = prizeArena(0x17ad);
    for (let k = 0; k < 16; k++) {
      advance(s, a, k === 0 ? 48 : 64);
      const fresh = a.falls.filter(f => f.born === s.tick && f.kind === 'item');
      expect(fresh.length, `onda ${k}`).toBeGreaterThanOrEqual(3);
      expect(fresh.length, `onda ${k}`).toBeLessThanOrEqual(5);
      expect(fresh.every(f => f.id === A8_RAIN[k & 7]), `onda ${k}`).toBe(true);
    }
    expect(a.phase).toBe('idle');
  });
  it('item que cai em casa queimando some', () => {
    const { s, a } = prizeArena(0x14d6);
    advance(s, a, 48);
    const f = a.falls[0];
    const lin = 2 + fallTotal(f.script) / 16;
    const col = Math.floor((f.x + 8) / 16);
    setCell(s, col, lin, CODE.BURNING);
    advance(s, a, 11);
    expect(codeAt(s, col, lin)).toBe(CODE.BURNING);
    expect(s.flyers.length).toBe(0);
    expect(cellOf(col, lin)).toBeGreaterThan(0);
  });
});
