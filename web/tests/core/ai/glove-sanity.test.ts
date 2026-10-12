// IA: bomba onde mais quebra blocos, luva sem "tacar igual doido" e arremesso/soco para encurralar.
import { arena, put, setCell, C } from '../kit';
import { createAi, aiInputs, AI_LEVELS } from '../../../src/core/ai';
import { trapsFoeAt } from '../../../src/core/ai/actions';
import { addBomb } from '../../../src/core/bombs';
import { step } from '../../../src/core/step';
import { CODE } from '../../../src/core/types';
import { lockAct } from '../../../src/core/mounts/core-api';

const CPU0 = [true, false, false, false, false];

describe('IA: onde soltar a bomba', () => {
  it('anda até a casa que quebra mais blocos em vez de soltar na primeira que quebra 1', () => {
    const s = arena(); put(s, 0, 4, 3); put(s, 1, 1, 9);
    setCell(s, 3, 3, CODE.SOFT);                                   // aqui (4,3): 1 bloco na cruz
    for (const [c, l] of [[9, 3], [8, 2], [8, 4]] as const) setCell(s, c, l, CODE.SOFT);   // (8,3): 3 blocos
    const ai = createAi();
    let at = -1;
    for (let i = 0; i < 400 && at < 0; i++) {
      step(s, aiInputs(s, ai, CPU0, 2));
      if (s.bombs.length) at = s.bombs[0].cell;
    }
    expect(at).toBe(C(8, 3));
  });
});

describe('IA: não fica parado atrás de lugar sem fuga', () => {
  it('a casa que quebra mais blocos é um beco sem saída: solta a bomba onde dá (nada de ficar parado)', () => {
    const s = arena(); const p = put(s, 0, 4, 3); put(s, 1, 1, 9);
    p.fire = 3 as never;                                           // cruz comprida: o beco (8,3) não tem como escapar
    setCell(s, 3, 3, CODE.SOFT);                                   // aqui: 1 bloco
    for (const [c, l] of [[9, 3], [8, 2], [8, 4], [6, 2], [6, 4]] as const) setCell(s, c, l, CODE.SOFT);   // (8,3): 3, num beco
    const ai = createAi();
    let at = -1;
    for (let i = 0; i < 400 && at < 0; i++) {
      step(s, aiInputs(s, ai, CPU0, 2));
      if (s.bombs.length) at = s.bombs[0].cell;
    }
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).not.toBe(C(8, 3));
  });
});

describe('IA: luva sem exagero', () => {
  it('encurralar: bomba que pousa tampando a única saída do adversário vale; em campo aberto, não', () => {
    const s = arena(); const p = put(s, 0, 8, 3); put(s, 1, 4, 3); p.glove = true;
    for (const [c, l] of [[3, 3], [5, 3], [4, 4]] as const) setCell(s, c, l, CODE.SOFT);   // só sobra a saída (4,2)
    const b = addBomb(s, 0, C(8, 3), { fire: 1 });
    expect(trapsFoeAt(s, p, b, C(4, 2))).toBe(true);
    const open = arena(); const q = put(open, 0, 8, 3); put(open, 1, 4, 3);
    const ob = addBomb(open, 0, C(8, 3), { fire: 1 });
    expect(trapsFoeAt(open, q, ob, C(4, 2))).toBe(false);
  });

  it('com um adversário parado do lado, não fica arremessando sem parar (folga entre uma e outra)', () => {
    const lv = AI_LEVELS[2], keep = { ...lv };
    Object.assign(lv, { dropKill: 0, dropStun: 100, grabFoe: 100 });
    try {
      const s = arena(); const p = put(s, 0, 4, 3); p.glove = true; p.face = 2; p.bombsFree = 3 as never;
      put(s, 1, 6, 3);
      const ai = createAi();
      let throws = 0;
      for (let i = 0; i < 900; i++) {
        const inp = aiInputs(s, ai, CPU0, 2);
        const ev = step(s, inp);
        throws += ev.filter(e => (e.type === 'throw') && e.slot === 0).length;
      }
      expect(throws).toBeLessThanOrEqual(5);
    } finally { Object.assign(lv, keep); }
  });
});

