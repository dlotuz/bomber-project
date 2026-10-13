import { describe, expect, it } from 'vitest';
import { reshapeFrame } from '../../src/render/art/charshape';
import { HELMET_IDX, SKINS, skinPalette } from '../../src/render/art/charskins';

const W = 32;
/** Boneco sintético de frente: cabeça 13×11 com topo na linha 8 e viseira (5/4) no meio; tronco de 9 colunas a partir da 19. */
function doll(face: 'front' | 'back' | 'right' = 'front'): Uint8Array {
  const px = new Uint8Array(W * W);
  for (let y = 8; y <= 18; y++) for (let x = 10; x <= 22; x++) px[y * W + x] = 13;
  const vx = face === 'front' ? 14 : face === 'right' ? 18 : -1;
  if (vx >= 0) for (let y = 12; y <= 15; y++) for (let x = vx; x <= vx + 4; x++) px[y * W + x] = 5;
  for (let y = 19; y <= 28; y++) for (let x = 11; x <= 19; x++) px[y * W + x] = [8, 9, 10][(x + y) % 3];
  return px;
}
const at = (px: Uint8Array, x: number, y: number): number => px[y * W + x];
const rowsEqual = (a: Uint8Array, b: Uint8Array, y0: number, y1: number): boolean =>
  a.slice(y0 * W, (y1 + 1) * W).every((v, i) => v === b[y0 * W + i]);

