// Reconstrução da cena `stagesel` ["Escolha a fase!", $C1:A901/$C1:A262] a partir de capturas reais
// (SB4_CAPTURES) e da própria ROM.
//
// Confirmado por captura + desmontagem (ver `web/tests/screens/stage.test.ts`, describe.skipIf, e o
// relatório de follow-up da T11):
// - BG2 (quebra-cabeça de fundo) é byte a byte o mesmo padrão 6×6 dos outros menus (`MENU_GEO.bgPattern`,
//   T5) — nenhuma cena nova precisou ser medida para o fundo.
// - `$C1:A901` é uma tabela de 8 ponteiros de 3 bytes para os blocos ZTE de gráfico (tiles) das prévias,
//   carregados uma única vez ao entrar na tela (rotina em `$C1:A243`, 8× `JSL $C409A5`); bate byte a byte
//   com os 8 blocos já cadastrados em `web/src/rom/catalog.ts` (cena `stagesel`) — ou seja, os tiles das 10
//   prévias já ficam todos residentes de uma vez (`a.scene('stagesel').bgTiles`), sem recarga por fase.
// - A rotina em `$C1:A209` copia um bloco de 7×7 casas (112 px) de `[$58]` (fonte, avança 1 palavra por
//   casa) para `[$60],Y` (destino, uma faixa de 32 colunas — o mesmo passo de linha de um mapa de BG
//   32×32), aplicando `AND #$E3FF` (limpa os bits de paleta 10–12) e `ORA` com a paleta desejada — a pista
//   do Task 19. O BG1 real guarda 3+ prévias lado a lado em blocos de 128 px (colunas 0/8/16/24 do mapa,
//   1 coluna de vão): qual fase mora em qual coluna é um buffer giratório de 4 posições, carregado sob
//   demanda pela rolagem (não uma função pura de (fase, hofs) sem também reconstruir esse histórico).
// - `$7F:202B` é o índice da fase atual (0–9) e `$7F:202D` = 10 (contagem de fases) — confirmado lendo a
//   WRAM dos savestates `analise/estados/st_stage00..09.bin`.
// - Correção I2 da revisão final: as linhas 0–3 da CGRAM são um buffer giratório de paletas. Ao entrar na tela
//   (`$C1:A2D6…$C1:A3B4`), a fase anterior/atual/seguinte vai para o slot 0/1/2: o mapa 7×7 vem da tabela de
//   ponteiros longos `$C1:A8D1` (via `$C4:44FD`) e é gravado por `$C1:A209` com a paleta = slot; a paleta de 16
//   cores vem da tabela `$C1:A92B` (via `$C4:44E4`) e `$C4:1986` a copia para `$7E:8E00 + 32·slot` (o espelho da
//   CGRAM que `$C4:19DE` manda para o PPU todo quadro). Ao começar cada rolagem (`$C1:A605…$C1:A6BF`), a fase
//   atual ± 2 entra no 4º slot (paleta 3) do mesmo jeito. Reproduzimos isso com um arranjo fixo (anterior/atual/
//   seguinte nas colunas 0/8/16 e paletas 0/1/2; a que entra na rolagem na coluna 24, paleta 3): como mapa e
//   paleta de cada slot andam juntos, as cores ficam iguais às do jogo sem reconstruir o histórico do buffer.
//   Conferido contra as 10 capturas `stagesel*` (mapas iguais fora dos bits de paleta; cores por pixel).
import type { RomAssets } from '../../app/rom-api';
import { newMap, put, pattern, sceneGfx, MENU_GEO, type SceneGfx, type SceneMaps } from './scene';
import { coreStage } from '../../game/stages';
import { skinColors } from '../stage-skin';

/** Coluna/linha do slot central (128 px de passo, igual a `STAGE.scrollPx * STAGE.scrollFrames`). */
export const STAGE_ICON_COL = 8, STAGE_ICON_ROW = 2;
/** Registrador de HOFS do BG1 que deixa o slot central em x = 72; `stageScreen.scroll()` soma-se a isto. */
export const STAGE_ICON_HOFS_BASE = 56;

/** Tabelas de ponteiros longos (3 bytes) por fase 0–9: mapa 7×7 da prévia (`vhopppcc cccccccc`) e paleta de 16 cores. */
export const STAGE_PREVIEW_MAPS = 0xc1a8d1, STAGE_PREVIEW_PALS = 0xc1a92b;
/** Contagem de fases (`$7F:202D`). */
const STAGES = 10;
const ICON = 7;

const wrapStage10 = (n: number): number => ((n - 1 + STAGES * 10) % STAGES) + 1;
/** Fase `d` passos depois de `stage`: por padrão as 10 do original em sequência; a tela passa a lista visível. */
export type StageStep = (stage: number, d: number) => number;
const step10: StageStep = (stage, d) => wrapStage10(stage + d);
/** Fases da interface além das 10 (cópias com outra paleta, game/stages.ts) ficam como estão; as outras dão a volta. */
const norm = (n: number): number => (coreStage(n) !== n ? n : wrapStage10(n));
/** Mapa 7×7 da prévia de `stage` (com volta 1↔10), como está na ROM (os bits de paleta são trocados pelo slot). */
export function stageIcon(a: RomAssets, stage: number): Uint16Array {
  const p = a.rom.u24(STAGE_PREVIEW_MAPS + 3 * (wrapStage10(coreStage(norm(stage))) - 1));
  const out = new Uint16Array(ICON * ICON);
  for (let i = 0; i < out.length; i++) out[i] = a.rom.u16(p + 2 * i);
  return out;
}
/** As 16 cores da prévia de `stage` (com volta 1↔10). */
export function stagePalette(a: RomAssets, stage: number): Uint16Array {
  const st = norm(stage);
  const p = a.rom.u24(STAGE_PREVIEW_PALS + 3 * (wrapStage10(coreStage(st)) - 1));
  const out = new Uint16Array(16);
  for (let i = 0; i < 16; i++) out[i] = a.rom.u16(p + 2 * i);
  return skinColors(out, st, a.arena(coreStage(st)).bgCgram);
}

