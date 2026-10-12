// IA: contexto geral para topar perder a montaria (ela absorve a chama) e encurralar/matar um adversário.
import { arena, put } from '../kit';
import { AI_LEVELS } from '../../../src/core/ai';
import { sacrificeChance } from '../../../src/core/ai/brain';
import type { Player } from '../../../src/core/types';

const ride = (p: Player, reserves: number[] = []): void => {
  p.mount = { type: 2, slot: 1, phase: 'riding', t0: 0, reserves, trail: [], cooldown: 0, remount: false, remountFx: null };
};

describe('IA: sacrifício da montaria', () => {
  it('sem montaria (ou desmontando), nunca; no Fraco, nunca', () => {
    const s = arena({ players: 3 }); const p = put(s, 0, 4, 3); put(s, 1, 8, 3); put(s, 2, 8, 9);
    expect(sacrificeChance(s, p, AI_LEVELS[2])).toBe(0);
    ride(p);
    expect(sacrificeChance(s, p, AI_LEVELS[0])).toBe(0);
    (p.mount as { phase: string }).phase = 'dismount';
    expect(sacrificeChance(s, p, AI_LEVELS[2])).toBe(0);
  });

  it('o contexto muda a chance: reserva e duelo sobem, muita gente viva desce', () => {
    const many = arena({ players: 4 }); const p = put(many, 0, 4, 3); put(many, 1, 8, 3); put(many, 2, 8, 9); put(many, 3, 1, 9);
    ride(p);
    const base = sacrificeChance(many, p, AI_LEVELS[2]);
    expect(base).toBe(AI_LEVELS[2].sacrifice - 15);                  // 3 adversários: guarda a montaria
    ride(p, [1]);
    expect(sacrificeChance(many, p, AI_LEVELS[2])).toBe(base + 20);  // com reserva, custa menos
    const duel = arena({ players: 2 }); const q = put(duel, 0, 4, 3); put(duel, 1, 8, 3);
    ride(q);
    expect(sacrificeChance(duel, q, AI_LEVELS[2])).toBe(AI_LEVELS[2].sacrifice + 25);   // duelo: vale arriscar
  });
});
