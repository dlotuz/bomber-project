// IA: bomba na cabeça no tempo certo (soco e luva). A vítima (slot 1) fica parada até ser atordoada — como quem não viu
// a bomba vindo — e daí em diante é uma CPU Forte tentando fugir: só morre se o pavio estava no ponto.
import { arena, put, C } from '../kit';
import { createAi, aiInputs } from '../../../src/core/ai';
import { killFuse, punchKill } from '../../../src/core/ai/actions';
import { addBomb } from '../../../src/core/bombs';
import { step } from '../../../src/core/step';
import { BTN, type Bomb, type GameEvent, type RoundState } from '../../../src/core/types';

const CPU0 = [true, false, false, false, false];
const BOTH = [true, true, false, false, false];

/** Roda até `n` ticks: slot 0 CPU (ou `script`), slot 1 parado até ser atordoado e CPU depois. `fuseAt`: pavio da
 *  bomba `b` no tick do soco/arremesso. */
function duel(s: RoundState, n: number, b?: Bomb, script?: (t: number) => number) {
  const ai = createAi();
  const ev: GameEvent[] = [];
  let stunned = false, fuseAt = -1, deadAt = -1;
  for (let i = 0; i < n; i++) {
    const inp = aiInputs(s, ai, stunned ? BOTH : CPU0, 2);
    if (!stunned) inp[1] = 0;
    if (script) inp[0] = script(i);
    const e = step(s, inp);
    ev.push(...e);
    if (b && fuseAt < 0 && e.some(x => (x.type === 'punch' || x.type === 'throw') && x.slot === 0)) fuseAt = b.fuse;
    if (e.some(x => x.type === 'stunned' && x.slot === 1)) stunned = true;
    if (s.players[1].state !== 'alive') { deadAt = i; break; }
  }
  return { ev, fuseAt, deadAt, stunned };
}

describe('IA: bomba na cabeça no tempo certo', () => {
  it('killFuse: arremesso a 3 casas mata com pavio até ~55; casa vazia ou colega não', () => {
    const s = arena({ players: 3 }); const p = put(s, 0, 4, 3); put(s, 1, 7, 3); put(s, 2, 7, 9);
    const b = addBomb(s, 0, C(4, 3), { fire: 1 });
    const kf = killFuse(s, p, b, C(7, 3), 1);
    expect(kf).toBeGreaterThanOrEqual(45);
    expect(kf).toBeLessThanOrEqual(60);
    expect(killFuse(s, p, b, C(6, 3), 1)).toBe(-1);
    s.rules.mode = 'team'; s.players[0].team = 0; s.players[1].team = 0;
    expect(killFuse(s, p, b, C(7, 3), 1)).toBe(-1);
  });

  it('killFuse confere com o núcleo: com o pavio dele a vítima que foge ao acordar morre; com 126, escapa', () => {
    const scene = (fuse: number) => {
      const s = arena(); const p = put(s, 0, 4, 3); p.glove = true; p.face = 2; put(s, 1, 7, 3);
      const b = addBomb(s, 0, C(4, 3), { fuse, fire: 1 });
      return { s, p, b };
    };
    const { s, p, b } = scene(0);
    const kf = killFuse(s, p, b, C(7, 3), 1);
    const run = (fuse: number) => { const sc = scene(fuse); return duel(sc.s, 250, undefined, t => (t < 13 ? BTN.A : 0)); };
    for (const f of [0, Math.floor(kf / 2), kf]) expect(run(f).deadAt, `pavio ${f}`).toBeGreaterThanOrEqual(0);
    const late = run(126);
    expect([late.stunned, late.deadAt]).toEqual([true, -1]);
  });

  it('luva: sobre a própria bomba nova, espera o pavio baixar, arremessa na cabeça e mata', () => {
    const s = arena(); const p = put(s, 0, 4, 3); p.glove = true; p.face = 2; put(s, 1, 7, 3);
    const b = addBomb(s, 0, C(4, 3), { fire: 1 });
    const kf = killFuse(s, p, b, C(7, 3), 1);
    const r = duel(s, 300, b);
    expect(r.fuseAt).toBeGreaterThanOrEqual(0);
    expect(r.fuseAt).toBeLessThanOrEqual(kf);
    expect(r.ev).toContainEqual({ type: 'stunned', slot: 1 });
    expect(r.deadAt).toBeGreaterThanOrEqual(0);
    expect(s.players[0].state).toBe('alive');
  });

  it('luva: vira para o adversário que está de lado antes de arremessar', () => {
    const s = arena(); const p = put(s, 0, 4, 3); p.glove = true; p.face = 4; put(s, 1, 7, 3);
    const b = addBomb(s, 0, C(4, 3), { fire: 1 });
    const r = duel(s, 300, b);
    expect(r.ev).toContainEqual({ type: 'stunned', slot: 1 });
    expect(r.deadAt).toBeGreaterThanOrEqual(0);
    expect(s.players[0].state).toBe('alive');
  });

  it('soco: pavio longo — espera olhando para a bomba e soca no ponto; a vítima morre', () => {
    const s = arena(); const p = put(s, 0, 4, 3); p.punch = true; p.face = 2; put(s, 1, 8, 3);
    const b = addBomb(s, 1, C(5, 3), { fuse: 120, fire: 1 });
    const kf = punchKill(s, p, b, 2);
    expect(kf).toBeGreaterThan(30);
    const r = duel(s, 300, b);
    expect(r.fuseAt).toBeGreaterThanOrEqual(0);
    expect(r.fuseAt).toBeLessThanOrEqual(kf);
    expect(r.fuseAt).toBeGreaterThan(kf - 10);                 // não espera à toa depois de entrar no ponto
    expect(r.deadAt).toBeGreaterThanOrEqual(0);
    expect(s.players[0].state).toBe('alive');
  });

  it('soco: bomba ao lado — vira para ela e soca', () => {
    const s = arena(); const p = put(s, 0, 4, 3); p.punch = true; p.face = 4; put(s, 1, 8, 3);
    const b = addBomb(s, 1, C(5, 3), { fuse: 50, fire: 1 });
    const r = duel(s, 200, b);
    expect(r.fuseAt).toBeGreaterThanOrEqual(0);
    expect(r.deadAt).toBeGreaterThanOrEqual(0);
  });

  it('soco: anda até atrás da bomba cujo soco cai no adversário', () => {
    const s = arena(); const p = put(s, 0, 2, 3); p.punch = true; p.face = 4; put(s, 1, 8, 3);
    const b = addBomb(s, 1, C(5, 3), { fuse: 120, fire: 1 });
    const r = duel(s, 300, b);
    expect(r.ev).toContainEqual({ type: 'punch', slot: 0 });
    expect(r.deadAt).toBeGreaterThanOrEqual(0);
    expect(s.players[0].state).toBe('alive');
  });
});
