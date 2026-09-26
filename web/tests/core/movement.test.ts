import { arena, put, setCell, C } from './kit';
import { moveStep, movePlayer, blockedFor, nibble } from '../../src/core/movement';
import { BTN, CODE, type GameEvent } from '../../src/core/types';
import { px, centerX, centerY, cellAt } from '../../src/core/units';
import { STAGES } from '../../src/core/stages';

function walk(col: number, lin: number, dx: number, btn: number, n: number, level = 1): [number, number][] {
  const s = arena();
  const p = put(s, 0, col, lin, dx, 0);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) { moveStep(s, p, btn, level); out.push([px(p.x) - px(centerX(col)), px(p.y) - px(centerY(lin))]); }
  return out;
}

describe('assistência de canto (t100, nível 1, para baixo)', () => {
  const OPEN: [number, number, number[]][] = [   // dx, tick em que entra na linha 2 (y ≥ +9), x nos 8 primeiros ticks
    [-9, 11, [-8, -7, -6, -5, -4, -3, -2, -1]], [-8, 10, [-7, -6, -5, -4, -3, -2, -1, 0]],
    [-7, 9, [-6, -5, -4, -3, -2, -1, 0, 0]], [-4, 9, [-3, -2, -1, -1, -1, -1, 0, 0]],
    [-3, 9, [-3, -2, -1, -1, -1, -1, 0, 0]], [-1, 9, [-1, 0, 0, 0, 0, 0, 0, 0]], [0, 9, [0, 0, 0, 0, 0, 0, 0, 0]],
    [1, 9, [1, 0, 0, 0, 0, 0, 0, 0]], [3, 9, [3, 2, 1, 1, 1, 1, 0, 0]], [4, 9, [3, 2, 1, 1, 1, 1, 0, 0]],
    [7, 9, [6, 5, 4, 3, 2, 1, 0, 0]], [8, 10, [7, 6, 5, 4, 3, 2, 1, 0]], [9, 11, [8, 7, 6, 5, 4, 3, 2, 1]],
  ];
  it.each(OPEN)('abertura (col 4, lin 1), dx=%i: entra no tick %i', (dx, enter, x8) => {
    const tr = walk(4, 1, dx, BTN.DOWN, 20);
    expect(tr.findIndex(([, y]) => y >= 9) + 1).toBe(enter);
    expect(tr.slice(0, 8).map(([x]) => x)).toEqual(x8);
  });
  it('pilar à frente (col 3, lin 1), |dx| ≤ 3: não anda', () => {
    for (const dx of [-3, -2, -1, 0, 1, 2, 3]) expect(walk(3, 1, dx, BTN.DOWN, 30)[29]).toEqual([dx, 0]);
  });
  it('pilar à frente, |dx| ≥ 4: desliza 1 px/tick e entra em diagonal', () => {
    expect(walk(3, 1, 4, BTN.DOWN, 30).slice(0, 6)).toEqual([[5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 1]]);
    expect(walk(3, 1, -4, BTN.DOWN, 30).slice(0, 6)).toEqual([[-5, 0], [-6, 0], [-7, 0], [-8, 0], [-9, 0], [-10, 1]]);
    const finals: [number, [number, number]][] = [[-9, [-16, 30]], [-8, [-16, 29]], [-6, [-16, 27]], [-4, [-16, 25]], [4, [16, 25]], [7, [16, 28]], [9, [16, 30]]];
    for (const [dx, f] of finals) expect(walk(3, 1, dx, BTN.DOWN, 30)[29]).toEqual(f);
  });
  it('parede ou bloco à frente, alinhado: para no centro', () => {
    const s = arena(); setCell(s, 4, 2, CODE.SOFT);
    const p = put(s, 0, 4, 1);
    for (let i = 0; i < 20; i++) moveStep(s, p, BTN.DOWN, 1);
    expect([p.x, p.y]).toEqual([centerX(4), centerY(1)]);
  });
});

