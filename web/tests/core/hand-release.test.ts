// O que a luva segura sai da mão quando o jogador é incapacitado. ROM: os pedidos de dança ($C2:4C88, nota da montaria
// F — o "soneca"), atordoamento ($C2:4C6F), empurrão do P ($C2:4C41), morte ($C2:4BB1) e o pulo da gangorra
// ($C2:1C68) chamam $C2:4BC4, o mesmo do B da luva: bomba → +$8C = 0 ($C2:4BFE), +$1C = 9, script de 1 casa ($C1:2579)
// da mão até a casa da frente, 11 passos a partir do próprio tick (parada em T+10); jogador → +$C2 |= $10 (como no B).
// O tiro lento (E) só grava +$E4/+$E6 e a esteira da arena 6 ($C2:1674 → $C2:1D3F) não chama $C2:4BC4: continua
// segurando. Emulador: analise/investigacao/aj-socoluva (incap.py, grabrel.py, throwt.py).
import { arena, put, run, C } from './kit';
import { addBomb } from '../../src/core/bombs';
import { punchBomb } from '../../src/core/flyers';
import { stunPlayer } from '../../src/core/hit';
import { BTN, CODE, type RoundState } from '../../src/core/types';
import { playerCell } from '../../src/core/state';
import { ride } from '../mounts/helpers';
import { ABILITY_F } from '../../src/core/mounts/abilities/typeF';
import type { MountProjectile } from '../../src/core/mounts/types';
import '../../src/core/stages';
import { stageArena } from '../stages/kit';

const A = BTN.A;
/** Slot `slot` com luva em (col, lin) olhando para `face`, já segurando a própria bomba (A segurado). */
function holder(s: RoundState, slot: number, col: number, lin: number, face: 0 | 2 | 4 | 6) {
  const p = put(s, slot, col, lin); p.glove = true; p.face = face;
  const b = addBomb(s, slot, C(col, lin), { fuse: 150 });
  const inp = [0, 0, 0, 0, 0]; inp[slot] = A;
  run(s, 1, inp); run(s, 12, inp);
  expect([p.carry, p.act]).toEqual([b.id, 'carryIdle']);
  return { p, b, inp };
}
/** Ticks até a bomba `b` parar (−1 = não parou em `max`). */
function untilIdle(s: RoundState, b: { state: string }, inp: number[], max = 40): number {
  for (let k = 1; k <= max; k++) { run(s, 1, inp); if (b.state === 'idle') return k; }
  return -1;
}