/** `$C1:A209`: copia o bloco 7×7 limpando os bits 10–12 (`AND #$E3FF`) e pondo a paleta do slot (`ORA`). */
function placeIcon(m: Uint16Array, col0: number, row0: number, icon: Uint16Array, pal: number): void {
  for (let gy = 0; gy < ICON; gy++) for (let gx = 0; gx < ICON; gx++)
    put(m, col0 + gx, row0 + gy, (icon[gy * ICON + gx] & 0xe3ff) | (pal << 10));
}
function puzzleBg(): Uint16Array {
  const bg2 = newMap();
  pattern(bg2, 0, 0, 32, 32, MENU_GEO.bgPattern);
  return bg2;
}

/** Slots do BG1: [coluna, paleta] do anterior, atual, seguinte e do que entra na rolagem. */
const SLOT = { prev: [STAGE_ICON_COL - 8, 0], cur: [STAGE_ICON_COL, 1], next: [STAGE_ICON_COL + 8, 2], extra: [STAGE_ICON_COL + 16, 3] } as const;

/** Reconstrói os mapas de `stagesel` com `stage` sozinho no slot central (paleta 1). */
export function buildStageScene(a: RomAssets, stage: number): SceneMaps {
  const bg1 = newMap();
  placeIcon(bg1, SLOT.cur[0], STAGE_ICON_ROW, stageIcon(a, stage), SLOT.cur[1]);
  return { bg1, bg2: puzzleBg() };
}

/** Faixa ao vivo: anterior/atual/seguinte lado a lado como no jogo, prontos para o BG1 rolar por baixo
 *  (`hofs = STAGE_ICON_HOFS_BASE - stageScreen.scroll()`). Com `dir` ≠ 0 (rolando), a fase atual + 2·dir entra no
 *  4º slot (coluna 24, que o mapa de 512 px mostra à direita ao rolar para → e à esquerda ao rolar para ←). */
export function buildStagePreviewStrip(a: RomAssets, stage: number, dir: -1 | 0 | 1 = 0, step: StageStep = step10): SceneMaps {
  const bg1 = newMap();
  placeIcon(bg1, SLOT.prev[0], STAGE_ICON_ROW, stageIcon(a, step(stage, -1)), SLOT.prev[1]);
  placeIcon(bg1, SLOT.cur[0], STAGE_ICON_ROW, stageIcon(a, stage), SLOT.cur[1]);
  placeIcon(bg1, SLOT.next[0], STAGE_ICON_ROW, stageIcon(a, step(stage, 1)), SLOT.next[1]);
  if (dir !== 0) placeIcon(bg1, SLOT.extra[0], STAGE_ICON_ROW, stageIcon(a, step(stage, 2 * dir)), SLOT.extra[1]);
  return { bg1, bg2: puzzleBg() };
}

/** Cópia de `base` com as paletas das prévias nas linhas 0–3 (`$C4:1986`: 16 cores em `$7E:8E00 + 32·slot`). */
export function stagePreviewCgram(a: RomAssets, base: Uint16Array, stage: number, dir: -1 | 0 | 1 = 0, step: StageStep = step10): Uint16Array {
  const cg = base.slice();
  cg.set(stagePalette(a, step(stage, -1)), SLOT.prev[1] * 16);
  cg.set(stagePalette(a, stage), SLOT.cur[1] * 16);
  cg.set(stagePalette(a, step(stage, 1)), SLOT.next[1] * 16);
  if (dir !== 0) cg.set(stagePalette(a, step(stage, 2 * dir)), SLOT.extra[1] * 16);
  return cg;
}

export interface StagePreview { g: SceneGfx; maps: SceneMaps }
const previewCache = new WeakMap<RomAssets, Map<string, StagePreview>>();
/** Gráficos (CGRAM com as paletas dos slots) e mapas da faixa, memorizados por (ROM, fase, direção, vizinhas). */
export function stagePreview(a: RomAssets, stage: number, dir: -1 | 0 | 1 = 0, step: StageStep = step10): StagePreview {
  let m = previewCache.get(a); if (!m) { m = new Map(); previewCache.set(a, m); }
  stage = norm(stage);
  const key = `${stage}:${dir}:${[-2, -1, 1, 2].map(d => norm(step(stage, d))).join(',')}`;
  let p = m.get(key);
  if (!p) {
    const g = sceneGfx(a, 'stagesel');
    p = { g: { ...g, cgram: stagePreviewCgram(a, g.cgram, stage, dir, step) }, maps: buildStagePreviewStrip(a, stage, dir, step) };
    m.set(key, p);
  }
  return p;
}
