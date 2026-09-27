// Cena do título (A14, CAT `title`). O BG1 traz o logo original "SUPER BOMBER MAN 4" (achado da T19 ao investigar
// `MAP_SOURCES`: lido da ROM em tempo de execução por `sceneMaps`/`decodeSceneMap`, nenhum mapa copiado) e o OAM
// traz os mascotes ao lado do menu (medidos na captura `title.oam`). As casas dos itens e de "PUSH START
// BUTTON!" (nosso texto) saem zeradas do BG1 da ROM, para não duplicar texto por baixo do nosso — igual ao que a
// T19 já faz para os menus (`keepPalette`/áreas dinâmicas).
import type { RomAssets, ObjEntry, PpuFrame } from '../../app/rom-api';
import { obj, sceneMaps, sceneGfx, sceneFrame, handCursor, type SceneMaps, type MenuRect } from './scene';

/** Áreas com texto nosso (não o da ROM), ignoradas na comparação de fidelidade (spec §6.2) e zeradas no BG1
 *  vindo da ROM: itens do menu (x 64–200, y 144–196, ao redor de `TITLE.rowsY`) e "PUSH START BUTTON!"
 *  (medido em `title.png`, a faixa amarela por volta de y 130–150). */
export const TITLE_TEXT_RECTS: readonly MenuRect[] = [
  { x0: 64, y0: 144, x1: 200, y1: 196 },
  { x0: 16, y0: 126, x1: 224, y1: 152 },
];

/** `descriptorMap` só decodifica o conteúdo de verdade na metade direita (colunas 16–31) das linhas 0–9 e 13
 *  (logo e "PUSH START BUTTON!"/copyright); a metade esquerda (colunas 0–15, a visível) sai em branco (tile 0)
 *  nessas linhas — conferido contra `title.vram`: nas linhas 0–9 e 13 as duas metades são *idênticas* na
 *  captura real (nas linhas 10–12, dos itens do menu, elas diferem, mas ficam cobertas por `TITLE_TEXT_RECTS`
 *  de qualquer forma). Copia a metade direita para a esquerda onde a esquerda está em branco. */
function mirrorBlankLeftHalf(m: Uint16Array): Uint16Array {
  const out = m.slice();
  for (let lin = 0; lin < 32; lin++) for (let col = 0; col < 16; col++) {
    const li = lin * 32 + col, ri = li + 16;
    if ((out[li] & 0x3ff) === 0 && (out[ri] & 0x3ff) !== 0) out[li] = out[ri];
  }
  return out;
}

/** Zera (tile 0) as casas 16×16 de `m` (32×32) que tocam algum retângulo de `rects` — mesma regra de toque do
 *  `mapMatch` de `tests/screens/captures.ts`, mas para apagar, não só ignorar. Devolve uma cópia. */
function blankRects(m: Uint16Array, rects: readonly MenuRect[]): Uint16Array {
  const out = m.slice();
  for (let lin = 0; lin < 32; lin++) for (let col = 0; col < 32; col++) {
    const x = col * 16, y = lin * 16;
    if (rects.some(r => x + 15 >= r.x0 && x <= r.x1 && y + 15 >= r.y0 && y <= r.y1)) out[lin * 32 + col] = 0;
  }
  return out;
}

/** Sem `MAP_SOURCES.title` (T19 ainda não mesclada nesta worktree), fica sem BG — só o logo (OBJ) e a mão. */
const noBg = (): SceneMaps => ({});

/** OAM do logo, lido em `title.oam`: todas as linhas com prioridade 2 (a mão é a única com prioridade 3 —
 *  tile/paleta de `MENU_GEO.titleHand` — e fica de fora, desenhada à parte por `handCursor`). Cada linha:
 *  `[x, y, tile, pal, big, h, v]`. Sem animação de montagem: o original desenha tudo de uma vez. */