describe('IA: alvo fácil', () => {
  it('adversário dormindo (soneca): vai até ele, solta a bomba no pé e ele não escapa', () => {
    const s = arena(); put(s, 0, 4, 3); const q = put(s, 1, 8, 3);
    lockAct(s, q, 'dance', 192);
    const ai = createAi();
    let dead = -1;
    for (let i = 0; i < 330 && dead < 0; i++) {
      step(s, aiInputs(s, ai, CPU0, 2));
      if (s.players[1].state !== 'alive') dead = i;
    }
    expect(dead).toBeGreaterThanOrEqual(0);
    expect(s.players[0].state).toBe('alive');
  });

  it('já montado, vai estourar a montaria do adversário montado', () => {
    const s = arena(); const p = put(s, 0, 4, 3); const q = put(s, 1, 8, 3);
    const mount = () => ({ type: 2, slot: 1, phase: 'riding', t0: 0, reserves: [], trail: [], cooldown: 0, remount: false, remountFx: null }) as never;
    p.mount = mount(); q.mount = mount();
    const ai = createAi();
    let lost = false;
    for (let i = 0; i < 500 && !lost; i++) {
      const ev = step(s, aiInputs(s, ai, CPU0, 2));
      if (ev.some(e => (e as { type: string; id?: string; slot?: number }).id === 'mount_lost' && (e as { slot?: number }).slot === 1)
        || s.players[1].mount === null || (s.players[1].mount as { phase: string }).phase !== 'riding') lost = true;
    }
    expect(lost).toBe(true);
  });
});

describe('IA: caveira como única saída', () => {
  it('preso por blocos, com uma caveira como única saída: pisa nela em vez de ficar parado', () => {
    const s = arena(); const p = put(s, 0, 4, 3); put(s, 1, 1, 9);
    for (const [c, l] of [[3, 3], [4, 2], [4, 4]] as const) setCell(s, c, l, CODE.SOFT);
    setCell(s, 5, 3, 0x0980);                                      // caveira ($0980+id)
    const col0 = Math.floor((p.x >> 8) / 16);
    const ai = createAi();
    let left = false;
    for (let i = 0; i < 240 && !left; i++) {
      step(s, aiInputs(s, ai, CPU0, 2));
      if (Math.floor((s.players[0].x >> 8) / 16) !== col0) left = true;
    }
    expect(left).toBe(true);
  });
});

describe('IA: sacrificar a montaria', () => {
  it('duelo num corredor fechado: montada, solta a bomba mesmo sem fuga (a montaria absorve) e mata o outro', () => {
    const s = arena(); const p = put(s, 0, 4, 1); const q = put(s, 1, 4, 3);
    p.fire = 2 as never;
    for (const [c, l] of [[3, 1], [5, 1], [3, 3], [5, 3], [4, 4]] as const) setCell(s, c, l, CODE.SOFT);   // corredor (4,1)-(4,3)
    p.mount = { type: 2, slot: 1, phase: 'riding', t0: 0, reserves: [], trail: [], cooldown: 0, remount: false, remountFx: null } as never;
    q.inv = 0;
    const ai = createAi();
    let dead = -1;
    for (let i = 0; i < 400 && dead < 0; i++) {
      step(s, aiInputs(s, ai, CPU0, 2));
      if (s.players[1].state !== 'alive') dead = i;
    }
    expect(dead).toBeGreaterThanOrEqual(0);
    expect(s.players[0].state).toBe('alive');
  });

  it('duelo em campo aberto, montada e colada no adversário: solta a bomba mesmo sem fuga garantida', () => {
    const lv = AI_LEVELS[1], keep = { ...lv };
    Object.assign(lv, { sacrifice: 100 });                          // (Normal; sorteio garantido para o teste)
    try {
      const s = arena(); const p = put(s, 0, 4, 1); const q = put(s, 1, 6, 1);
      p.fire = 3 as never; q.inv = 0;
      // beco curto: (4,1) com saída só para o lado do adversário, que fica a 2 casas na mesma linha
      for (const [c, l] of [[3, 1], [4, 2]] as const) setCell(s, c, l, CODE.SOFT);
      p.mount = { type: 2, slot: 1, phase: 'riding', t0: 0, reserves: [], trail: [], cooldown: 0, remount: false, remountFx: null } as never;
      const ai = createAi();
      let placed = false;
      for (let i = 0; i < 120 && !placed; i++) {
        step(s, aiInputs(s, ai, CPU0, 1));
        placed = s.bombs.some(b => b.owner === 0);
      }
      expect(placed).toBe(true);
    } finally { Object.assign(lv, keep); }
  });
});

