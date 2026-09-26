// Esquema de escolha compartilhado por `characters.ts` e `teams.ts` (§6.6, R13, R32; DRY pedido na revisão da
// Task 10, rodada 2): humanos com dispositivo escolhem sozinhos e ao mesmo tempo; os demais ativos (CPUs e
// humanos sem dispositivo) formam uma fila que o "controlador" (1º humano com dispositivo) decide depois de
// confirmar o próprio — ou, sem controlador nenhum, qualquer controle decide por todos, um de cada vez.
import { BTN } from '../game/core-api';
import type { App } from '../app/app';
import { Repeater, DIRS } from '../input/repeat';
import type { MenuInput } from '../input/input';

export interface PickScheme {
  /** Slots com `setup.slots[i] !== 'off'`, em ordem. */
  readonly activeIdx: readonly number[];
  /** 1º humano com dispositivo, ou `null` se não houver nenhum. Fixo desde a criação da tela. */
  readonly controller: number | null;
  /** `true` quando o slot `i` já confirmou. Mutável: os chamadores marcam `confirmed[i] = true` ao confirmar. */
  readonly confirmed: boolean[];
  human(i: number): boolean;
  selfPicking(i: number): boolean;
  /** `null` com controlador ainda não confirmado; senão o 1º da fila (CPUs e humanos sem dispositivo) ainda
   *  sem confirmar, ou `null` se a fila já acabou. */
  controllingSlot(): number | null;
  /**
   * Processa um tick: chama `move(i, pulso)` para quem deve se mexer agora (o próprio humano se ainda não
   * confirmou; o controlador, depois de confirmar, movendo `controllingSlot()`; ou, sem controlador, qualquer
   * controle movendo `controllingSlot()`) e `tryConfirm(i)` quando A/START for apertado por quem manda nesse
   * slot. Devolve `true` se B foi apertado em qualquer controle (o chamador decide o SFX e para onde voltar).
   */
  handle(inp: MenuInput, move: (i: number, pulse: number) => void, tryConfirm: (i: number) => void): boolean;
}

export function createPickScheme(app: App): PickScheme {
  const setup = app.settings.setup;
  const active = (i: number): boolean => setup.slots[i] !== 'off';
  const human = (i: number): boolean => setup.slots[i] === 'human';
  const selfPicking = (i: number): boolean => human(i) && app.settings.devices[i] !== 'none';

  const activeIdx = [0, 1, 2, 3, 4].filter(active);
  const controller = activeIdx.find(selfPicking) ?? null;
  const queue = activeIdx.filter(i => !selfPicking(i));
  const confirmed = [0, 1, 2, 3, 4].map(i => !active(i));

  const reps = new Map<number, Repeater>();
  for (const i of activeIdx) if (selfPicking(i)) reps.set(i, new Repeater(20, 5));
  const anyRep = new Repeater(20, 5);

  const controllingSlot = (): number | null => {
    if (controller !== null && !confirmed[controller]) return null;
    return queue.find(i => !confirmed[i]) ?? null;
  };

  return {
    activeIdx, controller, confirmed, human, selfPicking, controllingSlot,
    handle(inp, move, tryConfirm) {
      if (inp.pressedAny & BTN.B) return true;
      for (const i of activeIdx) {
        if (!selfPicking(i)) continue;
        const pulse = reps.get(i)!.step(inp.pads[i] & DIRS);
        if (confirmed[i]) {
          // Só o controlador continua tendo o que fazer depois de confirmar: o próprio dispositivo passa a
          // mover/confirmar quem está na vez da fila. Os outros humanos confirmados não afetam mais nada.
          if (i === controller) {
            const c = controllingSlot();
            if (c !== null) {
              move(c, pulse);
              if (inp.pressed[i] & (BTN.A | BTN.START)) tryConfirm(c);
            }
          }
          continue;
        }
        move(i, pulse);
        if (inp.pressed[i] & (BTN.A | BTN.START)) tryConfirm(i);
      }
      // Sem controlador (nenhum humano com dispositivo): qualquer controle decide por todos, um de cada vez.
      if (controller === null) {
        const c = controllingSlot();
        if (c !== null) {
          const pulse = anyRep.step(inp.any & DIRS);
          move(c, pulse);
          if (inp.pressedAny & (BTN.A | BTN.START)) tryConfirm(c);
        }
      }
      return false;
    },
  };
}
