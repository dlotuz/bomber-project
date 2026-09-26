import { BTN } from '../core';
// `Menu` (nova) usa a porta `game/core-api.ts` (T1), como pede o brief; `MenuList`/`cycle`/`clamp` (antigos,
// até a T22) continuam com o `BTN` de `../core` acima, para não tocar em código fora da posse desta tarefa.
import { BTN as PORT_BTN } from '../game/core-api';
import { Repeater, DIRS } from '../input/repeat';
import type { AudioSink } from '../app/rom-api';

// `app/audio.ts` (T2) ainda não existe nesta worktree; a regra do brief (T7, Interfaces) autoriza usar os
// literais do SFX ($01/$02/$03) enquanto isso. Trocar por `SFX.move/confirm/back` quando a T2 mesclar.
const SFX_MOVE = 1;
const SFX_CONFIRM = 2;
const SFX_BACK = 3;

export interface MenuItem {
  label: string;
  value?: () => string;
  valueColor?: () => string;
  left?: () => void;
  right?: () => void;
  select?: () => void;
  disabled?: boolean;
}

export type MenuResult = 'back' | 'selected' | 'changed' | 'moved' | null;

/** Lista vertical navegável: CIMA/BAIXO movem (pulando itens desativados), ESQ/DIR mudam valor, A/START seleciona, B volta. */
export class MenuList {
  cursor = 0;

  constructor(public items: MenuItem[]) {
    this.cursor = Math.max(0, items.findIndex(i => !i.disabled));
  }

  handle(pressed: number): MenuResult {
    if (pressed & BTN.UP) { this.move(-1); return 'moved'; }
    if (pressed & BTN.DOWN) { this.move(1); return 'moved'; }
    const it = this.items[this.cursor];
    if ((pressed & BTN.LEFT) && it.left && !it.disabled) { it.left(); return 'changed'; }
    if ((pressed & BTN.RIGHT) && it.right && !it.disabled) { it.right(); return 'changed'; }
    if ((pressed & (BTN.A | BTN.START)) && it.select && !it.disabled) { it.select(); return 'selected'; }
    if (pressed & BTN.B) return 'back';
    return null;
  }

  private move(d: number): void {
    const n = this.items.length;
    for (let k = 1; k <= n; k++) {
      const i = (((this.cursor + d * k) % n) + n) % n;
      if (!this.items[i].disabled) { this.cursor = i; return; }
    }
  }
}

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
    if (pressed & PORT_BTN.B) { sink.sfx(SFX_BACK); return 'back'; }
    if (pressed & (PORT_BTN.A | PORT_BTN.START)) {
      if (!row.select || row.disabled) return null;
      if (row.select() === false) { sink.sfx(SFX_BACK); return 'refused'; }
      sink.sfx(SFX_CONFIRM);
      return 'selected';
    }
    if (pulse & (PORT_BTN.UP | PORT_BTN.DOWN)) { this.move(pulse & PORT_BTN.UP ? -1 : 1); sink.sfx(SFX_MOVE); return 'moved'; }
    if (pulse & (PORT_BTN.LEFT | PORT_BTN.RIGHT)) {
      const f = pulse & PORT_BTN.LEFT ? row.left : row.right;
      if (!f || row.disabled) return null;
      const ok = f.call(row);
      sink.sfx(SFX_MOVE);
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