describe('IA: ovos de montaria', () => {
  it('já montada, estoura o ovo do chão que não quer (para os outros não pegarem)', () => {
    const s = arena(); const p = put(s, 0, 4, 3); put(s, 1, 1, 9);
    p.mount = { type: 2, slot: 1, phase: 'riding', t0: 0, reserves: [], trail: [], cooldown: 0, remount: false, remountFx: null } as never;
    const EGG = 0x0978;                                            // ovo de tipo fora da reserva (&$F ≥ 8): não serve a ela
    setCell(s, 6, 3, EGG);
    const ai = createAi();
    let gone = false;
    for (let i = 0; i < 600 && !gone; i++) {
      step(s, aiInputs(s, ai, CPU0, 2));
      if (s.grid[C(6, 3)] !== EGG) gone = true;
    }
    expect(gone).toBe(true);
    expect(s.players[0].state).toBe('alive');
  });
});

describe('IA: duelo montado', () => {
  it('1x1, montada e com o adversário a 3 casas na linha: solta a bomba de frente em vez de ficar guardando a montaria', () => {
    const lv = AI_LEVELS[1], keep = { ...lv };
    Object.assign(lv, { sacrifice: 100, wary: false });
    try {
      const s = arena(); const p = put(s, 0, 4, 3); put(s, 1, 7, 3);
      p.fire = 3 as never;
      // canto fechado atrás dela: sem fuga garantida depois da bomba
      for (const [c, l] of [[3, 3], [4, 2], [4, 4]] as const) setCell(s, c, l, CODE.SOFT);
      p.mount = { type: 2, slot: 1, phase: 'riding', t0: 0, reserves: [], trail: [], cooldown: 0, remount: false, remountFx: null } as never;
      const ai = createAi();
      let placed = false;
      for (let i = 0; i < 160 && !placed; i++) {
        s.players[1].x = s.players[1].x;                          // adversário parado
        step(s, aiInputs(s, ai, CPU0, 1));
        placed = s.bombs.some(b => b.owner === 0);
      }
      expect(placed).toBe(true);
    } finally { Object.assign(lv, keep); }
  });
});

describe('IA: colado no adversário, de luva', () => {
  it('no mesmo pixel de um adversário, pega e arremessa (nos níveis que caçam, sempre; sem sorteio)', () => {
    for (const level of [1, 2]) {
      const s = arena(); const p0 = put(s, 0, 4, 3); const p1 = put(s, 1, 4, 3); p0.glove = true; p0.inv = 0; p1.inv = 0;
      const ai = createAi();
      let grabbed = false, threw = false;
      for (let i = 0; i < 200 && !threw; i++) {
        const inp = aiInputs(s, ai, CPU0, level);
        inp[1] = 0;
        const ev = step(s, inp);
        if (s.players[0].grab >= 0) grabbed = true;
        if (ev.some(e => e.type === 'throw' && e.slot === 0)) threw = true;
      }
      expect([level, grabbed, threw]).toEqual([level, true, true]);
    }
  });
});
