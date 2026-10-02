// Bomba rolando no caminho de quem anda (aj/stop2). Emulador (st_arena05; scratchpad/ajstop2/rvar.py, cross0.py):
// a casa do centro da bomba rolando (ocupação $4000 em +$2A, $C1:37C4) barra o movimento como uma bomba parada
// ($C2:3006 → $C2:3287 → $C2:3566: o tick de movimento é zerado). Com o item Chute (+$4A, não a montaria A sem o item;
// tipo 1 atravessa) e olhando para outro lado, a bomba vira para a face de quem andou ($C2:32FF), volta ao centro
// ($C2:330D) e recomeça o deslize ($C1:3467). Atravessa-bomba (+$4C) e tipo 1 entram e a bomba para sob eles.
import { arena, put, C } from './kit';
import { ride } from '../mounts/helpers';
import { step } from '../../src/core/step';
import { addBomb } from '../../src/core/bombs';
import { BTN, type Bomb, type GameEvent, type Player, type RoundState } from '../../src/core/types';
import { centerX, centerY } from '../../src/core/units';

/** P0 em (4,1) chuta para baixo a bomba do `owner` em (4,2), pela coluna 4. P1 em (2,5) anda para a direita `d` ticks
 *  depois do chute, por 60 ticks. Devolve o x do P1 e a bomba por tick depois do chute (como o script do emulador). */
function side(o: { d?: number; kick?: boolean; passBomb?: boolean; mount?: number; owner?: number } = {}) {
  const s = arena({ players: 3 });
  s.hidden = [];
  const p = put(s, 0, 4, 1); p.kick = true; p.face = 4;
  const q = put(s, 1, 2, 5); q.kick = !!o.kick; q.passBomb = !!o.passBomb;
  put(s, 2, 14, 11);
  if (o.mount !== undefined) ride(s, 1, o.mount);
  const b = addBomb(s, o.owner ?? 0, C(4, 2));
  const d = o.d ?? 0;
  const log = new Map<number, { qx: number; bx: number; by: number; st: Bomb['state']; dir: number }>();
  const ev: GameEvent[] = [];
  let tk = -1;
  for (let i = 0; i < 160; i++) {
    const inp = [tk < 0 ? BTN.DOWN : 0, tk >= 0 && i - tk - 1 >= d && i - tk - 1 < d + 60 ? BTN.RIGHT : 0, 0, 0, 0];
    ev.push(...step(s, inp));
    if (tk < 0 && b.state === 'kicked') tk = i;
    if (tk >= 0) log.set(i - tk, { qx: q.x / 256, bx: b.x / 256, by: b.y / 256, st: b.state, dir: b.dir });
  }
  return { s, b, q, log, ev };
}
const qxs = (log: ReturnType<typeof side>['log'], a: number, z: number): number[] =>
  Array.from({ length: z - a + 1 }, (_, k) => log.get(a + k)!.qx);

