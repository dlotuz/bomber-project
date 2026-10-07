import { DEFAULT_KEYMAPS, DEFAULT_PADMAP, hasPowerKey, readGamepad, readKeyMap } from '../../src/input/input';
import { mkRound, run, placePx, cx, cy, BTN } from './helpers';

/** P1 com o P e o soco, olhando para a direita, com uma bomba para socar e um jogador para o P. */
function scene(ownP: boolean) {
  const s = mkRound();
  s.rules.powerKey = [ownP, false, false, false, false];
  const p = placePx(s, 0, cx(5), cy(1)); p.pItem = true; p.punch = true; p.face = 2;
  placePx(s, 1, cx(6), cy(1));
  return s;
}
const did = (ev: { type: string }[]) => [ev.some(e => e.type === 'p_punch'), ev.some(e => e.type === 'punch')];

describe('tecla própria do P (extra)', () => {
  it('sem tecla: o Y solta o P, como na ROM', () => {
    expect(did(run(scene(false), 1, { 0: BTN.Y }))).toEqual([true, false]);
  });
  it('sem tecla: o POWER não faz nada', () => {
    expect(did(run(scene(false), 1, { 0: BTN.POWER }))).toEqual([false, false]);
  });
  it('com tecla: o POWER solta o P', () => {
    expect(did(run(scene(true), 1, { 0: BTN.POWER }))).toEqual([true, false]);
  });
  it('com tecla: o Y não solta o P (fica só com o soco)', () => {
    expect(did(run(scene(true), 1, { 0: BTN.Y }))[0]).toBe(false);
  });
});

describe('tecla própria do P: entrada', () => {
  it('teclado e controle geram POWER só com a tecla/botão configurado', () => {
    const k = { ...DEFAULT_KEYMAPS[0] };
    expect(readKeyMap(new Set(['KeyP']), k) & BTN.POWER).toBe(0);
    expect(hasPowerKey('kb', k, DEFAULT_PADMAP)).toBe(false);
    k.power = 'KeyP';
    expect(readKeyMap(new Set(['KeyP']), k)).toBe(BTN.POWER);
    expect(hasPowerKey('kb', k, DEFAULT_PADMAP)).toBe(true);
    const pad = { buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 6 })), axes: [0, 0] };
    const noP = { ...DEFAULT_PADMAP, power: -1 };
    expect(readGamepad(pad, noP)).toBe(0);
    expect(hasPowerKey('gp0', k, noP)).toBe(false);
    expect(hasPowerKey('gp0', k, DEFAULT_PADMAP)).toBe(true);   // padrão: P no RB
    expect(readGamepad(pad, { ...DEFAULT_PADMAP, power: 6 })).toBe(BTN.POWER);
    expect(hasPowerKey('gp0', k, { ...DEFAULT_PADMAP, power: 6 })).toBe(true);
  });
});
