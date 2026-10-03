// Y da montaria andando contra a bomba (ajuste aj-ymove). Medido no emulador (st_arena01, ovo forçado; scripts em
// scratchpad/ymove: walk_y.py, kick_y.py, kf4.py). Na rotina montada ($C2:141C) a ordem é: movimento ($C2:2F3A) →
// soco do tipo 9 ($C2:48E1) → Y por tipo ($C2:4625, tabela $C2:465F) → chute ($C2:4307). Os tipos 9 (sempre, $C2:4939),
// 4 ($C2:46AD) e D ($C2:47BF) saem com SEC e encerram a vez: com o item Chute, o Y no tick do encosto não chuta.
// C ($C2:47D1), E ($C2:471C) e F ($C2:476A) saem com CLC: o chute ainda acontece no mesmo tick.
import { mkRound, placePx, ride, run, BTN, cx, cy, X } from './helpers';
import { cellOf } from '../../src/core/mounts/core-api';
import { addBomb } from '../../src/core/bombs';
import type { RoundState } from '../../src/core/types';

/** Bomba na (3,1) com caminho livre à direita; P1 montado em (2,1), encostado nela, olhando para ela. */
function contact(type: number, kick: boolean) {
  const s = mkRound();
  const b = addBomb(s, 1, cellOf(3, 1));
  const p = placePx(s, 0, cx(2), cy(1));
  p.face = 2; p.kick = kick;
  ride(s, 0, type);
  return { s, b, p };
}
const stateOf = (s: RoundState, id: number): string => s.bombs.find(q => q.id === id)?.state ?? 'gone';

describe('tipo 9: soco andando contra a bomba', () => {
  // walk_y.py: bomba no centro x = 31, P1 vindo de x = 71 para a esquerda; o soco sai com x (já movido) ≤ 54
  // (casa da frente = a da bomba) e não sai com x = 56 (bomba a 2 casas). Y é borda ($88 bit $4000): segurar não repete.
  function approach(k: number) {
    const s = mkRound();
    const b = addBomb(s, 1, cellOf(2, 1));
    const p = placePx(s, 0, 71, cy(1));
    p.face = 6;
    ride(s, 0, 0x9);
    run(s, k, { 0: BTN.LEFT });
    const ev = run(s, 1, { 0: BTN.LEFT | BTN.Y });
    return { s, b, p, ev };
  }
  it('vindo de longe: x = 56 no tick do Y não soca; x = 54 soca', () => {
    const far = approach(14);
    expect(X(far.p)).toBe(56);
    expect(far.ev.some(e => e.type === 'punch')).toBe(false);
    const near = approach(16);
    expect(X(near.p)).toBe(54);
    expect(near.ev.some(e => e.type === 'punch')).toBe(true);
    expect(stateOf(near.s, near.b.id)).toBe('air');
  });

  it('com Chute, Y no tick do encosto soca em vez de chutar (kf4.py: T=9 chute=1 Y@0 → +$1C = 1)', () => {
    const { s, b } = contact(0x9, true);
    const ev = run(s, 1, { 0: BTN.RIGHT | BTN.Y });
    expect(ev.some(e => e.type === 'bomb_kicked')).toBe(false);
    expect(ev.some(e => e.type === 'punch')).toBe(true);
    expect(stateOf(s, b.id)).toBe('air');
  });

  it('com Chute, empurrando a bomba contra a parede (chute que não sai), o Y soca (kick_y.py)', () => {
    const s = mkRound();
    const b = addBomb(s, 1, cellOf(2, 1));   // a (1,1) é parede: o chute nunca sai
    const p = placePx(s, 0, 71, cy(1));
    p.face = 6; p.kick = true;
    ride(s, 0, 0x9);
    run(s, 40, { 0: BTN.LEFT });
    expect(X(p)).toBe(47);
    const ev = run(s, 1, { 0: BTN.LEFT | BTN.Y });
    expect(ev.some(e => e.type === 'punch')).toBe(true);
    expect(stateOf(s, b.id)).toBe('air');
  });

  it('sem Y, com Chute, o encosto chuta (controle)', () => {
    const { s, b } = contact(0x9, true);
    run(s, 1, { 0: BTN.RIGHT });
    expect(stateOf(s, b.id)).toBe('kicked');
  });
});

describe('outras montarias: Y no tick do encosto, com Chute', () => {
  it('tipo 4: a investida encerra a vez; bate na bomba parada no tick seguinte e só o tick 2 chuta (kf4.py)', () => {
    const { s, b, p } = contact(0x4, true);
    run(s, 1, { 0: BTN.RIGHT | BTN.Y });
    expect(stateOf(s, b.id)).toBe('idle');
    run(s, 1, { 0: BTN.RIGHT });
    expect(stateOf(s, b.id)).toBe('idle');
    expect(X(p)).toBe(31);
    run(s, 1, { 0: BTN.RIGHT });
    expect(stateOf(s, b.id)).toBe('kicked');
  });

  it('tipo D: lançar a montaria encerra a vez, sem chute no tick (kf4.py: +$1C continua 0)', () => {
    const { s, b } = contact(0xd, true);
    const ev = run(s, 1, { 0: BTN.RIGHT | BTN.Y });
    expect(ev.some(e => e.type === 'bomb_kicked')).toBe(false);
    expect(stateOf(s, b.id)).toBe('idle');
  });

  it.each([0xc, 0xe, 0xf])('tipo %s: o Y sai com CLC e o chute acontece no mesmo tick (kf4.py: +$1C = 2)', type => {
    const { s, b } = contact(type, true);
    const ev = run(s, 1, { 0: BTN.RIGHT | BTN.Y });
    expect(ev.some(e => e.type === 'bomb_kicked')).toBe(true);
    expect(stateOf(s, b.id)).toBe('kicked');
  });
});
