export interface AiLevel {
  react: number;    // ticks entre decisões
  mistake: number;  // % de decisões erradas (demora a fugir ou anda à toa)
  hunt: boolean;    // persegue outros jogadores (e não só blocos)
  margin: number;   // folga, em ticks, exigida antes e depois de cada explosão prevista (busca estrita)
  open: boolean;    // entre refúgios igualmente próximos, prefere os com 2+ saídas (evita beco)
  alert: number;    // ticks até replanejar quando surge/some/é chutada uma bomba (em vez de esperar `react`)
  trap: boolean;    // procura casas onde uma bomba deixa um adversário sem refúgio (e bomba para encurralar)
  wary: boolean;    // só bomba se a fuga resistir a cada adversário perto soltar uma bomba em seguida
  dropKill: number; // % das bombas na mão que "dropam" (B) na cabeça de um adversário colado quando isso mata
  dropStun: number; // % idem só para atordoar (e, de luva sobre a própria bomba, de não esperar o pavio baixar)
  dodge: number;    // % das ameaças (bomba no ar na minha casa, adversário de luva mirando em mim) que ele desvia
  grabFoe: number;  // % do tempo em que, de luva, pega um adversário na mesma casa para arremessá-lo
  clicks: number;   // chance (%), a cada tick livre, de dar um aperto de B para sair da mão de um adversário (luva)
  clickDelay: number; // ticks de susto antes do 1º aperto depois de ser pego
  sacrifice: number; // % base de topar perder a montaria (ela absorve a chama) para encurralar/matar um adversário
}

/** Fraco, Normal, Forte (índice = rules.cpuLevel). Mesmos valores do legado. */
export const AI_LEVELS: readonly AiLevel[] = [
  { react: 20, mistake: 20, hunt: false, margin: 4, open: false, alert: 20, trap: false, wary: false, dropKill: 0, dropStun: 0, dodge: 0, grabFoe: 0, clicks: 6, clickDelay: 30, sacrifice: 0 },
  { react: 8, mistake: 5, hunt: true, margin: 8, open: true, alert: 2, trap: false, wary: true, dropKill: 60, dropStun: 25, dodge: 35, grabFoe: 25, clicks: 9, clickDelay: 20, sacrifice: 25 },
  { react: 2, mistake: 0, hunt: true, margin: 4, open: true, alert: 0, trap: true, wary: false, dropKill: 85, dropStun: 40, dodge: 55, grabFoe: 40, clicks: 12, clickDelay: 12, sacrifice: 45 },
];

/** 0..99 derivado só de (tick, slot, sal, semente da IA): a IA não consome o RNG do jogo. `seed` = 0 (padrão) dá os
 *  mesmos valores de antes; outra semente (createAi) varia as decisões entre rodadas iguais (arenas sem sorteio). */
export function aiRoll(tick: number, slot: number, salt: number, seed = 0): number {
  let h = Math.imul(tick + 0x9e3779b1, 0x85ebca6b) ^ Math.imul(slot + 1, 0xc2b2ae35) ^ Math.imul(salt + 7, 0x27d4eb2f);
  if (seed) h ^= Math.imul(seed, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) % 100;
}