describe('formas das skins (arte desenhada à mão)', () => {
  it('cartola: copa acima da cabeça, faixa na cor do time e aba sobre o topo; o corpo fica igual', () => {
    const src = doll(), out = reshapeFrame(src, 'hat');
    expect(at(out, 16, 4)).toBe(1);                  // topo da copa (contorno)
    expect(at(out, 16, 7)).toBe(10);                 // faixa, na cor do time
    expect(at(out, 16, 8)).toBe(1);                  // aba
    expect(at(out, 16, 0)).toBe(0);
    expect(rowsEqual(out, src, 14, 31)).toBe(true);
  });

  it('cartola: igual de frente, de costas e de lado (a copa fica no centro da cabeça)', () => {
    for (const f of ['back', 'right'] as const) {
      const out = reshapeFrame(doll(f), 'hat');
      expect(at(out, 16, 7)).toBe(10);
    }
  });

  it('pequeno: o boneco todo encolhido, com os pés no mesmo lugar e sem perder o contorno', () => {
    const src = doll(), out = reshapeFrame(src, 'small');
    const box = (px: Uint8Array): { y0: number; y1: number; x0: number; x1: number } => {
      let y0 = W, y1 = -1, x0 = W, x1 = -1;
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (px[y * W + x]) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      return { y0, y1, x0, x1 };
    };
    const a = box(src), b = box(out);
    expect(b.y1).toBe(a.y1);
    expect(b.y1 - b.y0).toBeLessThan((a.y1 - a.y0) * 0.9);
    expect(b.x1 - b.x0).toBeLessThanOrEqual(a.x1 - a.x0);
    expect([...out].filter(Boolean).length).toBeGreaterThan(40);
  });

  it('terno: o corpo na cor do time fica escuro; de frente aparece a gravata na cor do time', () => {
    const src = doll(), out = reshapeFrame(src, 'suit');
    for (let y = 19; y <= 28; y++) for (let x = 11; x <= 19; x++) expect([1, 11, 14, 10]).toContain(at(out, x, y));
    expect(at(out, 16, 19)).toBe(10);
    expect(rowsEqual(out, src, 8, 12)).toBe(true);   // o alto da cabeça não muda
    const back = reshapeFrame(doll('back'), 'suit');
    expect([1, 11]).toContain(at(back, 16, 19));      // de costas: só o paletó, sem gravata
  });

  it('terno: a cabeça não ganha nada (sem óculos nem bigode), em nenhuma direção', () => {
    for (const f of ['front', 'back', 'right'] as const) {
      const src = doll(f), out = reshapeFrame(src, 'suit');
      expect(rowsEqual(out, src, 8, 18)).toBe(true);
    }
  });

  it('gordão: de frente e de costas só um pontinho rosa de cada lado da barriga; de lado as luvas sobre a barriga', () => {
    const pinkAt = (face: 'front' | 'back' | 'right'): number => {
      const out = reshapeFrame(doll(face), 'fat');
      let n = 0;
      for (let y = 18; y <= 24; y++) for (let x = 0; x < W; x++) if (out[y * W + x] === 7) n++;
      return n;
    };
    expect(pinkAt('front')).toBe(2);
    expect(pinkAt('back')).toBe(2);
  });

  it('gordão: barriga bem mais larga no mesmo tamanho, camisa listrada e barriga de fora', () => {
    const src = doll(), out = reshapeFrame(src, 'fat');
    const span = (px: Uint8Array, y: number): number => px.slice(y * W, (y + 1) * W).filter(Boolean).length;
    const top = (px: Uint8Array): number => px.findIndex(v => v !== 0) >> 5;
    const bottom = (px: Uint8Array): number => (px.length - 1 - [...px].reverse().findIndex(v => v !== 0)) >> 5;
    expect(bottom(out)).toBe(bottom(src));
    expect(top(out)).toBeGreaterThanOrEqual(top(src));      // gordo, não gigante: a cabeça assenta na barriga (sem pescoço)
    expect(top(out)).toBeLessThanOrEqual(top(src) + 2);
    expect(span(out, 22)).toBeGreaterThan(span(src, 22) * 1.5);
    const whites = [...out].filter(v => v === 14).length;
    expect(whites).toBeGreaterThan(10);
  });

  it('quadros sem cabeça inteira (efeito, sombra) e quadros baixos não mudam', () => {
    const small = new Uint8Array(W * W);
    for (let y = 24; y < 29; y++) for (let x = 8; x < 24; x++) small[y * W + x] = 1;
    for (const s of ['hat', 'small', 'suit', 'fat'] as const) expect(reshapeFrame(small, s)).toBe(small);
    expect(reshapeFrame(new Uint8Array(W * W), 'fat')).toEqual(new Uint8Array(W * W));
  });

  it('formas novas (acessórios, fantasias, alto, cabeção): mudam o boneco nas 3 direções, sem sair do quadro', () => {
    const NEW = ['crown', 'cowboy', 'ninja', 'pirate', 'cape', 'chef', 'tall', 'bighead',
      'antenna', 'bow', 'mohawk', 'wizard', 'safari', 'plume', 'bubble', 'board'] as const;
    for (const shape of NEW) for (const f of ['front', 'back', 'right'] as const) {
      const src = doll(f);
      for (let y = 27; y <= 28; y++) for (let x = 11; x <= 19; x++) src[y * W + x] = 6;   // botas (o altão estica até elas)
      const out = reshapeFrame(src, shape);
      expect(out, `${shape} ${f}`).toHaveLength(W * W);
      expect(Array.from(out), `${shape} ${f}`).not.toEqual(Array.from(src));
      expect(Math.max(...out), `${shape} ${f}`).toBeLessThan(16);   // só índices da paleta (0–15)
    }
    const small = new Uint8Array(W * W);
    for (let y = 24; y < 29; y++) for (let x = 8; x < 24; x++) small[y * W + x] = 1;
    for (const shape of NEW) expect(reshapeFrame(small, shape)).toBe(small);   // efeito/sombra: igual
  });

  it('várias formas se combinam, em ordem', () => {
    const src = doll(), both = reshapeFrame(src, ['suit', 'hat']);
    expect(both).toEqual(reshapeFrame(reshapeFrame(src, 'suit'), 'hat'));
  });

  it('as skins partem do Blanco com as cores originais; só as de capacete trocam as cores 12–14', () => {
    const pal = Uint16Array.from({ length: 16 }, (_, i) => (0x1111 * (i + 1)) & 0x7fff);
    for (const s of SKINS) {
      expect(s.base).toBe(0);
      expect(s.tint).toBeUndefined();
      const out = skinPalette(pal, s);
      for (let i = 0; i < 16; i++) if (!s.helmet || !HELMET_IDX.includes(i as 12)) expect(out[i]).toBe(pal[i]);
      if (s.helmet) expect(HELMET_IDX.map(i => out[i])).not.toEqual(HELMET_IDX.map(i => pal[i]));
    }
  });
});