describe('velocidade e regras', () => {
  it('nível 1 = 1 px/tick; nível 5 = 1,5; nível 6 = 2; nível 7 = 0,5 (linha 1 livre)', () => {
    for (const [lv, dist] of [[1, 60], [5, 90], [6, 120], [7, 30]] as const) {
      const s = arena(); const p = put(s, 0, 2, 1);
      for (let i = 0; i < 60; i++) moveStep(s, p, BTN.RIGHT, lv);
      expect(p.x - centerX(2)).toBe(dist * 256);
    }
  });
  it('parado zera as frações', () => {
    const s = arena(); const p = put(s, 0, 2, 1);
    for (let i = 0; i < 3; i++) moveStep(s, p, BTN.RIGHT, 7);
    expect(p.x & 0xff).toBe(0x80);
    expect(moveStep(s, p, 0, 7)).toBe(8);
    expect(p.x & 0xff).toBe(0);
  });
  it('nibble do direcional: R1 L2 D4 U8', () => {
    expect([nibble(BTN.RIGHT), nibble(BTN.LEFT), nibble(BTN.DOWN), nibble(BTN.UP), nibble(BTN.UP | BTN.RIGHT | BTN.A)]).toEqual([1, 2, 4, 8, 9]);
  });
  it('bloqueio pelos bits: soft/bomba/queimando/pressão/parede bloqueiam; item, chama e piso não', () => {
    const p = arena().players[0];
    const b = (v: number) => blockedFor(p, v)[0];
    expect([CODE.HARD, CODE.SOFT, CODE.BOMB, CODE.BURNING, CODE.PRESSURE].map(b)).toEqual([true, true, true, true, true]);
    expect([CODE.FLOOR, CODE.FLAME, 0x0941, 0x09a1, CODE.FALLING, CODE.ARROW, CODE.ORB].map(b)).toEqual([false, false, false, false, false, false, false]);
    expect(blockedFor(p, CODE.BOMB)).toEqual([true, true]);
    p.passSoft = true; p.passBomb = true;
    expect([b(CODE.SOFT), b(CODE.BOMB), b(CODE.HARD)]).toEqual([false, false, true]);
  });
  it('bomba na casa à frente: sem atravessa-bomba para no centro; com atravessa-bomba (+$4C) entra e passa', () => {
    for (const pass of [false, true]) {
      const s = arena(); const p = put(s, 0, 4, 1); p.passBomb = pass;
      setCell(s, 5, 1, CODE.BOMB);
      const ev: GameEvent[] = [];
      for (let i = 0; i < 8; i++) moveStep(s, p, BTN.RIGHT, 1);
      for (let i = 0; i < 12; i++) movePlayer(s, p, BTN.RIGHT, ev);
      if (pass) {
        expect(p.x - centerX(4)).toBe(20 * 256);
        expect(cellAt(p.x, p.y)).toBe(C(5, 1));
      } else {
        expect([p.x, p.y]).toEqual([centerX(4), centerY(1)]);
        expect(p.face).toBe(2);
      }
    }
  });
  it('bomba na própria casa não prende; depois de sair não volta', () => {
    const s = arena(); const p = put(s, 0, 5, 1);
    setCell(s, 5, 1, CODE.BOMB);
    for (let i = 0; i < 16; i++) moveStep(s, p, BTN.RIGHT, 1);
    expect(cellAt(p.x, p.y)).toBe(C(6, 1));
    for (let i = 0; i < 30; i++) moveStep(s, p, BTN.LEFT, 1);
    expect(cellAt(p.x, p.y)).toBe(C(6, 1));
  });
});

describe('movePlayer', () => {
  it('face segue a direção (diagonal fica no horizontal); act walk/idle; actT0 reinicia', () => {
    const s = arena(); const p = put(s, 0, 2, 1); const ev: GameEvent[] = [];
    s.tick = 200; movePlayer(s, p, BTN.RIGHT | BTN.DOWN, ev);
    expect([p.face, p.act, p.actT0]).toEqual([2, 'walk', 200]);
    s.tick = 201; movePlayer(s, p, 0, ev);
    expect([p.act, p.moveDir, p.actT0]).toEqual(['idle', 8, 201]);
  });
  it('contra a parede continua olhando para ela', () => {
    const s = arena(); const p = put(s, 0, 2, 1); const ev: GameEvent[] = [];
    movePlayer(s, p, BTN.UP, ev);
    expect(p.face).toBe(0);
  });
  it('footstep a cada 20 ticks andando', () => {
    const s = arena(); const p = put(s, 0, 2, 1); const ev: GameEvent[] = [];
    for (let i = 0; i < 60; i++) { s.tick++; movePlayer(s, p, BTN.RIGHT, ev); }
    expect(ev.filter(e => e.type === 'footstep').length).toBe(3);
  });
  it('com bomba na mão: carryWalk/carryIdle', () => {
    const s = arena(); const p = put(s, 0, 2, 1); p.carry = 7; const ev: GameEvent[] = [];
    movePlayer(s, p, BTN.RIGHT, ev); expect(p.act).toBe('carryWalk');
    movePlayer(s, p, 0, ev); expect(p.act).toBe('carryIdle');
  });
  it('usa o nível da doença/efeito (speedLevel) e chama onEnterCell/onStand', () => {
    const s = arena(); const p = put(s, 0, 2, 1); const ev: GameEvent[] = [];
    const entered: number[] = []; let stood = 0;
    STAGES[1] = { onEnterCell: (_s, _p, c) => { entered.push(c); }, onStand: () => { stood++; } };
    try {
      for (let i = 0; i < 16; i++) movePlayer(s, p, BTN.RIGHT, ev);
      expect(entered).toEqual([C(3, 1)]);
      expect(stood).toBe(16);
    } finally { STAGES[1] = {}; }
  });
});
