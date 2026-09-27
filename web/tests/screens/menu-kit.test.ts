import { Menu, type MenuRow } from '../../src/screens/menu';
import { drawStaticBackground, drawStaticCursor, drawFallbackFrame } from '../../src/screens/ui';
import { Repeater } from '../../src/input/repeat';
import { BTN } from '../../src/game/core-api';
import { RecordingSink } from './helpers';

const rows = (n: number, extra: Partial<MenuRow>[] = []): MenuRow[] => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, ...extra[i] }));
const step = (m: Menu, s: RecordingSink, held: number, edge = held) => m.update(held, edge, s);

describe('Menu (spec §6: volta, limites, SFX, repetição)', () => {
  it('↑/↓ dão a volta e pulam desativados; SFX $01 a cada movimento', () => {
    const s = new RecordingSink();
    const m = new Menu(rows(3, [{ disabled: true }]));
    expect(m.cursor).toBe(1);
    expect(step(m, s, BTN.DOWN)).toBe('moved'); step(m, s, 0);
    expect(m.cursor).toBe(2);
    step(m, s, BTN.DOWN); step(m, s, 0);
    expect(m.cursor).toBe(1);
    step(m, s, BTN.UP); step(m, s, 0);
    expect(m.cursor).toBe(2);
    expect(s.of('sfx').map(c => c.id)).toEqual([1, 1, 1]);
  });
  it('um só item ativo: ↑/↓ tocam $01 e o cursor fica (R31)', () => {
    const s = new RecordingSink();
    const m = new Menu(rows(3, [{}, { disabled: true }, { disabled: true }]));
    step(m, s, BTN.DOWN);
    expect([m.cursor, s.of('sfx').length]).toEqual([0, 1]);
  });
  it('←/→ mudam o valor; no limite devolve "limit" e o SFX toca igual', () => {
    const s = new RecordingSink();
    let v = 1;
    const m = new Menu([{ id: 'v', left: () => (v > 0 ? (v--, true) : false), right: () => (v < 2 ? (v++, true) : false) }]);
    expect(step(m, s, BTN.RIGHT)).toBe('changed'); step(m, s, 0);
    expect(step(m, s, BTN.RIGHT)).toBe('limit'); step(m, s, 0);
    expect(v).toBe(2);
    expect(s.of('sfx').map(c => c.id)).toEqual([1, 1]);
  });
  it('A ou START selecionam ($02); select → false recusa ($03); B volta ($03)', () => {
    const s = new RecordingSink();
    let ok = true; let n = 0;
    const m = new Menu([{ id: 'x', select: () => { n++; return ok; } }]);
    expect(step(m, s, BTN.A)).toBe('selected'); step(m, s, 0);
    expect(step(m, s, BTN.START)).toBe('selected'); step(m, s, 0);
    ok = false;
    expect(step(m, s, BTN.A)).toBe('refused'); step(m, s, 0);
    expect(step(m, s, BTN.B)).toBe('back');
    expect([n, ...s.of('sfx').map(c => c.id)]).toEqual([3, 2, 2, 3, 3]);
  });
  it('B tem prioridade sobre A no mesmo frame; X, Y, L, R e SELECT não fazem nada', () => {
    const s = new RecordingSink();
    const m = new Menu([{ id: 'x', select: () => true }]);
    expect(step(m, s, BTN.A | BTN.B)).toBe('back'); step(m, s, 0);
    expect(step(m, s, BTN.X | BTN.Y | BTN.L | BTN.R | BTN.SELECT)).toBeNull();
  });
  it('segurar ↓: move no frame 0, 20, 25, 30…', () => {
    const s = new RecordingSink();
    const m = new Menu(rows(10));
    for (let f = 0; f < 31; f++) m.update(BTN.DOWN, f === 0 ? BTN.DOWN : 0, s);
    expect(m.cursor).toBe(4);
  });
  it('repetição configurável e cursor inicial', () => {
    const m = new Menu(rows(10), { repeat: new Repeater(36, 21), cursor: 3 });
    const s = new RecordingSink();
    for (let f = 0; f < 58; f++) m.update(BTN.DOWN, f === 0 ? BTN.DOWN : 0, s);
    expect(m.cursor).toBe(6);
  });
});

describe('fallback parado (spec §6.14)', () => {
  const rec = () => {
    const calls: string[] = [];
    const ctx = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { calls.push(`${this.fillStyle}:${x},${y},${w},${h}`); } };
    return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
  };
  it('fundo e cursor não dependem do tempo', () => {
    const a = rec(), b = rec();
    drawStaticBackground(a.ctx); drawStaticBackground(b.ctx);
    expect(a.calls).toEqual(b.calls);
    const c = rec();
    drawStaticCursor(c.ctx, 56, 80);
    expect(c.calls.every(k => k.includes(':56,') || k.includes(':57,') || k.includes(':58,') || k.includes(':59,'))).toBe(true);
  });
  it('moldura de fallback cobre o retângulo medido', () => {
    const r = rec();
    drawFallbackFrame(r.ctx, { x0: 7, y0: 51, x1: 248, y1: 186 });
    expect(r.calls.some(k => k.endsWith(':7,51,242,136'))).toBe(true);
  });
});
