// Sombra chapada que a ROM desenha no próprio sprite. Os quadros dos personagens (folhas p24($C2:0730 + 3c)), das
// montarias (MOUNT_GFX) e dos trajes trazem, sob os pés, uma elipse chapada na cor preta da paleta — que é também a
// cor do contorno. Com os efeitos ligados a camada de efeitos desenha uma sombra suave no chão (fx/shadows); para
// não haver duas, o jogador VIVO sai sem a elipse da ROM. Nada fora da elipse muda:
//  - a máscara da elipse sai do próprio quadro, linha a linha de baixo para cima: cada linha vai de uma borda à outra
//    da elipse — ponta do desenho na cor da sombra com outra coisa logo fora; se um pé ou o corpo cobre uma das
//    bordas, ela sai do espelho da outra (a elipse é simétrica). A largura tem de caber na forma medida da família
//    (± TOL) e o perfil tem de ser de elipse (cresce, um patamar, depois só diminui, e não desce mais linhas do que
//    subiu). Na 1ª linha que não bate a máscara para — dali para cima nada muda;
//  - sem ≥ 3 linhas de máscara o quadro fica como na ROM (`kept`) e o fx não desenha a suave para esse jogador;
//  - dentro da máscara sai só o pixel da cor da sombra que não encosta em outra cor (o contorno dos pés fica).
import type { ObjEntry } from '../ppu';

/** Elipse de uma família de quadros: cor (índice) e formas possíveis, larguras de baixo para cima. */
export interface ShadowFamily {
  color: number; shapes: readonly (readonly number[])[];
  /** Centro (2·x, soma das pontas) da elipse no quadro, para quando uma ponta da linha de baixo está coberta. */
  centers?: readonly number[];
}

/** Personagens (os 6, a pé): 9/13/15/13/9 px — char 0 parado ↓ (quadro 6), linhas 24–28, colunas 12–20…9–23. */
export const CHAR_SHADOW: ShadowFamily = { color: 1, shapes: [[9, 13, 15, 13, 9]] };
/** Trajes (COSTUME_SHEETS; peças `& $100` vêm de SHEET2 = folha da montaria tipo 2). */
export const COSTUME_SHADOW: ShadowFamily = { color: 1, shapes: [[8, 12, 14, 12, 8], [6, 10, 12, 12, 10, 6]] };
/** Montarias por tipo (folhas MOUNT_GFX; cor = o preto da paleta OBJ de cada tipo, ver mounts/layer.ts). A linha de
 *  cima da elipse fica escondida pelo corpo em alguns tipos; as formas são as simétricas de 5 ou 6 linhas medidas.
 *  Fora da tabela (tipo E, a máquina: a base preta dela é da mesma cor e encosta na elipse — não dá para separar):
 *  o quadro fica como na ROM. */
export const MOUNT_SHADOW: Readonly<Record<number, ShadowFamily>> = {
  0x1: { color: 1, shapes: [[7, 11, 13, 13, 11, 7]] },
  0x2: { color: 1, shapes: [[6, 10, 12, 12, 10, 6]] },
  0x3: { color: 0xb, shapes: [[6, 10, 12, 10, 6]] },
  0x4: { color: 4, shapes: [[10, 14, 16, 16, 14, 10]] },
  0x5: { color: 4, shapes: [[8, 12, 14, 14, 12, 8]] },
  0x6: { color: 1, shapes: [[10, 14, 16, 16, 14, 10]], centers: [31] },
  0x9: { color: 1, shapes: [[7, 11, 13, 13, 11, 7]] },
  0xa: { color: 1, shapes: [[6, 10, 12, 10, 6]] },
  0xb: { color: 5, shapes: [[8, 12, 14, 14, 12, 8]] },
  0xc: { color: 4, shapes: [[6, 10, 12, 12, 10, 6]] },
  0xd: { color: 1, shapes: [[7, 11, 13, 13, 11, 7]] },
  0xf: { color: 1, shapes: [[6, 10, 12, 12, 10, 6]] },
};

/** `stripped`: elipse encaixada e tirada; `none`: o quadro não tem elipse (no ar, sentado na montaria…); `kept`: há
 *  uma elipse que não encaixa com certeza — fica a da ROM (e o fx não desenha a suave para esse jogador). */
export type ShadowStatus = 'stripped' | 'none' | 'kept';
export interface ShadowResult { px: Uint8Array; status: ShadowStatus; mask: Uint8Array | null }

const cache = new WeakMap<Uint8Array, Map<string, ShadowResult>>();

/** Quadro `size`×`size` (índices, linha a linha) sem a elipse da família `fam`. Pura e em cache. */
export function stripBakedShadow(px: Uint8Array, size: number, fam: ShadowFamily): ShadowResult {
  let m = cache.get(px);
  if (!m) { m = new Map(); cache.set(px, m); }
  const key = `${size}|${fam.color}|${fam.shapes.map(s => s.join(',')).join(';')}`;
  let r = m.get(key);
  if (!r) { r = strip(px, size, fam); m.set(key, r); }
  return r;
}

/** Folga na largura de cada linha em relação às formas medidas (quadros desenhados à mão: 8/12/14, 9/12/14…). */
const TOL = 3;
/** Linhas de máscara para valer (a de baixo + 2). */
const MIN_ROWS = 3;

