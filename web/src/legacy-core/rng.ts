export interface Rng { s: number }

export function makeRng(seed: number): Rng {
  return { s: seed >>> 0 };
}

/** mulberry32: rápido, 32 bits, estado em um número. */
export function nextU32(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

export function randInt(r: Rng, n: number): number {
  return nextU32(r) % n;
}

export function shuffle<T>(r: Rng, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(r, i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
