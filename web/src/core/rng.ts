export interface Rng16 { seed: number }

export const BOOT_SEED = 0x0012;

export function makeRng(seed: number = BOOT_SEED): Rng16 {
  return { seed: seed & 0xffff };
}

/** RNG da ROM ($C3:54B3): 0..n-1; só (n & $FF) importa. */
export function rnd(r: Rng16, n: number): number {
  r.seed = ((r.seed | 1) * 0x383) & 0xffff;
  return (r.seed * (n & 0xff)) >>> 16;
}

/** Ordem aleatória dos spawns (opção extra, §6.13). mulberry32 separado: não toca no RNG do jogo. */
export function permuteSpawns(seed: number): number[] {
  let t = seed >>> 0;
  const next = (): number => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const a = [0, 1, 2, 3, 4];
  for (let i = 4; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const k = a[i]; a[i] = a[j]; a[j] = k;
  }
  return a;
}
