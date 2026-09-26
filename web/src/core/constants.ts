/** Contador do pavio (explode 127 ticks depois de colocada). */
export const FUSE = 126;
/** Contador do pavio com as caveiras $27 / $28 ($C1:56E8 = [62, 253, 126]). */
export const FUSE_SHORT = 62;
export const FUSE_LONG = 253;
export const FLAME_TICKS = 25;
export const BURN_TICKS = 24;
export const CHAIN_DELAY = 2;
/** Morte: animação 1..21, drops a partir de 22 a cada 4, fora de jogo em 65. */
export const DEATH_ANIM_END = 21;
export const DROP_START = 22;
export const DROP_EVERY = 4;
export const OUT_AT = 65;
export const STUN_TICKS = 63;
export const HIT_INV = 96;
export const VEST_INV = 511;
/** Máximos por item: o item só sobe se valor+1 < limite ($C0:0B4C/48/50 = 9, 8, 6). */
export const MAX_BOMBS = 8;
export const MAX_FIRE = 7;
export const MAX_SPEED = 5;
export const INTRO_CLOCK_TICKS = 10;
export const INTRO_TICKS = 62;           // 10 com relógio + 15 de fade-in + 37 parados
export const WIN_DELAY = 2;
export const CELEBRATE_TICKS = 128;
export const VICTORY_SFX_AT = 31;
export const TIME_UP_TICKS = 160;
export const HURRY_BAND_TICKS = 192;
export const PRESSURE_BORDER_AT = 192;
export const PRESSURE_FIRST = 205;
export const PRESSURE_EVERY = 14;
export const PRESSURE_STEPS_NORMAL = 80;
export const PRESSURE_STEPS_SD = 143;
export const fallTicks = (lin: number): number => 36 + 2 * lin;
export const TIME_MINUTES = [1, 2, 3, 5, 30];
export const CLOCK_FROZEN_FROM = 600;
export const LIFT_TICKS = 4;
export const THROW_TICKS = 20;
export const PUNCH_TICKS = 8;
export const DETONATE_TICKS = 3;
export const P_TICKS = 35;
export const P_ADVANCE_TICKS = 4;
export const P_SPEED = 4 * 256;           // 4 px/tick
export const P_PUSH_TICKS = 12;
export const KICK_STEPS = 8;              // 8 passos de 2 px por casa
export const BAD_COOLDOWN = 48;
export const FOOTSTEP_EVERY = 20;
export const CONTACT_PX = 8;
export const LEAK_EVERY = 32;
export const BOREDOM_TICKS = 383;         // só visual (plano 7)

export const STAGE_NAMES = [
  'O Clássico', 'Rápido e Devagar', 'Bombardeio Orbital', 'Não Me Empurre', 'Escola de Choques',
  'Piso Traiçoeiro', 'Esconde-Explode', 'Caça-Níquel', 'Gangorra', 'Alfaiataria',
];

/** Alcance da chama pelo nível de fogo: 0..8 → 2..10; 9 → 10; 10 → 1 (caveira $25). */
export const rangeOf = (fire: number): number => (fire === 10 ? 1 : Math.min(fire, 8) + 2);
