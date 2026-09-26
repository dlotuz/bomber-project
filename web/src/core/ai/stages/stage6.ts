import type { AiStageHints } from '../hints';
import { CODE, type RoundState } from '../../types';
import { faceStep } from '../../units';
import { floorWord, playerCell, standing } from '../../stages/kit';
import { A6_FLOOR } from '../../stages/stage6';

const word = (s: RoundState, c: number): number =>
  s.grid[c] === CODE.FLOOR ? floorWord(s, c, A6_FLOOR) : -1;

/** Listras (1C0A) empurram para a vizinha na face de entrada: só são perigosas se alguma vizinha está em chama agora. */
const pushIntoFlame = (s: RoundState, c: number): boolean =>
  [0, 2, 4, 6].some(f => s.grid[faceStep(c, f)] === CODE.FLAME);

/** §9 item 8: evitar a caveira (1C0C) e prever o empurrão das listras (1C0A); bomba chutada para antes das
 *  caveirinhas (1C08). Evitar toda listra emparedava as CPUs (9 de 16 repinturas são listras). */
export const stage6Ai: AiStageHints = {
  avoid(s) {
    const out: number[] = [];
    for (let c = 0; c < s.grid.length; c++) {
      const w = word(s, c);
      if (w === 0x1c0c || (w === 0x1c0a && pushIntoFlame(s, c))) out.push(c);
    }
    return out;
  },
  kickEnd(s, cell, face) {
    let c = cell;
    for (let i = 0; i < 16; i++) {
      const n = faceStep(c, face);
      const g = s.grid[n] ?? CODE.HARD;
      if (g & 0x8400 || (g & 0xefc0) === CODE.BOMB || word(s, n) === 0x1c08) return c;
      if (s.players.some(p => standing(p) && playerCell(p) === n)) return c;
      c = n;
    }
    return c;
  },
};