describe('bomba rolando barra quem anda (emulador: ajstop2/rvar.py)', () => {
  it('sem Chute: o P1 fica em x = 55 enquanto a casa do centro dela está na frente e a bomba segue até a parede', () => {
    for (const owner of [0, 2]) {
      const { b, log } = side({ owner });
      // ROM: x = 51..55 nos ticks 20–24, parado em 55 nos ticks 25–27, anda em 28 (a bomba já está em y = 120, lin 6)
      expect(qxs(log, 20, 30), `dono ${owner}`).toEqual([51, 52, 53, 54, 55, 55, 55, 55, 56, 57, 58]);
      expect([b.state, b.cell], `dono ${owner}`).toEqual(['idle', C(4, 11)]);   // ROM (64,200): pára antes da parede
    }
  });
  it('com Chute: a bomba vira para a face do P1 no tick 25, recomeça do centro e rola até a parede', () => {
    for (const d of [0, 1, 2]) {
      const { b, log, ev } = side({ d, kick: true, owner: 2 });
      const t = 25 + d;
      // ROM (d = 0): tick 24 (64,114) para baixo; tick 25 (66,112) para a direita (+1 px na conta da ROM)
      expect(log.get(t - 1)!.dir, `atraso ${d}`).toBe(4);
      expect([log.get(t)!.bx, log.get(t)!.by, log.get(t)!.dir], `atraso ${d}`).toEqual([centerX(4) / 256 + 2, centerY(5) / 256, 2]);
      expect(qxs(log, t - 1, t + 4), `atraso ${d}`).toEqual([55, 55, 55, 55, 55, 56]);   // anda quando ela sai da casa 4
      expect([b.state, b.cell], `atraso ${d}`).toEqual(['idle', C(14, 5)]);   // ROM (216,112)
      expect(ev.filter(e => e.type === 'bomb_kicked').map(e => (e as { slot: number }).slot), `atraso ${d}`).toEqual([0, 1]);
    }
  });
  it('chegou depois que a casa do centro passou: anda atrás dela, que segue', () => {
    const { b, log } = side({ d: 3, kick: true });
    expect(qxs(log, 24, 30)).toEqual([52, 53, 54, 55, 56, 57, 58]);   // ROM: igual, sem parar
    expect([b.state, b.cell]).toEqual(['idle', C(4, 11)]);
  });
  it('atravessa-bomba (com ou sem Chute) e montaria tipo 1: entra e a bomba para sob ele (ROM: x = 56 no tick 25)', () => {
    for (const o of [{ passBomb: true }, { passBomb: true, kick: true }, { mount: 0x1 }, { mount: 0x1, kick: true }]) {
      const { b, log } = side(o);
      expect([log.get(25)!.qx, b.state, b.cell], JSON.stringify(o)).toEqual([56, 'idle', C(4, 5)]);
    }
  });
  it('montado: a montaria A sem o item só barra; com o item (A ou tipo 0) desvia', () => {
    expect(side({ mount: 0xa }).b.cell).toBe(C(4, 11));
    expect(side({ mount: 0xa, kick: true }).b.cell).toBe(C(14, 5));
    expect(side({ mount: 0x0, kick: true }).b.cell).toBe(C(14, 5));
  });
});

describe('cruzamento (ROM: ajstop2/cross0.py): P2 sobe para a linha 1 enquanto a bomba rola para a direita', () => {
  function cross(d: number, kick: boolean): { b: Bomb; q: Player; s: RoundState } {
    const s = arena({ players: 2 });
    const p = put(s, 0, 2, 1); p.kick = true;
    const b = addBomb(s, 0, C(4, 1)); b.born = 0;
    const q = put(s, 1, 8, 2); q.kick = kick;
    let t0 = -1;
    for (let i = 0; i < 160; i++) {
      step(s, [t0 < 0 ? BTN.RIGHT : 0, t0 >= 0 && s.tick - t0 >= d && s.tick - t0 < d + 40 ? BTN.UP : 0, 0, 0, 0]);
      if (t0 < 0 && b.state === 'kicked') t0 = s.tick;
    }
    return { b, q, s };
  }
  it('sem Chute, atraso 20–27: o P2 espera, a bomba passa e vai até a parede (ROM: x = 216)', () => {
    for (let d = 20; d <= 27; d++) expect([cross(d, false).b.cell, cross(d, false).q.y / 256], `atraso ${d}`).toEqual([C(14, 1), 47]);
  });
  it('com Chute, atraso 20–27: a bomba vira para cima, bate na parede e para no centro de (8,1); o P2 fica em y = 56', () => {
    for (let d = 20; d <= 27; d++) {
      const { b, q } = cross(d, true);
      expect([b.state, b.cell, b.x, b.y, q.y / 256], `atraso ${d}`).toEqual(['idle', C(8, 1), centerX(8), centerY(1), 56]);
    }
  });
});
