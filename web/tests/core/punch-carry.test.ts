// Y do soco (e do P) com bomba (ou jogador) na mão. ROM (st_arena05, P1 com luva e soco; scripts em
// analise/investigacao/aj-socoluva): segurar usa o estado normal $C2:141C, que chama o soco $C2:48E1 sem olhar +$8C.
// O Y então solta o que está na mão por $C2:4BC4 — o mesmo do B ($C2:3721): +$8C = 0, bomba +$1C = 9, cai na casa da
// frente ($C1:26C9) — e só então entra na pose do soco ($C2:22C9) ou do P ($C2:2216, que solta em $C2:4A4E).
// Ninguém soca com a bomba na mão. Levantando ($C2:3692) e arremessando ($C2:3882) o soco não é chamado: Y não faz nada.
import { arena, put, run, C } from './kit';
import { addBomb } from '../../src/core/bombs';
import { BTN, CODE, type GameEvent, type RoundState } from '../../src/core/types';
import { playerCell } from '../../src/core/state';

/** P0 com luva e soco em (4,1) olhando para a direita, já segurando a própria bomba (A segurado). */
function carrying(opts: { front?: boolean; pItem?: boolean; powerKey?: boolean } = {}) {
  const s = arena({ players: 2, rules: opts.powerKey ? { powerKey: [true, false, false, false, false] } : {} });
  const p = put(s, 0, 4, 1); p.glove = true; p.punch = true; p.face = 2; p.pItem = !!opts.pItem;
  put(s, 1, 12, 9);
  const held = addBomb(s, 0, C(4, 1));
  const front = opts.front ? addBomb(s, 1, C(5, 1)) : undefined;
  run(s, 1, [BTN.A, 0]);
  run(s, 12, [BTN.A, 0]);
  expect([p.carry, p.act]).toEqual([held.id, 'carryIdle']);
  return { s, p, held, front };
}
/** Roda até não haver voador (ou `max` ticks), com A ainda segurado. */
function settle(s: RoundState, max = 80): GameEvent[] {
  const ev: GameEvent[] = [];
  for (let i = 0; i < max && s.flyers.length; i++) ev.push(...run(s, 1, [BTN.A, 0]));
  return ev;
}

describe('soco com bomba na mão ($C2:48E1 → $C2:4BC4)', () => {
  it('sem bomba à frente: Y larga a bomba na casa da frente (como o B) e faz a pose do soco', () => {
    const { s, p, held } = carrying();
    run(s, 1, [BTN.A | BTN.Y, 0]);
    expect([p.carry, p.act, p.actLeft]).toEqual([-1, 'punch', 8]);
    expect(held.state).toBe('air');
    settle(s);
    expect([held.state, held.cell, s.grid[C(5, 1)]]).toEqual(['idle', C(5, 1), CODE.BOMB]);
    expect(p.carry).toBe(-1);
  });

  it('com bomba à frente: a da frente é socada (3 casas) e a da mão cai na casa da frente', () => {
    const { s, p, held, front } = carrying({ front: true });
    const ev = run(s, 1, [BTN.A | BTN.Y, 0]);
    expect(ev).toContainEqual({ type: 'punch', slot: 0 });
    expect([p.carry, p.act]).toEqual([-1, 'punch']);
    settle(s);
    expect([front!.state, front!.cell]).toEqual(['idle', C(8, 1)]);
    expect([held.state, held.cell]).toEqual(['idle', C(5, 1)]);
  });

  it('a pose do soco termina sem bomba: volta a `idle`, não a `carryIdle`', () => {
    const { s, p } = carrying();
    run(s, 1, [BTN.A | BTN.Y, 0]);
    run(s, 8, [BTN.A, 0]);
    expect([p.carry, p.act]).toEqual([-1, 'idle']);
  });

  it('levantando (8 ticks em $C2:3692): Y não soca nem larga, e não fica guardado para depois', () => {
    const s = arena({ players: 2 });
    const p = put(s, 0, 4, 1); p.glove = true; p.punch = true; p.face = 2;
    put(s, 1, 12, 9);
    const held = addBomb(s, 0, C(4, 1));
    const front = addBomb(s, 1, C(5, 1));
    run(s, 1, [BTN.A, 0]);
    expect(p.act).toBe('lift');
    run(s, 1, [BTN.A | BTN.Y, 0]);
    run(s, 1, [BTN.A, 0]);
    run(s, 4, [BTN.A | BTN.Y, 0]);
    expect([p.act, p.carry]).toEqual(['lift', held.id]);
    run(s, 4, [BTN.A | BTN.Y, 0]);            // Y segurado desde o levantar: não é aperto novo
    expect([p.act, p.carry, front.state]).toEqual(['carryIdle', held.id, 'idle']);
    expect(s.flyers.length).toBe(0);
  });

  it('arremessando (20 ticks em $C2:3882): Y não soca a bomba da frente', () => {
    const { s, p, front } = carrying({ front: true });
    run(s, 1, [0, 0]);                         // solta A: arremessa
    expect(p.act).toBe('throw');
    for (let k = 0; k < 19; k++) {
      run(s, 1, [k % 2 ? BTN.Y : 0, 0]);
      expect(p.act).toBe('throw');
    }
    expect(front!.state).toBe('idle');
  });

  it('com o P (Y faz o P): solta a bomba ($C2:4A4E); ele avança, ela cai nele e o atordoa e quica para a casa seguinte', () => {
    const { s, p, held } = carrying({ pItem: true });
    const ev = run(s, 1, [BTN.A | BTN.Y, 0]);
    expect(ev).toContainEqual({ type: 'p_punch', slot: 0 });
    expect([p.carry, p.act]).toEqual([-1, 'pPunch']);
    ev.push(...settle(s));
    expect(playerCell(p)).toBe(C(5, 1));
    expect(ev.some(e => e.type === 'stunned' && e.slot === 0)).toBe(true);
    expect([held.state, held.cell]).toEqual(['idle', C(6, 1)]);
  });

  it('tecla própria do P (extra): POWER com bomba na mão também solta a bomba antes do golpe', () => {
    const { s, p, held } = carrying({ pItem: true, powerKey: true });
    run(s, 1, [BTN.A | BTN.POWER, 0]);
    expect([p.carry, p.act]).toEqual([-1, 'pPunch']);
    expect(held.state).toBe('air');
  });

  it('tecla própria do P: Y fica só com o soco e também solta a bomba', () => {
    const { s, p, held } = carrying({ pItem: true, powerKey: true });
    run(s, 1, [BTN.A | BTN.Y, 0]);
    expect([p.carry, p.act]).toEqual([-1, 'punch']);
    expect(held.state).toBe('air');
  });

  it('segurando um jogador: Y o larga (mesmo $C2:4BC4) e soca', () => {
    const s = arena({ players: 2 });
    const p = put(s, 0, 4, 1); p.glove = true; p.punch = true; p.face = 2;
    const q = put(s, 1, 4, 1);
    run(s, 1, [BTN.A, 0]);
    run(s, 12, [BTN.A, 0]);
    expect([p.grab, q.heldBy]).toEqual([1, 0]);
    run(s, 1, [BTN.A | BTN.Y, 0]);
    expect([p.grab, q.heldBy, p.act]).toEqual([-1, -1, 'punch']);
  });

  it('sem o item do soco, Y com bomba na mão não faz nada ($C2:48F7: +$48 = 0 sai com CLC)', () => {
    const { s, p, held } = carrying();
    p.punch = false;
    run(s, 1, [BTN.A | BTN.Y, 0]);
    expect([p.carry, p.act]).toEqual([held.id, 'carryIdle']);
  });
});
