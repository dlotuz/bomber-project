export interface AiLevel {
  react: number;    // ticks entre decisões
  mistake: number;  // % de decisões erradas (demora a fugir ou anda à toa)
  hunt: boolean;    // persegue outros jogadores (e não só blocos)
  margin: number;   // folga, em ticks, exigida antes e depois de cada explosão prevista (busca estrita)
  open: boolean;    // entre refúgios igualmente próximos, prefere os com 2+ saídas (evita beco)
  alert: number;    // ticks até replanejar quando surge/some/é chutada uma bomba (em vez de esperar `react`)
  trap: boolean;    // procura casas onde uma bomba deixa um adversário sem refúgio (e bomba para encurralar)
  wary: boolean;    // só bomba se a fuga resistir a cada adversário perto soltar uma bomba em seguida
}

/** Fraco, Normal, Forte (índice = rules.cpuLevel). Mesmos valores do legado. */
export const AI_LEVELS: readonly AiLevel[] = [
  { react: 20, mistake: 20, hunt: false, margin: 4, open: false, alert: 20, trap: false, wary: false },
  { react: 8, mistake: 5, hunt: true, margin: 8, open: true, alert: 2, trap: false, wary: true },
  { react: 2, mistake: 0, hunt: true, margin: 4, open: true, alert: 0, trap: true, wary: false },
];

/** 0..99 derivado só de (tick, slot, sal, semente da IA): a IA não consome o RNG do jogo. `seed` = 0 (padrão) dá os
 *  mesmos valores de antes; outra semente (createAi) varia as decisões entre rodadas iguais (arenas sem sorteio). */
export function aiRoll(tick: number, slot: number, salt: number, seed = 0): number {
  let h = Math.imul(tick + 0x9e3779b1, 0x85ebca6b) ^ Math.imul(slot + 1, 0xc2b2ae35) ^ Math.imul(salt + 7, 0x27d4eb2f);
  if (seed) h ^= Math.imul(seed, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) % 100;
}
