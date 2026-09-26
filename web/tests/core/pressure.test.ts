import { arena, setCell, codeAt, C } from './kit';
import { pressureSpiral, tickPressure } from '../../src/core/pressure';
import { addBomb } from '../../src/core/bombs';
import { CODE, type GameEvent } from '../../src/core/types';
import { itemCode } from '../../src/core/state';
import { step } from '../../src/core/step';
import { put } from './kit';

/** Só o controlador da pressão, tick a tick (isolado dos jogadores). */
function pump(s: ReturnType<typeof arena>, n: number, ev: GameEvent[] = []): GameEvent[] {
  for (let i = 0; i < n; i++) { s.tick++; tickPressure(s, ev); }
  return ev;
}

function triggered(sd = false) {
  const s = arena({ rules: { suddenDeath: sd, timeIdx: 4 } });
  s.pressure.total = sd ? 143 : 80;
  s.pressure.trigger = 100;                       // gatilho no tick 100
  return s;
}

describe('espiral ($C1:724E)', () => {
  it('143 casas: anel externo de (2,1) no sentido horário, depois os internos', () => {
    const sp = pressureSpiral();
    expect(sp.length).toBe(143);
    expect(new Set(sp).size).toBe(143);
    expect(sp.slice(0, 13)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(c => C(c, 1)));
    expect([sp[13], sp[22], sp[23], sp[34], sp[35], sp[43]]).toEqual([C(14, 2), C(14, 11), C(13, 11), C(2, 11), C(2, 10), C(2, 2)]);
    expect([sp[44], sp[79], sp[80], sp[142]]).toEqual([C(3, 2), C(3, 3), C(4, 3), C(9, 6)]);
  });
});

describe('controlador da pressão (t72)', () => {
  it('bordas em T+192; 1º passo em T+205 em (2,1); pousa em 36 + 2·lin; 1 passo a cada 14 ticks', () => {
    const s = triggered();
    pump(s, 191); expect(codeAt(s, 5, 0)).toBe(CODE.HARD);
    pump(s, 1); expect([codeAt(s, 5, 0), codeAt(s, 2, 12), codeAt(s, 1, 0)]).toEqual([CODE.PRESSURE, CODE.PRESSURE, CODE.HARD]);
    const ev = pump(s, 13);                        // tick 305
    expect(ev).toEqual([{ type: 'pressure_step', cell: C(2, 1) }]);
    expect(codeAt(s, 2, 1)).toBe(CODE.FALLING);
    expect(pump(s, 14)).toEqual([{ type: 'pressure_step', cell: C(3, 1) }]);   // 319
    pump(s, 23); expect(codeAt(s, 2, 1)).toBe(CODE.FALLING);                   // 342
    pump(s, 1); expect(codeAt(s, 2, 1)).toBe(CODE.PRESSURE);                   // 343 = 305 + 38
  });
  it('Morte Súbita Off: 80 passos, 62 blocos na arena de pilares; On: 143 passos, 113 blocos', () => {
    for (const [sd, blocks, last] of [[false, 62, 100 + 205 + 14 * 79], [true, 113, 100 + 205 + 14 * 142]] as const) {
      const s = triggered(sd);
      const ev = pump(s, last + 100 - s.tick);
      const steps = ev.filter(e => e.type === 'pressure_step');
      expect(steps.length).toBe(blocks);
      expect(s.pressure.next).toBe(sd ? 143 : 80);
    }
  });
  it('casa dura gasta o passo: (3,2) é pilar, o passo 44 não tem bloco', () => {
    const s = triggered();
    s.pressure.next = 44;
    s.tick = 100 + 205 - 1;
    const ev: GameEvent[] = [];
    s.tick++; tickPressure(s, ev);
    expect([ev, s.pressure.next]).toEqual([[], 45]);
  });
  it('ao pousar: apaga a bomba sem explodir (volta ao dono), o item e cobre o soft', () => {
    const s = triggered();
    const p = s.players[0]; p.bombsFree = 0;
    const b = addBomb(s, 0, C(2, 1));
    setCell(s, 3, 1, itemCode(0x03)); setCell(s, 4, 1, CODE.SOFT);
    s.hidden = [[C(4, 1), 0x01]];
    pump(s, 205 + 28 + 38);
    expect([s.bombs.includes(b), p.bombsFree]).toEqual([false, 1]);
    expect([codeAt(s, 2, 1), codeAt(s, 3, 1), codeAt(s, 4, 1)]).toEqual([CODE.PRESSURE, CODE.PRESSURE, CODE.PRESSURE]);
    expect(s.hidden).toEqual([]);
  });
});

describe('pressão: detalhes', () => {
  it('bordas gravam o tick (cellT0) e zeram a peça (cellAux) das casas', () => {
    const s = triggered();
    s.cellAux[C(5, 0)] = 7; s.cellT0[C(5, 12)] = 3;
    pump(s, 192);
    expect([s.cellT0[C(5, 0)], s.cellAux[C(5, 0)], s.cellT0[C(5, 12)], s.cellAux[C(5, 12)]]).toEqual([292, 0, 292, 0]);
  });
  it('continua caindo em `won` (decisão 21); quem está de pé é imune', () => {
    const s = triggered();
    s.phase = 'won'; s.phaseT0 = 100; s.endAt = 100; s.celebT0 = 100_000;   // comemoração fora do alcance do teste
    const p = put(s, 0, 2, 1);
    let steps = 0;
    for (let i = 0; i < 260; i++) { const ev = step(s, [0, 0, 0, 0, 0]); steps += ev.filter(e => e.type === 'pressure_step').length; }
    expect(steps).toBeGreaterThan(0);
    expect(codeAt(s, 2, 1)).toBe(CODE.PRESSURE);
    expect([p.state, s.phase]).toEqual(['alive', 'won']);
  });
});