function strip(px: Uint8Array, size: number, fam: ShadowFamily): ShadowResult {
  const k = fam.color;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= size || y >= size ? 0 : px[y * size + x]);
  let low = -1;
  for (let y = size - 1; y >= 0 && low < 0; y--) for (let x = 0; x < size; x++) if (px[y * size + x]) { low = y; break; }
  if (low < 0) return { px, status: 'none', mask: null };
  if (!fam.shapes.length) return { px, status: 'kept', mask: null };
  const shadowIn = (y: number) => { let n = 0; for (let x = 0; x < size; x++) if (at(x, y) === k) n++; return n; };
  const minBottom = Math.min(...fam.shapes.map(sh => sh[0]));
  if (shadowIn(low) + shadowIn(low - 1) < minBottom) return { px, status: 'none', mask: null };   // no ar, sentado…
  const maxRows = Math.max(...fam.shapes.map(sh => sh.length));
  const lo = (i: number) => Math.min(...fam.shapes.map(sh => sh[Math.min(i, sh.length - 1)])) - TOL;
  const hi = (i: number) => Math.max(...fam.shapes.map(sh => sh[Math.min(i, sh.length - 1)])) + TOL;
  const ends = (y: number): [number, number] | null => {
    let L = -1, R = -1;
    for (let x = 0; x < size; x++) if (at(x, y)) { if (L < 0) L = x; R = x; }
    return L < 0 ? null : [L, R];
  };

  // uma ponta é borda da elipse: na cor da sombra, com outra coisa logo fora
  const okL = (y: number, L: number) => at(L, y) === k && at(L - 1, y) !== k;
  const okR = (y: number, R: number) => at(R, y) === k && at(R + 1, y) !== k;
  let best: [number, number][] | null = null;
  for (const yb of [low, low - 1]) for (const cen of [null, ...(fam.centers ?? [])]) {
    const e0 = ends(yb);
    if (!e0) continue;
    // linha de baixo: tira sem buracos com as duas pontas de borda; ou uma ponta coberta por um pé (aí a maioria da
    // linha é sombra e o centro vem da linha de cima, se as duas pontas dela são borda, ou do centro da família)
    const [D0, E0] = e0;
    let gaps = 0, n = 0;
    for (let x = D0; x <= E0; x++) { const v = at(x, yb); if (!v) gaps++; else if (v === k) n++; }
    if (gaps) continue;
    const l0 = okL(yb, D0), r0 = okR(yb, E0);
    let c2: number, L0 = D0, R0 = E0;
    if (l0 && r0) { if (cen !== null) continue; c2 = D0 + E0; }
    else {
      if (!(l0 || r0) || 2 * n < E0 - D0 + 1) continue;
      if (cen === null) {
        const e1 = ends(yb - 1);
        if (!e1 || !okL(yb - 1, e1[0]) || !okR(yb - 1, e1[1])) continue;
        c2 = e1[0] + e1[1];
      } else c2 = cen;
      if (r0) { L0 = c2 - E0; if (L0 < D0 || L0 > E0) continue; } else { R0 = c2 - D0; if (R0 > E0 || R0 < D0) continue; }
    }
    const w0 = R0 - L0 + 1;
    if (w0 < lo(0) || w0 > hi(0)) continue;
    const rows: [number, number][] = [[L0, R0]];
    let up = 1, down = 0, prevW = w0, falling = false, plateau = false;
    for (let i = 1; i < maxRows; i++) {
      const y = yb - i, e = ends(y);
      if (!e) break;
      const [D, E] = e, [pL, pR] = rows[i - 1];
      const l = okL(y, D) && Math.abs(D - pL) <= TOL, r = okR(y, E) && Math.abs(E - pR) <= TOL;
      let L: number, R: number;
      if (l && r) { L = D; R = E; }                        // as duas bordas à vista (desenho à mão: nem sempre simétrico)
      else if (r && !l) { R = E; L = c2 - E; }             // a esquerda está coberta (pé, corpo): espelha
      else if (l && !r) { L = D; R = c2 - D; }
      else break;
      if (L < D || R > E || !at(L, y) || !at(R, y)) break;   // o espelho cai fora do desenho: não é a elipse
      const w = R - L + 1;
      if (w < lo(i) || w > hi(i)) break;
      if (w > prevW) { if (falling) break; }                          // voltou a crescer: já é o corpo
      else if (w === prevW) { if (falling || plateau) break; plateau = true; }   // um patamar só, no meio
      else falling = true;
      if (!falling) up++;
      else if (++down > up - 1) break;                                 // não desce mais linhas do que subiu
      rows.push([L, R]); prevW = w;
    }
    if (rows.length >= MIN_ROWS && (!best || rows.length > best.length)) best = rows.map(([L, R], i) => [L + (yb - i) * size, R + (yb - i) * size]);
  }
  if (!best) return { px, status: 'kept', mask: null };

  const mask = new Uint8Array(size * size), res = Uint8Array.from(px);
  for (const [a, b] of best) for (let i = a; i <= b; i++) mask[i] = 1;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || px[i] !== k) continue;
    const x = i % size, y = (i / size) | 0;
    const edge = [at(x, y - 1), at(x, y + 1), at(x - 1, y), at(x + 1, y)].some(v => v !== 0 && v !== k);
    if (!edge) res[i] = 0;
  }
  return { px: res, status: 'stripped', mask };
}

/** A mesma entrada de OAM com o quadro sem a elipse (só peças de pixels próprios, sem espelho vertical); o espelho
 *  horizontal não muda a elipse (simétrica). */
export function withoutBakedShadow(e: ObjEntry, fam: ShadowFamily): { e: ObjEntry; status: ShadowStatus } {
  const src = e.src as { px?: Uint8Array };
  if (!src.px || e.vflip) return { e, status: 'none' };
  const r = stripBakedShadow(src.px, e.size, fam);
  return { e: r.status === 'stripped' ? { ...e, src: { px: r.px } } : e, status: r.status };
}
