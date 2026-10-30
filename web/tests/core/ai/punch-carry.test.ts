// IA com luva e soco segurando bomba: o Y com algo na mão larga a bomba ($C2:48E1 → $C2:4BC4), então a CPU não deve
// apertar Y enquanto segura (ou levanta) — a decisão da luva vem antes do soco em `decideActions`.
import { arena, put, C } from '../kit';
import { createAi, aiInputs } from '../../../src/core/ai';
import { addBomb } from '../../../src/core/bombs';
import { startLift } from '../../../src/core/flyers';
import { step } from '../../../src/core/step';
import { BTN } from '../../../src/core/types';

const CPU0 = [true, false, false, false, false];

describe('IA: não soca com bomba na mão', () => {
  for (const pItem of [false, true]) {
    it(`soco no ponto à frente e adversário no pouso: segurando, nunca aperta Y${pItem ? ' (com o P)' : ''}`, () => {
      const s = arena(); const p = put(s, 0, 4, 3); p.glove = true; p.punch = true; p.pItem = pItem; p.face = 2;
      put(s, 1, 8, 3);
      addBomb(s, 0, C(4, 3), { fuse: 150, fire: 1 });
      addBomb(s, 1, C(5, 3), { fuse: 60, fire: 1 });            // o soco dela cairia na cabeça do adversário
      expect(startLift(s, p, [])).toBe(true);
      const ai = createAi();
      let held = 0;
      for (let i = 0; i < 120 && s.players[0].state === 'alive'; i++) {
        const inp = aiInputs(s, ai, CPU0, 2);
        inp[1] = 0;
        if (p.carry >= 0) { held++; expect(inp[0] & (BTN.Y | BTN.POWER), `tick ${i}`).toBe(0); }
        step(s, inp);
      }
      expect(held).toBeGreaterThan(0);
    });
  }
});