describe('incapacitado com a bomba na mão ($C2:4BC4)', () => {
  it('soneca (nota da montaria F): dança e a bomba cai da mão na casa da frente em T+10', () => {
    const s = arena({ players: 3, rules: { active: [true, false, true, false, false] } });
    const sh = put(s, 0, 2, 1); sh.face = 2;
    ride(s, 0, 0xf);
    const { p, b, inp } = holder(s, 2, 5, 1, 2);
    run(s, 1, [BTN.Y, 0, A, 0, 0]);
    let k = 0;
    while (p.act !== 'dance' && k++ < 200) run(s, 1, inp);
    expect(p.act).toBe('dance');
    expect([p.carry, b.state]).toEqual([-1, 'air']);
    expect(s.flyers.find(f => f.ref === b.id)?.flight).toBe('throw1');
    expect(untilIdle(s, b, inp)).toBe(10);
    expect([b.cell, s.grid[C(6, 1)]]).toEqual([C(6, 1), CODE.BOMB]);
    expect(p.act).toBe('dance');
  });

  // A nota é dada direto no alvo (estado 'cloud' com `target`, o tick seguinte ao acerto): andando, a nota do núcleo
  // acerta primeiro quem está na mão (achado à parte, não conferido na ROM).
  it('soneca segurando um jogador: ele é largado como no B (`dropped`)', () => {
    const s = arena({ players: 3 });
    const p = put(s, 2, 5, 1); p.glove = true; p.face = 2;
    const q = put(s, 1, 5, 1);
    run(s, 1, [0, 0, A]); run(s, 12, [0, 0, A]);
    expect([p.grab, q.heldBy]).toEqual([1, 2]);
    const pr: MountProjectile = { id: 1, kind: 0xf, owner: 0, x: p.x, y: p.y, dir: 2, born: s.tick - 80, state: 'cloud', t: s.tick, slot: 0, target: 2 };
    s.tick++;
    ABILITY_F.tickProjectile!(s, pr, []);
    expect(p.act).toBe('dance');
    expect([p.grab, q.heldBy, q.act]).toEqual([-1, -1, 'dropped']);
  });

  it('bomba socada na cabeça (atordoado): a da mão cai na casa da frente em T+10, não na hora', () => {
    const s = arena({ players: 2 });
    const { p, b, inp } = holder(s, 1, 8, 1, 6);
    const q = put(s, 0, 4, 1); q.punch = true; q.face = 2;
    addBomb(s, 0, C(5, 1));
    punchBomb(s, q, []);
    let k = 0;
    while (p.act !== 'stunned' && k++ < 60) run(s, 1, [0, A]);
    expect([p.carry, b.state]).toEqual([-1, 'air']);
    expect(untilIdle(s, b, [0, A])).toBe(10);
    expect(b.cell).toBe(C(7, 1));
    void inp;
  });

  it('empurrado pelo P: a bomba sai da mão no início do empurrão ($C2:4C14)', () => {
    const s = arena({ players: 2 });
    const { p, b } = holder(s, 1, 5, 1, 2);
    const q = put(s, 0, 4, 1); q.pItem = true; q.face = 2;
    run(s, 1, [BTN.Y, A]);
    expect(p.act).toBe('pushed');
    expect([p.carry, b.state]).toEqual([-1, 'air']);
  });

  it('morrendo na chama: a bomba cai da mão na casa da frente ($C2:4BB1), não fica na casa dele', () => {
    const s = arena({ players: 3 });                   // 3 jogadores: com 2, a morte encerra a rodada e congela os voadores
    const { p, b, inp } = holder(s, 0, 4, 1, 2);
    put(s, 1, 12, 9); put(s, 2, 12, 11);
    s.grid[C(4, 1)] = CODE.FLAME; s.cellT0[C(4, 1)] = s.tick;
    run(s, 1, inp);
    expect(p.state).toBe('dying');
    expect([p.carry, b.state]).toEqual([-1, 'air']);
    expect(untilIdle(s, b, inp)).toBe(10);
    expect(b.cell).toBe(C(5, 1));
  });

  it('atordoado segurando um jogador: ele é largado como no B (`dropped`), não fica livre na hora', () => {
    const s = arena({ players: 2 });
    const p = put(s, 0, 4, 1); p.glove = true; p.face = 2;
    const q = put(s, 1, 4, 1);
    run(s, 1, [A, 0]); run(s, 12, [A, 0]);
    expect(p.grab).toBe(1);
    stunPlayer(s, p, []);
    expect([p.grab, q.heldBy, q.act]).toEqual([-1, -1, 'dropped']);
  });

  it('tiro lento (E): continua segurando ($C1:2EDA só grava +$E4/+$E6)', () => {
    const s = arena({ players: 3, rules: { active: [true, false, true, false, false] } });
    const sh = put(s, 0, 2, 1); sh.face = 2;
    ride(s, 0, 0xe);
    const { p, b, inp } = holder(s, 2, 5, 1, 2);
    run(s, 1, [BTN.Y, 0, A, 0, 0]);
    let k = 0;
    while (p.effect.kind !== 2 && k++ < 60) run(s, 1, inp);
    expect(p.effect.kind).toBe(2);
    run(s, 3, inp);
    expect(p.carry).toBe(b.id);
  });

  it('B da luva e soco com bomba na mão: a mesma queda de 1 casa em T+10', () => {
    for (const btn of [BTN.B, BTN.Y]) {
      const s = arena({ players: 2 });
      put(s, 1, 12, 9);
      const { p, b, inp } = holder(s, 0, 4, 1, 2);
      p.punch = true;
      run(s, 1, [A | btn, 0]);
      expect(s.flyers.find(f => f.ref === b.id)?.flight).toBe('throw1');
      expect(untilIdle(s, b, inp)).toBe(10);
      expect(b.cell).toBe(C(5, 1));
    }
  });

  it('gangorra (arena 9): lançado com a bomba na mão, ela cai na frente ($C2:1C68)', () => {
    const s = stageArena(9);
    const { p, b } = holder(s, 1, 4, 3, 2);            // na ponta A da gangorra (4,3)-(6,3)
    put(s, 0, 6, 4);                                   // o P1 sobe na ponta B e lança o P2
    for (let i = 0; i < 40 && p.act !== 'launched'; i++) run(s, 1, st => [playerCell(st.players[0]) === C(6, 3) ? 0 : BTN.UP, A, 0, 0, 0]);
    expect(p.act).toBe('launched');
    expect([p.carry, b.state]).toEqual([-1, 'air']);
  });
});
