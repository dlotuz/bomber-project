// Validação: as fases de tema (11–18) jogam EXATAMENTE como a clássica (fase 1). Mesma semente e mesmas entradas
// (CPUs jogando de verdade, com bombas, itens, ovos e montarias) → o estado do núcleo é idêntico tick a tick; só o
// desenho muda. Se alguma regra, layout, item ou elemento especial vazasse para uma fase de tema, o estado divergiria.
import { createMatchSession, beginRound, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { step, aiInputs, createAi } from '../../src/game/core-api';
import { VISIBLE_STAGES, coreStage } from '../../src/game/stages';
import type { RoundState } from '../../src/core/types';

const THEMED = VISIBLE_STAGES.filter(n => n !== 1);
const TICKS = 6000;   // 100 s de partida: dá tempo de blocos quebrarem, itens e ovos saírem e montarias entrarem

/** Rodada só de CPUs na fase `stage` da interface; devolve um retrato do estado a cada 60 ticks. */
function play(stage: number, seed: number): string[] {
  resetCarry();
  const ms = createMatchSession(parseConfig(`?quick&humans=0&stage=${stage}&seed=${seed}&level=2`));
  const r: RoundState = beginRound(ms);
  const ai = createAi(), cpu = [true, true, true, true, true];
  const snaps: string[] = [];
  for (let t = 0; t < TICKS; t++) {
    step(r, aiInputs(r, ai, cpu, 2));
    if (t % 60 === 0) snaps.push(JSON.stringify(r));
  }
  snaps.push(JSON.stringify(r));
  return snaps;
}

describe('fases de tema = regras da clássica', () => {
  it('todas as fases visíveis além da 1 são cópias da fase 1 no núcleo', () => {
    expect(THEMED.length).toBeGreaterThanOrEqual(8);
    for (const n of THEMED) expect(coreStage(n)).toBe(1);
  });

  for (const seed of [0x1234, 0xbeef]) {
    it(`semente ${seed.toString(16)}: estado do núcleo idêntico ao da fase 1, tick a tick (${TICKS} ticks)`, () => {
      const base = play(1, seed);
      // a partida tem de ter acontecido de verdade (blocos quebrados, alguém morto ou montado), senão o teste é fraco
      const end = JSON.parse(base[base.length - 1]) as RoundState;
      const start = JSON.parse(base[0]) as RoundState;
      expect(end.grid).not.toEqual(start.grid);
      for (const stage of THEMED) {
        const got = play(stage, seed);
        expect(got.length).toBe(base.length);
        const i = got.findIndex((g, k) => g !== base[k]);
        expect({ stage, firstDiff: i }).toEqual({ stage, firstDiff: -1 });
      }
    }, 120_000);
  }
});