const TITLE_LOGO: readonly [number, number, number, number, boolean, boolean, boolean][] = [
  [240, 200, 0x1c0, 7, false, false, false],
  [240, 184, 0x1a0, 7, false, false, false],
  [240, 168, 0x180, 7, false, false, false],
  [240, 152, 0x160, 7, false, false, false],
  [240, 136, 0x140, 7, false, false, false],
  [224, 216, 0x1cc, 3, false, false, false],
  [208, 216, 0x1ee, 3, false, false, false],
  [192, 216, 0x1ec, 3, false, false, false],
  [224, 200, 0x1ea, 3, false, false, false],
  [208, 200, 0x1e8, 3, false, false, false],
  [192, 200, 0x1e6, 3, false, false, false],
  [224, 184, 0x1e4, 3, false, false, false],
  [208, 184, 0x1e2, 3, false, false, false],
  [192, 184, 0x1e0, 3, false, false, false],
  [160, 200, 0x1ac, 3, false, false, false],
  [176, 216, 0x1ce, 3, false, false, false],
  [176, 200, 0x1ae, 3, false, false, false],
  [160, 184, 0x18c, 3, false, false, false],
  [176, 184, 0x18e, 3, false, false, false],
  [176, 152, 0x1a2, 6, false, false, false],
  [176, 168, 0x1c2, 6, false, false, false],
  [224, 168, 0x16e, 6, false, false, false],
  [208, 168, 0x16c, 6, false, false, false],
  [192, 168, 0x16a, 6, false, false, false],
  [224, 152, 0x14e, 6, false, false, false],
  [208, 152, 0x14c, 6, false, false, false],
  [192, 152, 0x14a, 6, false, false, false],
  [224, 136, 0x12e, 6, false, false, false],
  [208, 136, 0x12c, 6, false, false, false],
  [192, 136, 0x12a, 6, false, false, false],
  [224, 120, 0x10e, 6, false, false, false],
  [208, 120, 0x10c, 6, false, false, false],
  [-8, 168, 0x120, 7, false, false, false],
  [-8, 152, 0x100, 7, false, false, false],
  [8, 200, 0x182, 7, false, false, false],
  [8, 184, 0x162, 7, false, false, false],
  [8, 168, 0x142, 7, false, false, false],
  [8, 152, 0x122, 7, false, false, false],
  [8, 136, 0x102, 7, false, false, false],
  [72, 216, 0x1ca, 5, false, false, false],
  [56, 216, 0x1c8, 5, false, false, false],
  [40, 216, 0x1c6, 5, false, false, false],
  [24, 216, 0x1c4, 5, false, false, false],
  [72, 200, 0x1aa, 5, false, false, false],
  [56, 200, 0x1a8, 5, false, false, false],
  [40, 200, 0x1a6, 5, false, false, false],
  [24, 200, 0x1a4, 5, false, false, false],
  [40, 152, 0x146, 4, false, false, false],
  [72, 152, 0x10a, 4, false, false, false],
  [72, 184, 0x18a, 5, false, false, false],
  [56, 184, 0x188, 5, false, false, false],
  [40, 184, 0x186, 5, false, false, false],
  [24, 184, 0x184, 5, false, false, false],
  [56, 168, 0x168, 5, false, false, false],
  [40, 168, 0x166, 5, false, false, false],
  [24, 168, 0x164, 5, false, false, false],
  [56, 152, 0x148, 4, false, false, false],
  [24, 152, 0x144, 4, false, false, false],
  [56, 136, 0x128, 4, false, false, false],
  [40, 136, 0x126, 4, false, false, false],
  [24, 136, 0x124, 4, false, false, false],
  [56, 120, 0x108, 4, false, false, false],
  [40, 120, 0x106, 4, false, false, false],
  [24, 120, 0x104, 4, false, false, false],
  [216, 118, 0x04e, 1, false, false, false],
  [216, 102, 0x04c, 1, false, false, false],
  [184, 102, 0x00c, 1, true, false, false],
  [168, 120, 0x04a, 1, false, false, false],
  [152, 120, 0x048, 1, false, false, false],
  [152, 88, 0x008, 1, true, false, false],
  [72, 88, 0x004, 1, true, false, false],
  [56, 120, 0x042, 1, false, false, false],
  [40, 120, 0x040, 1, false, false, false],
  [40, 88, 0x000, 1, true, false, false],
  [88, 120, 0x046, 1, false, false, false],
  [72, 120, 0x044, 1, false, false, false],
  [136, 128, 0x080, 1, false, false, false],
  [120, 128, 0x06e, 1, false, false, false],
  [136, 112, 0x082, 1, false, false, false],
  [120, 112, 0x06c, 1, false, false, false],
  [104, 112, 0x06a, 1, false, false, false],
  [136, 96, 0x068, 1, false, false, false],
  [120, 96, 0x066, 1, false, false, false],
  [104, 96, 0x064, 1, false, false, false],
  [128, 80, 0x062, 1, false, false, false],
  [112, 80, 0x060, 1, false, false, false],
];

export interface TitleScene { maps: SceneMaps; scroll: { bg1: [number, number]; bg2: [number, number] }; logo: ObjEntry[] }

/** Monta a cena do título: BG1 por `sceneMaps` (usa `MAP_SOURCES.title`, T19 — sem isso, fica sem BG, `noBg`),
 *  espelhado (`mirrorBlankLeftHalf`) e com as casas do nosso texto zeradas, e o logo (OBJ) medido acima. */
export function buildTitleScene(a: RomAssets): TitleScene {
  const maps = sceneMaps(a, 'title', noBg);
  return {
    maps: maps.bg1 ? { ...maps, bg1: blankRects(mirrorBlankLeftHalf(maps.bg1), TITLE_TEXT_RECTS) } : maps,
    scroll: { bg1: [0, 0], bg2: [0, 0] },
    logo: TITLE_LOGO.map(([x, y, tile, pal, big, h, v]) => obj(x, y, tile, pal, { big, h, v, prio: 2 })),
  };
}

const sceneCache = new WeakMap<RomAssets, TitleScene>();
/** `buildTitleScene` memorizado por ROM (M5: o título redecodificava os dois mapas e copiava três vezes por quadro). */
export function titleScene(a: RomAssets): TitleScene {
  let sc = sceneCache.get(a);
  if (!sc) { sc = buildTitleScene(a); sceneCache.set(a, sc); }
  return sc;
}

/** Quadro da tela-título com a mão em (x, y). A mão entra **antes** do logo no OAM (I1): no SNES o índice menor fica
 *  na frente, e os OBJ do mascote (x 24–88, y 120–232) cobrem as três linhas do menu — com a mão no fim do OAM ela
 *  sumia atrás deles (a captura `title.png` mostra a mão por cima do mascote). */
export function titleFrame(a: RomAssets, handX: number, handY: number): PpuFrame {
  const sc = titleScene(a);
  return sceneFrame(sceneGfx(a, 'title'), sc.maps, { bg1: sc.scroll.bg1, bg2: sc.scroll.bg2, oam: [handCursor(handX, handY, true), ...sc.logo] });
}
