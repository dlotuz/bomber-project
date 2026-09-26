import { arena, put, setCell, C } from './kit';
import { playerActions, tickAct, startPPunch } from '../../src/core/actions';
import { BTN, CODE, type GameEvent, type Player, type RoundState } from '../../src/core/types';
import { centerX } from '../../src/core/units';
import { setAct } from '../../src/core/state';
import { MOUNTS, NO_MOUNT } from '../../src/core/mounts';
import { STAGES } from '../../src/core/stages';

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
    STAGES[1] = { outOfBounds: () => { calls++; } };
    try {
      const s = arena(); const p = put(s, 0, 4, 3); const q = put(s, 1, 5, 3); p.face = 2;
      startPPunch(s, p, []);
      ticks(s, [p, q], 12);
    } finally { STAGES[1] = {}; }
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
  it('B: pose de detonar por 3 ticks, mesmo sem remota', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    playerActions(s, p, BTN.B, BTN.B, 0, []);
    expect([p.act, p.actLeft]).toEqual(['detonate', 3]);
  });
  it('Y: a montaria tem precedência sobre o P', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.pItem = true;
    MOUNTS.current = { ...NO_MOUNT, onY: () => true };
    try { playerActions(s, p, BTN.Y, BTN.Y, 0, []); } finally { MOUNTS.current = NO_MOUNT; }
    expect(p.act).toBe('idle');
  });
});
