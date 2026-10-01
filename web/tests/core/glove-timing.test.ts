// Tempos da luva medidos na ROM (st_arena05, jogador 1 com luva; scratchpad ajb/g1..g7, relatório AJUSTE-B):
// levantar = estado $C2:3692 por 8 ticks (T..T+7), T+8 volta ao estado normal sem andar, anda em T+9;
// arremessar = estado $C2:3882 por 20 ticks, anda em T+21; largar com B = pose do B ($C2:36CA) no tick T, anda em T+2.
import { arena, put, run, C } from './kit';
import { addBomb } from '../../src/core/bombs';
import { BTN, type GameEvent, type RoundState } from '../../src/core/types';
import { step } from '../../src/core/step';

/** Roda 1 tick com as entradas dadas e devolve os eventos. */
const tick = (s: RoundState, inputs: number[]): GameEvent[] => step(s, inputs);

function withBomb() {
  const s = arena({ players: 2 });
  const p = put(s, 0, 4, 1); p.glove = true; p.face = 2;
  put(s, 1, 12, 9);
  const b = addBomb(s, 0, C(4, 1));
  return { s, p, b };
}

describe('luva: tempos da ROM', () => {
  it('levantar a bomba trava 8 ticks na pose (T..T+7); T+8 já segura mas ainda parado; anda em T+9', () => {
    const { s, p, b } = withBomb();
    tick(s, [BTN.A, 0]);                                   // T: aperta A sobre a bomba
    const T = s.tick, x0 = p.x;
    expect([p.act, p.carry]).toEqual(['lift', b.id]);
    const acts: string[] = [], moved: boolean[] = [];
    for (let k = 1; k <= 9; k++) { tick(s, [BTN.A | BTN.RIGHT, 0]); acts.push(p.act); moved.push(p.x !== x0); }
    expect(s.tick).toBe(T + 9);
    expect(acts.slice(0, 7)).toEqual(Array(7).fill('lift'));   // T+1..T+7
    expect(acts[7]).toBe('carryIdle');                          // T+8
    expect(moved.slice(0, 8)).toEqual(Array(8).fill(false));    // T+1..T+8 parado
    expect(moved[8]).toBe(true);                                // T+9 anda
  });

  it('soltar A durante o levantamento arremessa no 1º tick livre (T+9)', () => {
    const { s, p } = withBomb();
    tick(s, [BTN.A, 0]);
    const T = s.tick;
    tick(s, [BTN.A, 0]);
    let at = -1;
    for (let k = 0; k < 12 && at < 0; k++) if (tick(s, [0, 0]).some(e => e.type === 'throw')) at = s.tick;
    expect(at).toBe(T + 9);
    expect(p.act).toBe('throw');
  });

  it('soltou A durante o levantamento mas apertou de novo até T+9: não arremessa (a ROM olha o A apertado)', () => {
    const { s, p, b } = withBomb();
    tick(s, [BTN.A, 0]);
    const T = s.tick;
    tick(s, [0, 0]);                                       // solta em T+1
    const ev: GameEvent[] = [];
    while (s.tick < T + 8) ev.push(...tick(s, [0, 0]));
    ev.push(...tick(s, [BTN.A, 0]));                        // aperta de novo em T+9
    ev.push(...run(s, 5, [BTN.A, 0]));
    expect(ev.some(e => e.type === 'throw')).toBe(false);
    expect([p.carry, p.act]).toEqual([b.id, 'carryIdle']);
  });

  it('arremessar: 20 ticks na pose, anda em T+21', () => {
    const { s, p } = withBomb();
    tick(s, [BTN.A, 0]); run(s, 12, [BTN.A, 0]);
    expect(tick(s, [0, 0]).some(e => e.type === 'throw')).toBe(true);   // T'
    const x0 = p.x;
    const moved: boolean[] = [];
    for (let k = 1; k <= 21; k++) { tick(s, [BTN.RIGHT, 0]); moved.push(p.x !== x0); }
    expect(moved.slice(0, 20)).toEqual(Array(20).fill(false));
    expect(moved[20]).toBe(true);
  });

  it('largar com B: pose do B no tick T, parado em T+1, anda em T+2', () => {
    const { s, p } = withBomb();
    tick(s, [BTN.A, 0]); run(s, 12, [BTN.A, 0]);
    tick(s, [BTN.A | BTN.B, 0]);                            // T
    expect([p.carry, p.act]).toEqual([-1, 'detonate']);
    const x0 = p.x;
    tick(s, [BTN.A | BTN.RIGHT, 0]);
    expect(p.x).toBe(x0);                                   // T+1
    tick(s, [BTN.A | BTN.RIGHT, 0]);
    expect(p.x).not.toBe(x0);                               // T+2
  });

  describe('pegar jogador (rota $C2:3DD9 → $C2:3E92)', () => {
    function pair(face: 0 | 2 | 4 | 6) {
      const s = arena({ players: 2 });
      const p = put(s, 0, 4, 3); p.glove = true; p.face = face;
      const q = put(s, 1, 4, 3);
      return { s, p, q };
    }
    it('mesma trava de 8 ticks do levantar: quem segura anda em T+9', () => {
      const { s, p } = pair(2);
      tick(s, [BTN.A, 0]);
      const x0 = p.x;
      const moved: boolean[] = [];
      for (let k = 1; k <= 9; k++) { tick(s, [BTN.A | BTN.RIGHT, 0]); moved.push(p.x !== x0); }
      expect(moved.slice(0, 8)).toEqual(Array(8).fill(false));
      expect(moved[8]).toBe(true);
    });
    it('quem é pego sobe em 8 ticks (z 3..16, balançando ±8 px para o lado em que se olha) e dá um pulo de 3 px em T+8', () => {
      const dzs = [3, 6, 8, 10, 12, 14, 15, 16, 19, 16, 16];
      const dxs = [2, 4, 6, 8, 6, 4, 2, 0, 2, 0, 0];
      for (const [face, sx] of [[2, 1], [6, -1], [0, 0], [4, 0]] as const) {
        const { s, p, q } = pair(face);
        const got: [number, number][] = [];
        tick(s, [BTN.A, 0]);
        got.push([(q.x - p.x) / 256, q.z]);
        for (let k = 1; k < dzs.length; k++) { tick(s, [BTN.A, 0]); got.push([(q.x - p.x) / 256, q.z]); }
        expect(got, `face ${face}`).toEqual(dzs.map((z, k) => [dxs[k] * sx + 0, z]));
      }
    });
  });
});
