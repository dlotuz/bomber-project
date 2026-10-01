import { arena, put, setCell, C, withStage, withMount } from '../kit';
import { play } from './simkit';
import { createAi, aiInputs } from '../../../src/core/ai';
import { kickWorth } from '../../../src/core/ai/actions';
import { AI_LEVELS } from '../../../src/core/ai/level';
import { crossCells } from '../../../src/core/ai/danger';
import { addBomb } from '../../../src/core/bombs';
import { BTN, CODE } from '../../../src/core/types';
import { itemCode, playerCell } from '../../../src/core/state';
import { NO_MOUNT } from '../../../src/core/mounts';
import { step } from '../../../src/core/step';

const CPU0 = [true, false, false, false, false];

describe('IA: ações (§9.3)', () => {
  it('chute: não planeja chutar bomba com jogador em cima ($C1:33FD)', () => {
    const scene = (occupied: boolean) => {
      const s = arena({ players: 3 }); const p = put(s, 0, 4, 3); p.kick = true; p.face = 2;
      addBomb(s, 1, C(5, 3), { fuse: 90 });
      put(s, 1, occupied ? 5 : 9, occupied ? 3 : 9);
      return kickWorth(s, p, 2, AI_LEVELS[2], 'rescue');
    };
    expect(scene(false)).toBe(true);
    expect(scene(true)).toBe(false);
  });
  it('soco: bomba à frente e adversário no pouso → Y', () => {
    const s = arena(); const p = put(s, 0, 4, 3); p.punch = true; p.face = 2; put(s, 1, 8, 3);
    addBomb(s, 1, C(5, 3), { fuse: 90 });
    expect(play(s, CPU0, 2, 12)).toContainEqual({ type: 'punch', slot: 0 });
  });
  it('luva: levanta a própria bomba e arremessa no adversário a 3 casas', () => {
    const s = arena(); const p = put(s, 0, 4, 3); p.glove = true; p.face = 2; put(s, 1, 7, 3);
    addBomb(s, 0, C(4, 3));
    expect(play(s, CPU0, 2, 40)).toContainEqual({ type: 'throw', slot: 0 });
  });
  it('golpe P: empurra o adversário para dentro de uma explosão', () => {
    const s = arena(); const p = put(s, 0, 4, 3); p.pItem = true; p.face = 2; put(s, 1, 5, 3);
    addBomb(s, 1, C(9, 3), { fuse: 15 });
    expect(play(s, CPU0, 2, 10)).toContainEqual({ type: 'p_punch', slot: 0 });
  });
  it('X: para a própria bomba chutada quando a cruz pega um adversário', () => {
    const s = arena(); put(s, 0, 4, 3); put(s, 1, 8, 5);
    const b = addBomb(s, 0, C(5, 3), { fuse: 120, fire: 1 });
    s.grid[C(5, 3)] = CODE.FLOOR; b.state = 'kicked'; b.dir = 2; b.step = 0; b.kickedBy = 0;
    play(s, CPU0, 2, 60);
    expect(b.state).toBe('idle');
    expect(crossCells(s, b.cell, b.fire, false).cells).toContain(C(8, 5));
  });
  it('X: para a bomba DELA chutada pelo adversário (a ROM lê o X do dono, $C1:38CE)', () => {
    const s = arena(); put(s, 0, 4, 3); put(s, 1, 8, 5);
    const b = addBomb(s, 0, C(5, 3), { fuse: 120, fire: 1 });
    s.grid[C(5, 3)] = CODE.FLOOR; b.state = 'kicked'; b.dir = 2; b.step = 0; b.kickedBy = 1;
    play(s, CPU0, 2, 60);
    expect(b.state).toBe('idle');
    expect(crossCells(s, b.cell, b.fire, false).cells).toContain(C(8, 5));
  });
  it('X: a bomba do adversário chutada pela CPU não para com o X dela (nem tenta)', () => {
    const s = arena(); put(s, 0, 4, 3); put(s, 1, 8, 5);
    const b = addBomb(s, 1, C(5, 3), { fuse: 120, fire: 1 });
    s.grid[C(5, 3)] = CODE.FLOOR; b.state = 'kicked'; b.dir = 2; b.step = 0; b.kickedBy = 0;
    const ai = createAi(); let x = false;
    for (let i = 0; i < 60 && b.state === 'kicked'; i++) {
      const inp = aiInputs(s, ai, CPU0, 2); x ||= !!(inp[0] & BTN.X);
      step(s, inp);
    }
    expect(x).toBe(false);
  });
  it('B: detona a remota quando a cruz pega um adversário e não a CPU', () => {
    const s = arena(); put(s, 0, 4, 5); put(s, 1, 8, 3);
    addBomb(s, 0, C(6, 3), { type: 1 });
    expect(play(s, CPU0, 2, 12)).toContainEqual({ type: 'explosion', cell: C(6, 3), owner: 0 });
    expect(s.players[0].state).toBe('alive');
  });
});

describe('IA: doenças e dicas', () => {
  it('não pega caveira', () => {
    const s = arena(); put(s, 0, 4, 1); put(s, 1, 12, 9);
    setCell(s, 5, 1, itemCode(0x21)); setCell(s, 4, 2, itemCode(0x22));
    play(s, CPU0, 2, 150);
    expect(s.players[0].disease).toBe(0);
  });
  it('doente, procura contato para passar a doença', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.disease = 0x22; put(s, 1, 8, 5);
    expect(play(s, CPU0, 2, 450)).toContainEqual({ type: 'disease_passed', from: 0, to: 1 });
  });
  it('com controles invertidos ($2A) ainda foge da própria bomba', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.disease = 0x2a; put(s, 1, 12, 9);
    addBomb(s, 0, C(4, 1));
    play(s, CPU0, 2, 160);
    expect(s.players[0].state).toBe('alive');
  });
  it('dica da arena: casa em `avoid` nunca é pisada', () => {
    withStage(1, { ai: { avoid: () => [C(5, 1)] } }, () => {
      const s = arena(); put(s, 0, 4, 1); put(s, 1, 12, 9);
      setCell(s, 6, 1, itemCode(0x03));
      const ai = createAi();
      for (let i = 0; i < 200; i++) { step(s, aiInputs(s, ai, CPU0, 2)); expect(playerCell(s.players[0])).not.toBe(C(5, 1)); }
    });
  });
  it('dica da montaria: useY → Y na borda', () => {
    withMount({ ...NO_MOUNT, ai: { useY: () => true } }, () => {
      const s = arena(); put(s, 0, 4, 1); put(s, 1, 12, 9);
      const ai = createAi();
      const outs = Array.from({ length: 6 }, () => { const o = aiInputs(s, ai, CPU0, 2); step(s, o); return o[0] & BTN.Y; });
      expect(outs.some(Boolean)).toBe(true);
      expect(outs.every((v, i) => !(v && outs[i - 1]))).toBe(true);   // nunca dois ticks seguidos
    });
  });
});

describe('IA: Bad Bomber de CPU (§9.7)', () => {
  it('depois de entrar, alinha com um alvo e arremessa', () => {
    const s = arena({ players: 3, rules: { badBomber: true } });
    put(s, 0, 4, 3); put(s, 1, 8, 5); put(s, 2, 12, 9);
    setCell(s, 4, 3, CODE.FLAME); s.cellT0[C(4, 3)] = 100;
    const ev = play(s, CPU0, 2, 1 + 65 + 31 + 250);
    expect(ev).toContainEqual({ type: 'throw', slot: 0 });
  });
});
