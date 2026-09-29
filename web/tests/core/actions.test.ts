import { arena, put, setCell, C, withStage, withMount } from './kit';
import { playerActions, tickAct, startPPunch } from '../../src/core/actions';
import { BTN, CODE, type GameEvent, type Player, type RoundState } from '../../src/core/types';
import { centerX } from '../../src/core/units';
import { setAct } from '../../src/core/state';
import { addBomb } from '../../src/core/bombs';
import { startLift, tickFlyers } from '../../src/core/flyers';
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
  describe('luva: B larga a bomba da mão na casa da frente', () => {
    function drop(setup: (s: RoundState) => void) {
      const s = arena(); const p = put(s, 0, 4, 1); p.glove = true; p.face = 2; setup(s);
      const b = addBomb(s, 0, C(4, 1)); startLift(s, p, []); setAct(s, p, 'carryIdle');
      const ev: GameEvent[] = [];
      playerActions(s, p, BTN.A | BTN.B, BTN.B, 0, ev);
      expect([p.carry, p.act]).toEqual([-1, 'idle']);
      playerActions(s, p, 0, 0, BTN.A, ev);                        // soltar A depois não arremessa nada
      expect(p.act).not.toBe('throw');
      for (let i = 0; i < 20; i++) { s.tick++; tickFlyers(s, ev); }
      return { s, b, ev };
    }
    it('casa livre: cai nela', () => {
      const { b } = drop(() => {});
      expect([b.state, b.cell]).toEqual(['idle', C(5, 1)]);
    });
    it('parede na frente: salta mais uma casa', () => {
      const { b } = drop(s => setCell(s, 5, 1, CODE.HARD));
      expect([b.state, b.cell]).toEqual(['idle', C(6, 1)]);
    });
    it('jogador na frente: é atordoado e a bomba cai na casa seguinte', () => {
      const { s, b, ev } = drop(s => put(s, 1, 5, 1));
      expect(ev).toContainEqual({ type: 'stunned', slot: 1 });
      expect([s.players[1].act, b.state, b.cell]).toEqual(['stunned', 'idle', C(6, 1)]);
    });
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
