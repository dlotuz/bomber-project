import { arena, put, setCell, C } from '../kit';
import { play } from './simkit';
import { createAi, aiInputs } from '../../../src/core/ai';
import { addBomb } from '../../../src/core/bombs';
import { itemCode } from '../../../src/core/state';
import { createMatch, startRound } from '../../../src/core/match';
import { step } from '../../../src/core/step';
import { hashState } from '../../../src/core/hash';
import { fork } from '../../../src/core/ai/whatif';
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
  it('não lê os itens escondidos: `hidden` trocado, vazio ou com as casas embaralhadas dá as mesmas entradas', () => {
    const mk = () => { const m = createMatch(rules(), 1); return startRound(m); };
    const a = mk();
    const variants = [
      (h: [number, number][]) => h.map(([c]) => [c, ITEM.P] as [number, number]),               // outros itens
      () => [] as [number, number][],                                                          // nenhum item
      (h: [number, number][]) => h.map(([, it], i) => [h[(i + 1) % h.length][0], it] as [number, number]).reverse(),   // casas trocadas
    ];
    const others = variants.map(f => { const b = mk(); b.hidden = f(b.hidden); return b; });
    expect(others.map(b => JSON.stringify(b.hidden) !== JSON.stringify(a.hidden))).toEqual([true, true, true]);
    const aiA = createAi(), ais = others.map(() => createAi());
    const live = others.map(() => true);
    const cpu = [true, true, true, true, true];
    let compared = 0;
    for (let t = 0; t < 1500 && live.some(Boolean); t++) {
      const ia = aiInputs(a, aiA, cpu, 2);
      others.forEach((b, k) => {
        if (!live[k]) return;
        expect(aiInputs(b, ais[k], cpu, 2), `variante ${k}, tick ${a.tick}`).toEqual(ia);
        compared++;
      });
      step(a, ia);
      others.forEach((b, k) => {
        if (!live[k]) return;
        step(b, ia);
        if (a.grid.some((v, i) => v !== b.grid[i])) live[k] = false;   // depois que a grade diverge, divergir é legítimo
      });
    }
    expect(compared).toBeGreaterThan(300);
  });
  it('é pura: aiInputs não escreve na rodada (hash antes = depois, em rodadas completas)', () => {
    for (const stage of [1, 3, 5, 10]) {
      const m = createMatch(rules({ cpuLevel: 2 }), stage, 40 + stage);
      const s = startRound(m); const ai = createAi(stage);
      const cpu = [true, true, true, true, true];
      for (let i = 0; i < 12000 && s.phase !== 'over'; i++) {
        const h = hashState(s);
        const inp = aiInputs(s, ai, cpu, 2);
        if (hashState(s) !== h) expect.fail(`fase ${stage}, tick ${s.tick}: aiInputs mudou a rodada`);
        step(s, inp);
      }
      expect(s.phase).toBe('over');
    }
  }, 120_000);
  it('fork: mexer na cópia não mexe na rodada original', () => {
    const s = startRound(createMatch(rules(), 1, 3));
    s.stageState = { balls: [{ cell: 5 }] }; s.mountState = { eggs: [1] };
    s.players[0].mount = { kind: 1 };
    s.pressure.falling.push({ cell: 20, t0: 1, land: 9 });
    const h = hashState(s);
    const f = fork(s);
    f.players[0].push.left = 9; f.players[0].effect.left = 9; (f.players[0].mount as { kind: number }).kind = 2;
    f.pressure.falling[0].land = 99; f.pressure.falling.push({ cell: 21, t0: 1, land: 9 }); f.pressure.next = 7;
    f.cellT0[30] = 99; f.cellAux[30] = 99; f.floor[30] = 99; f.rng.seed = 1; f.clock.sec = 1; f.hidden.pop();
    (f.stageState as { balls: { cell: number }[] }).balls[0].cell = 6; (f.mountState as { eggs: number[] }).eggs.push(2);
    expect(hashState(s)).toBe(h);
  });
  it('é determinística', () => {
    const run = () => { const m = createMatch(rules(), 1, 7); const s = startRound(m); play(s, [true, true, true, true, true], 1, 3000); return hashState(s); };
    expect(run()).toBe(run());
  });
});
