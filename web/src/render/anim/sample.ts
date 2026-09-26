import type { Anim, AnimFrame } from '../../rom/types';

export interface AnimSample { index: number; frame: AnimFrame; ox: number; oy: number }

const durOf = (d: number): number => (d === 0 ? 256 : d);

/** Soma das durações; Infinity se algum quadro congela (dur 255). */
export function animCycle(anim: Anim): number {
  let n = 0;
  for (const f of anim) {
    if (f.dur === 255) return Infinity;
    n += durOf(f.dur);
  }
  return n;
}

/** Quadro em `t` ticks desde o início da animação (ANI §1.3): dur 255 congela; todas fazem loop. */
export function sampleAnim(anim: Anim, t: number): AnimSample {
  if (anim.length === 0) throw new Error('animação vazia');
  const cycle = animCycle(anim);
  let r = Math.max(0, Math.floor(t));
  if (cycle !== Infinity) r %= cycle;
  let ox = 0;
  let oy = 0;
  for (let i = 0; i < anim.length; i++) {
    const f = anim[i];
    ox += f.mx;
    oy += f.my;
    if (f.dur === 255 || r < durOf(f.dur)) return { index: i, frame: f, ox, oy };
    r -= durOf(f.dur);
  }
  const last = anim.length - 1;
  return { index: last, frame: anim[last], ox, oy };
}
