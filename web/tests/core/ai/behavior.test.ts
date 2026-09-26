import { arena, put, setCell, C } from '../kit';
import { play } from './simkit';
import { createAi, aiInputs } from '../../../src/core/ai';
import { addBomb } from '../../../src/core/bombs';
import { itemCode } from '../../../src/core/state';
import { createMatch, startRound } from '../../../src/core/match';
import { step } from '../../../src/core/step';
import { hashState } from '../../../src/core/hash';
import { ITEM } from '../../../src/core/types';
import { rules } from '../kit';

const CPU0 = [true, false, false, false, false];

describe('IA: comportamento', () => {
  it('foge da bomba colocada na própria casa', () => {
    const s = arena(); put(s, 0, 4, 1); put(s, 1, 12, 9);
    addBomb(s, 0, C(4, 1));
    play(s, CPU0, 1, 160);
    expect(s.players[0].state).toBe('alive');
  });
  it('pega um item próximo', () => {
    const s = arena(); put(s, 0, 4, 1); put(s, 1, 12, 9);
    setCell(s, 6, 1, itemCode(ITEM.FIRE));
    const ev = play(s, CPU0, 1, 90);
    expect(ev).toContainEqual({ type: 'item_picked', slot: 0, item: ITEM.FIRE });
  });
  it('não vai buscar item numa casa que uma bomba vai atingir antes de ela chegar', () => {
    const s = arena(); put(s, 0, 4, 3); put(s, 1, 12, 9);
    setCell(s, 8, 3, itemCode(ITEM.FIRE));
    addBomb(s, 1, C(9, 3), { fuse: 40 });
    play(s, CPU0, 2, 200);
    expect(s.players[0].state).toBe('alive');
  });
  it('não lê os itens escondidos: estados que só diferem em `hidden` dão as mesmas entradas', () => {
    const mk = () => { const m = createMatch(rules(), 1); return startRound(m); };
    const a = mk(), b = mk();
    b.hidden = b.hidden.map(([c]) => [c, ITEM.P] as [number, number]);
    const ai1 = createAi(), ai2 = createAi();
    const cpu = [true, true, true, true, true];
    for (let t = 0; t < 400; t++) {
      const i1 = aiInputs(a, ai1, cpu, 2), i2 = aiInputs(b, ai2, cpu, 2);
      expect(i1).toEqual(i2);
      step(a, i1); step(b, i2);
      if (a.grid.some((v, i) => v !== b.grid[i])) break;    // depois que um item diferente aparece, divergir é legítimo
    }
  });
  it('é determinística', () => {
    const run = () => { const m = createMatch(rules(), 1, 7); const s = startRound(m); play(s, [true, true, true, true, true], 1, 3000); return hashState(s); };
    expect(run()).toBe(run());
  });
});
