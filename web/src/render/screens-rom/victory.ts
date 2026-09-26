// VITÓRIA (T20): geometria da cena e desenho dos personagens pela ROM (§6.12, §7.4, §7.5).
import type { Anim, ObjEntry, Piece, RomAssets } from '../../app/rom-api';
import { bgr555ToRgba } from '../../app/rom-api';
import { newMap, obj, put, sceneMaps, type SceneMaps } from './scene';

/**
 * BG2 da cena `victory` (16 colunas × 14 linhas visíveis; o resto do mapa 32×32 fica em branco): palavras
 * `vhopppcc cccccccc` medidas em `victory.vram` (captura de `analise/extraido/graficos-formato/cenas`, endereço
 * de palavra $4400 = mosaico de rostos + moldura de cima). A origem exata na ROM (A14) é tarefa da T19
 * (`map-sources.ts`); enquanto `MAP_SOURCES.victory` não existir, `sceneMaps` usa esta função (mesma regra do
 * `menuMaps` da T7: números conferidos contra a captura, não o binário). BG1 da captura não tem conteúdo
 * pertencente à cena (sobra de VRAM não escrita por ela) e fica de fora.
 */
const BG2_ROWS: readonly (readonly number[])[] = [
  [0x190a, 0x190a, 0x190a, 0x16c4, 0x140c, 0x180a, 0x180a, 0x180a, 0x180a, 0x180a, 0x180a, 0x180a, 0x144a, 0x144c, 0x190a, 0x190a],
  [0x54c0, 0x158e, 0x146c, 0x146e, 0x180e, 0x1844, 0x1844, 0x1844, 0x1844, 0x1844, 0x1844, 0x580e, 0x146a, 0x16c6, 0x16ca, 0x16cc],
  [0x584e, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x156e],
  [0x1460, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x15ec],
  [0x1880, 0x08e2, 0x08a6, 0x58ec, 0x18ec, 0x18a8, 0x18aa, 0x18a8, 0x18aa, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x1882],
  [0x1442, 0x0864, 0x08c6, 0x18ac, 0x18ae, 0x18c8, 0x18ca, 0x18c8, 0x18ca, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x1882],
  [0x1862, 0x0884, 0x08a6, 0x58ec, 0x18ec, 0x18a8, 0x18aa, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x9448],
  [0x9442, 0x08a4, 0x08c6, 0x18ac, 0x18ae, 0x18c8, 0x18ca, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x1846],
  [0x1880, 0x08c4, 0x08a6, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x1846],
  [0x1880, 0x08e4, 0x08c6, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x1448],
  [0x1880, 0x0868, 0x08a6, 0x58ec, 0x18ec, 0x18a8, 0x18aa, 0x18a8, 0x18aa, 0x18a8, 0x18aa, 0x18a8, 0x18aa, 0x58ec, 0x18ec, 0x1882],
  [0x1880, 0x0888, 0x08c6, 0x18ac, 0x18ae, 0x18c8, 0x18ca, 0x18c8, 0x18ca, 0x18c8, 0x18ca, 0x18c8, 0x18ca, 0x18ac, 0x18ae, 0x1882],
  [0x1880, 0x0866, 0x08a6, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x1882],
  [0x1880, 0x0886, 0x08c6, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x1882],
];

export function victoryGeometry(_a: RomAssets): SceneMaps {
  const bg2 = newMap();
  BG2_ROWS.forEach((row, lin) => row.forEach((w, col) => put(bg2, col, lin, w)));
  return { bg2 };
}

/**
 * Fix round 1: a T19 achou a origem real na ROM (`MAP_SOURCES.victory`, descritor `$C2:9C17`) e ela decodifica
 * o BG1 **cru** (sem o `keepPalette` que a T19 usa nos menus) — porque nos menus uma rotina de tradução troca o
 * BG1 inteiro, mas no placar/vitória não há essa troca: o BG1 é literalmente o logotipo original "VICTORY!"
 * (achado da T18). Medido em `victory.vram` (linhas 2–6, colunas 2–14 do mapa — únicas linhas visíveis com
 * conteúdo): as casas do logotipo usam **só a paleta 6**; o resto do BG1 visível é 0. Como desenhamos
 * "VITÓRIA!" por conta própria (nosso texto, nossa animação de entrada em `textX()`), tiramos essas casas antes
 * de desenhar — mesma ideia do `keepPalette` da T19, só invertida (descarta a paleta do texto, não guarda a da
 * corda).
 */
const ENGLISH_TITLE_PAL = 6;
export function stripEnglishTitle(m: Uint16Array): Uint16Array {
  return m.map(w => (((w >> 10) & 7) === ENGLISH_TITLE_PAL ? 0 : w));
}

