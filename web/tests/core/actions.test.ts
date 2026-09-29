import { arena, put, setCell, C, withStage, withMount } from './kit';
import { playerActions, tickAct, startPPunch } from '../../src/core/actions';
import { BTN, CODE, type GameEvent, type Player, type RoundState } from '../../src/core/types';
import { centerX } from '../../src/core/units';
import { setAct } from '../../src/core/state';
import { addBomb } from '../../src/core/bombs';
import { startLift } from '../../src/core/flyers';
import { NO_MOUNT } from '../../src/core/mounts';

function ticks(s: RoundState, ps: Player[], n: number, ev: GameEvent[] = []): GameEvent[] {
  for (let i = 0; i < n; i++) { s.tick++; for (const p of ps) playerActions(s, p, 0, 0, 0, ev); }
  return ev;
}

describe('golpe P (t45, t46)', () => {
  it('avança 16 px em 4 ticks e empurra quem está na casa da frente 48 px em 12 ticks', () => {
    const s = arena(); const p = put(s, 0, 4, 1); const q = put(s, 1, 5, 1);
    p.pItem = true; p.face = 2;
    const ev: GameEvent[] = [];
    playerActions(s, p, BTN.Y, BTN.Y, 0, ev);
    expect([p.act, p.actLeft]).toEqual(['pPunch', 35]);
    expect(ev).toContainEqual({ type: 'p_punch', slot: 0 });
    expect([q.act, q.push.left]).toEqual(['pushed', 12]);
    ticks(s, [p, q], 4);
    expect(p.x).toBe(centerX(5));
    ticks(s, [p, q], 8);
    expect(q.x).toBe(centerX(8));
    ticks(s, [p, q], 30);
    expect([p.act, q.act]).toEqual(['idle', 'idle']);
  });
  it('a vítima para alinhada antes de soft', () => {
    const s = arena(); const p = put(s, 0, 4, 1); const q = put(s, 1, 5, 1);
    setCell(s, 7, 1, CODE.SOFT);
    p.face = 2; startPPunch(s, p, []);
    ticks(s, [p, q], 12);
    expect(q.x).toBe(centerX(6));
  });
  it('contra parede dura o avanço não sai do lugar', () => {
    const s = arena(); const p = put(s, 0, 14, 1); p.face = 2;
    startPPunch(s, p, []);
    ticks(s, [p], 4);
    expect(p.x).toBe(centerX(14));
  });
  it('cada tick de movimento forçado (4 do avanço + 12 da vítima) consulta outOfBounds da arena', () => {
    let calls = 0;
    withStage(1, { outOfBounds: () => { calls++; } }, () => {
      const s = arena(); const p = put(s, 0, 4, 3); const q = put(s, 1, 5, 3); p.face = 2;
      startPPunch(s, p, []);
      ticks(s, [p, q], 12);
    });
    expect(calls).toBe(16);
  });
});

describe('máquina de ação', () => {
  it('ação travada dura exatamente actLeft ticks e volta para idle', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    setAct(s, p, 'throw', 20);
    const locked: boolean[] = [];
    for (let i = 0; i < 21; i++) { s.tick++; locked.push(tickAct(s, p, [])); }
    expect(locked.filter(Boolean).length).toBe(20);
    expect(locked[20]).toBe(false);
    expect(p.act).toBe('idle');
  });
  it('travado não obedece a Y', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.pItem = true;
    setAct(s, p, 'stunned', 10);
    playerActions(s, p, BTN.Y, BTN.Y, 0, []);
    expect(p.act).toBe('stunned');
  });
  it('soltar A durante o levantamento marca o arremesso para o fim dele', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    p.carry = 5; setAct(s, p, 'lift', 4);
    playerActions(s, p, 0, 0, BTN.A, []);
    expect(p.throwQueued).toBe(true);
  });
  it('luva: B com a bomba na mão larga na casa da frente; bloqueada, na própria', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.glove = true; p.face = 2;
    const b = addBomb(s, 0, C(4, 1)); startLift(s, p, []); setAct(s, p, 'carryIdle');
    playerActions(s, p, BTN.A | BTN.B, BTN.B, 0, []);
    expect([p.carry, p.act, b.state, b.cell, s.grid[C(5, 1)]]).toEqual([-1, 'idle', 'idle', C(5, 1), CODE.BOMB]);
    playerActions(s, p, BTN.A, 0, 0, []);
    playerActions(s, p, 0, 0, BTN.A, []);                          // soltar A depois não arremessa nada
    expect(p.act).not.toBe('throw');
    const s2 = arena(); const q = put(s2, 0, 4, 1); q.glove = true; q.face = 2;
    setCell(s2, 5, 1, CODE.HARD);
    const b2 = addBomb(s2, 0, C(4, 1)); startLift(s2, q, []); setAct(s2, q, 'carryIdle');
    playerActions(s2, q, BTN.A | BTN.B, BTN.B, 0, []);
    expect([q.carry, b2.state, b2.cell]).toEqual([-1, 'idle', C(4, 1)]);
  });
  it('B: pose de detonar por 3 ticks, mesmo sem remota', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    playerActions(s, p, BTN.B, BTN.B, 0, []);
    expect([p.act, p.actLeft]).toEqual(['detonate', 3]);
  });
  it('Y: a montaria tem precedência sobre o P', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.pItem = true;
    withMount({ ...NO_MOUNT, onY: () => true }, () => playerActions(s, p, BTN.Y, BTN.Y, 0, []));
    expect(p.act).toBe('idle');
  });
});
