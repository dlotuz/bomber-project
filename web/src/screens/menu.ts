import { BTN } from '../legacy-core';

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