/** Mapas prontos para desenhar a cena `victory`: usa `MAP_SOURCES.victory` quando existir (T19), com o BG1
 *  sempre filtrado (`stripEnglishTitle`); sem ela, cai na geometria própria (`victoryGeometry`, só BG2). */
export function victoryMaps(a: RomAssets): SceneMaps {
  const maps = sceneMaps(a, 'victory', victoryGeometry);
  return maps.bg1 ? { ...maps, bg1: stripEnglishTitle(maps.bg1) } : maps;
}

/** Troféu dourado com asas (OBJ 16×16 × 6, paleta 7, prioridade 3): medido em `victory.oam`/`after_victory.oam`
 *  (colunas x = 104/120/136; a de cima é a base do padrão + a de baixo as asas/pedestal). Fica sempre no centro
 *  (x = 128), local y 200–232 (a base encosta no chão da cena, y local 224). */
const TROPHY_TOP = [452, 450, 454] as const;
const TROPHY_BOTTOM = [484, 482, 486] as const;
export const TROPHY_X0 = 104, TROPHY_TOP_Y = 200, TROPHY_ROW_H = 16;

/** Fix round 1: em Em Equipes, todos os campeões do time ficam sobre o troféu, com `champions[0]` por cima
 *  (§6.12) — como quem desenha por último fica na frente, a ordem de desenho é a inversa de `champions`. */
export function championDrawOrder(champions: readonly number[]): readonly number[] {
  return [...champions].reverse();
}

export function victoryOam(): ObjEntry[] {
  const cols = [0, 16, 32];
  const out: ObjEntry[] = [];
  cols.forEach((dx, i) => {
    out.push(obj(TROPHY_X0 + dx, TROPHY_TOP_Y, TROPHY_TOP[i], 7, { prio: 3 }));
    out.push(obj(TROPHY_X0 + dx, TROPHY_TOP_Y + TROPHY_ROW_H, TROPHY_BOTTOM[i], 7, { prio: 3 }));
  });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Personagens pela ROM (ANI §2, §7.4): amostra um `Anim` no tempo `t` e desenha os quadros 32×32 decodificados
// (`character(c).frame`/`victoryFrame`) com a paleta do slot. Âncora (X, Y) = pé do personagem: `(X−16, Y−24)`.

export function sampleAnim(anim: Anim, t: number): readonly Piece[] {
  if (!anim.length) return [];
  const total = anim.reduce((acc, f) => acc + (f.dur === 255 ? 0 : f.dur), 0);
  if (total <= 0) return anim[anim.length - 1].pieces;
  let k = ((t % total) + total) % total;
  for (const f of anim) {
    if (f.dur === 255) return f.pieces;
    if (k < f.dur) return f.pieces;
    k -= f.dur;
  }
  return anim[anim.length - 1].pieces;
}

const canvasCache = new WeakMap<Uint16Array, Map<string, HTMLCanvasElement>>();
function frameCanvas(idx: Uint8Array, pal: Uint16Array, key: string): HTMLCanvasElement {
  let m = canvasCache.get(pal);
  if (!m) { m = new Map(); canvasCache.set(pal, m); }
  let c = m.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const img = new ImageData(32, 32);
    for (let i = 0; i < idx.length; i++) {
      const v = idx[i]; if (!v) continue;
      const [r, g, b] = bgr555ToRgba(pal[v] ?? 0);
      img.data.set([r, g, b, 255], i * 4);
    }
    c.getContext('2d')!.putImageData(img, 0, 0);
    m.set(key, c);
  }
  return c;
}

/** Desenha o quadro amostrado de `anim` no tempo `t`, com a folha `sheet(g)` (32×32 índices, `g = piece.tile`)
 *  e a paleta de 16 cores do personagem no slot, âncora do pé em (`x`, `y`). */
export function drawCharAnim(ctx: CanvasRenderingContext2D, anim: Anim, t: number, sheet: (g: number) => Uint8Array,
  pal: Uint16Array, x: number, y: number, key: string): void {
  for (const p of sampleAnim(anim, t)) {
    const img = frameCanvas(sheet(p.tile), pal, `${key}:${p.tile}`);
    const dx = x - 16 + p.dx, dy = y - 24 + p.dy;
    if (!p.hflip && !p.vflip) { ctx.drawImage(img, dx, dy); continue; }
    ctx.save();
    ctx.translate(dx + (p.hflip ? 32 : 0), dy + (p.vflip ? 32 : 0));
    ctx.scale(p.hflip ? -1 : 1, p.vflip ? -1 : 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
}
