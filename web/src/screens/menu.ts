import { BTN } from '../game/core-api';
import { Repeater, DIRS } from '../input/repeat';
import { SFX } from '../app/audio';
import type { AudioSink } from '../app/rom-api';

/** Próximo valor de `arr` a partir de `cur` (com volta). */
export function cycle<T>(arr: readonly T[], cur: T, d: number): T {
  const i = Math.max(0, arr.indexOf(cur));
  return arr[(((i + d) % arr.length) + arr.length) % arr.length];
}

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export interface MenuRow {
  id: string;
  disabled?: boolean;                 // cinza, pulado pelo cursor
  left?(): boolean;                   // false = já no limite (o SFX toca igual)
  right?(): boolean;
  select?(): boolean | void;          // false = recusado ($03)
}
export type MenuEvent = 'moved' | 'changed' | 'limit' | 'selected' | 'refused' | 'back' | null;

/** Lista vertical dos menus do original [MNT §B.0]: ↑/↓ com volta (repetição 20/5), ←/→ sem volta, A/START, B. */
export class Menu {
  cursor: number;
  private rep: Repeater;
  constructor(public rows: MenuRow[], o: { repeat?: Repeater; cursor?: number } = {}) {
    this.rep = o.repeat ?? new Repeater();
    const c = o.cursor ?? rows.findIndex(r => !r.disabled);
    this.cursor = Math.max(0, rows[c]?.disabled ? rows.findIndex(r => !r.disabled) : c);
  }
  /** `held`: segurados em qualquer controle; `pressed`: recém-apertados. */
  update(held: number, pressed: number, sink: AudioSink): MenuEvent {
    const pulse = this.rep.step(held & DIRS);
    const row = this.rows[this.cursor];
    if (pressed & BTN.B) { sink.sfx(SFX.back); return 'back'; }
    if (pressed & (BTN.A | BTN.START)) {
      if (!row.select || row.disabled) return null;
      if (row.select() === false) { sink.sfx(SFX.back); return 'refused'; }
      sink.sfx(SFX.confirm);
      return 'selected';
    }
    if (pulse & (BTN.UP | BTN.DOWN)) { this.move(pulse & BTN.UP ? -1 : 1); sink.sfx(SFX.move); return 'moved'; }
    if (pulse & (BTN.LEFT | BTN.RIGHT)) {
      const f = pulse & BTN.LEFT ? row.left : row.right;
      if (!f || row.disabled) return null;
      const ok = f.call(row);
      sink.sfx(SFX.move);
      return ok ? 'changed' : 'limit';
    }
    return null;
  }
  private move(d: number): void {
    const n = this.rows.length;
    for (let k = 1; k <= n; k++) {
      const i = (((this.cursor + d * k) % n) + n) % n;
      if (!this.rows[i].disabled) { this.cursor = i; return; }
    }
  }
}
