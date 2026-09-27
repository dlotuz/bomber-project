// Esquema de escolha compartilhado por `characters.ts` e `teams.ts` (§6.6, R13, R32; DRY pedido na revisão da
// Task 10, rodada 2): humanos com dispositivo **conectado** escolhem sozinhos e ao mesmo tempo; os demais ativos
// (CPUs e humanos sem dispositivo ou com o gamepad desconectado) formam uma fila que o "controlador" (1º humano com
// dispositivo conectado) decide depois de confirmar o próprio — ou, sem controlador nenhum, qualquer controle decide
// por todos, um de cada vez. A conexão é avaliada ao vivo, a cada `handle` (`MenuInput.connected`), para que um
// humano com um gamepad que não está ligado (P3–P5 vêm com `gp0`–`gp2` por padrão) não trave a tela (revisão final
// do plano 10, I9).
import { BTN } from '../game/core-api';
import type { App } from '../app/app';
import { Repeater, DIRS } from '../input/repeat';
import type { MenuInput } from '../input/input';

export interface PickScheme {
  /** Slots com `setup.slots[i] !== 'off'`, em ordem. */
  readonly activeIdx: readonly number[];
  /** 1º humano com dispositivo conectado, ou `null` se não houver nenhum. Ao vivo (muda se um gamepad cair/voltar). */
  readonly controller: number | null;
  /** `true` quando o slot `i` já confirmou. Mutável: os chamadores marcam `confirmed[i] = true` ao confirmar. */
  readonly confirmed: boolean[];
  human(i: number): boolean;
  selfPicking(i: number): boolean;
  /** `null` com controlador ainda não confirmado; senão o 1º da fila (CPUs e humanos sem dispositivo conectado)
   *  ainda sem confirmar, ou `null` se a fila já acabou. */
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
  /** Conexão vista no último `handle` (antes do 1º: teclado sempre, gamepad presumido ligado, 'none' nunca). */
  let connected: readonly boolean[] = [0, 1, 2, 3, 4].map(i => app.settings.devices[i] !== 'none');
  const selfPicking = (i: number): boolean => human(i) && app.settings.devices[i] !== 'none' && connected[i];

  const activeIdx = [0, 1, 2, 3, 4].filter(active);
  const confirmed = [0, 1, 2, 3, 4].map(i => !active(i));
  const controller = (): number | null => activeIdx.find(selfPicking) ?? null;

  const reps = new Map<number, Repeater>();
  const repOf = (i: number): Repeater => { let r = reps.get(i); if (!r) { r = new Repeater(20, 5); reps.set(i, r); } return r; };
  const anyRep = new Repeater(20, 5);

  const controllingSlot = (): number | null => {
    const ctl = controller();
    if (ctl !== null && !confirmed[ctl]) return null;
    return activeIdx.find(i => !selfPicking(i) && !confirmed[i]) ?? null;
  };

  return {
    activeIdx, confirmed, human, selfPicking, controllingSlot,
    get controller() { return controller(); },
    handle(inp, move, tryConfirm) {
      connected = inp.connected;
      if (inp.pressedAny & BTN.B) return true;
      const ctl = controller();
      for (const i of activeIdx) {
        if (!selfPicking(i)) continue;
        const pulse = repOf(i).step(inp.pads[i] & DIRS);
        if (confirmed[i]) {
          // Só o controlador continua tendo o que fazer depois de confirmar: o próprio dispositivo passa a
          // mover/confirmar quem está na vez da fila. Os outros humanos confirmados não afetam mais nada.
          if (i === ctl) {
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
      // Sem controlador (nenhum humano com dispositivo conectado): qualquer controle decide por todos, um de cada vez.
      if (ctl === null) {
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
