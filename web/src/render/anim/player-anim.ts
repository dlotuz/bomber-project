import type { Anim, RomAssets } from '../../rom/types';
import type { RomView } from '../../rom/view';
import type { PlayerPose } from '../rom/scene';

/** Tabela de 1º nível (por personagem) e índice no 2º nível; idx null = a entrada já é a animação. */
export interface AnimRef { tab: number; idx: number | null }

export const BORED_AFTER = 383;   // ticks parado até o tédio (§7.4)

export const TAB = {
  stand: 0xc276c5, lift: 0xc27515, carry: 0xc27665, throw: 0xc2755d, punch: 0xc2746d, pPunch: 0xc2749d,
  misc: 0xc26ce8, spin: 0xc26f71, dying: 0xc26e15, victory: 0xc26f05, launched: 0xc26f35, dance: 0xc26fc5,
} as const;

const DIR8: Readonly<Record<number, number>> = { 0: 0, 2: 1, 4: 4, 6: 5 };
const DIR4: Readonly<Record<number, number>> = { 0: 0, 2: 1, 4: 2, 6: 3 };

/** Animação da ação e o tempo a amostrar. `t` = tick − actT0. */
export function playerAnimRef(p: PlayerPose, t: number): { ref: AnimRef; t: number } {
  const d8 = DIR8[p.face] ?? 4;
  const d4 = DIR4[p.face] ?? 2;
  const at = (tab: number, idx: number | null) => ({ ref: { tab, idx }, t });
  switch (p.act) {
    case 'idle':
      return t >= BORED_AFTER ? { ref: { tab: TAB.spin, idx: 4 + (p.char & 7) }, t: t - BORED_AFTER } : at(TAB.stand, d8 + 8);
    case 'walk': return at(TAB.stand, d8);
    case 'lift': return at(TAB.lift, d8);
    case 'carryIdle': return at(TAB.carry, d8 + 8);
    case 'carryWalk': return at(TAB.carry, d8);
    case 'throw': return at(TAB.throw, d8);
    case 'punch': return at(TAB.punch, d8);
    case 'pPunch': return at(TAB.pPunch, d8);
    case 'detonate': return at(TAB.misc, 12);
    case 'shocked': return at(TAB.misc, 4);
    case 'stunned': return at(TAB.spin, 10);
    case 'dying': return at(TAB.dying, null);
    case 'victory': return at(TAB.victory, null);
    case 'launched': return at(TAB.launched, d4);   // D14 🟡
    case 'pushed': return at(TAB.misc, d4);         // D14 🟡
    case 'dance': return at(TAB.dance, d4);         // D14 🟡
    case 'bad': return at(TAB.stand, p.moving ? d8 : d8 + 8);
    default: return at(TAB.stand, d8 + 8);          // mounting, dismount: o plano 9 troca pelo gancho
  }
}

export function animAddr(rom: RomView, ref: AnimRef, char: number): number {
  const first = rom.p24(ref.tab + 3 * (char & 7));
  return ref.idx === null ? first : rom.p24(first + 3 * ref.idx);
}

export function resolveAnim(a: RomAssets, ref: AnimRef, char: number): Anim {
  return a.anim(animAddr(a.rom, ref, char));
}
