// Fases com a ambientação de outra arena (game/stages.ts, 14–18): o núcleo joga a fase 1 e o desenho usa os tiles, a
// paleta, as animações de cenário, a borda e a decoração do BG1 de uma arena do original, com o campo da fase 1.
//
// Como a arena é montada [ARN §2.2–2.5]: o BG2 é o mapa `bg2Base` (com soft em todas as casas "1") e o `floor` (piso
// com as sombras prontas sob pilar e parede); a grade do núcleo escolhe, casa a casa, entre os dois (render/rom/field.ts).
// Aqui o campo (colunas 2–14, linhas 1–11) é refeito pelo papel de cada casa na fase 1 — pilar, soft, piso, sombra sob
// pilar, sombra sob a parede de cima — trocando a palavra da fase 1 pela que a arena usa no mesmo papel. Fora do campo
// (paredes e borda) fica o mapa da própria arena. Assim nada da arena que tenha regra entra no campo: setas (7), pads
// (8), gangorras (9), bolas (3) e barrancos (4) são palavras ou objetos de lugares que a fase 1 não tem, e as camadas
// das arenas (render/rom/stages/*) só desenham na fase do núcleo, que é a 1. A decoração do BG1 com prioridade 1 dentro
// do campo (as moitas da arena 7) sai: ela cobre jogadores, bombas e itens, o que já é regra de jogo [ARN §7.4].
import type { ArenaAssets, RomAssets } from '../../rom/types';
import { coreStage } from '../../game/stages';
import { stageLook } from '../stage-skin';
import { mapIndex } from './scene';

/** Palavras da fase 1 por papel [ARN §2.5]. */
const ONE = { pillar: 0x1404, soft: 0x1c02, floor: 0x1c08, shadowPillar: 0x1c0a, shadowTop: 0x1c0c } as const;
type Role = keyof typeof ONE;
/** Bit de prioridade da palavra de BG (`vhopppcc cccccccc`). */
const PRIO = 0x2000;

/** Casas da arena de onde sai a palavra de cada papel (todas as arenas usadas têm o mesmo xadrez de pilares da fase 1):
 *  pilar em (3,2), soft em (2,1), piso em (4,2) (entre dois pilares), sombra sob pilar em (3,3) e sob a parede de cima
 *  em (4,1). Onde a arena não tem sombra, a casa já traz o piso. */
const SAMPLE: Readonly<Record<Role, readonly [number, number, 'bg2Base' | 'floor']>> = {
  pillar: [3, 2, 'bg2Base'], soft: [2, 1, 'bg2Base'], floor: [4, 2, 'floor'], shadowPillar: [3, 3, 'floor'], shadowTop: [4, 1, 'floor'],
};

/** Arena 4 ("Não Me Empurre"): a grama tem bordas desenhadas (`1DE4–1DEE`) onde encosta no barranco; o campo inteiro
 *  vira uma só área de grama com essa borda em volta, e os contornos de barranco do BG1 saem do meio do campo. */
const GRASS_EDGE = { tl: 0x1de4, t: 0x1de6, tr: 0x5de4, l: 0x1de8, r: 0x5de8, bl: 0x1dea, b: 0x1dee, br: 0x5dea } as const;
function grassEdge(col: number, lin: number): number | null {
  const top = lin === 1, bottom = lin === 11, left = col === 2, right = col === 14;
  if (top) return left ? GRASS_EDGE.tl : right ? GRASS_EDGE.tr : GRASS_EDGE.t;
  if (bottom) return left ? GRASS_EDGE.bl : right ? GRASS_EDGE.br : GRASS_EDGE.b;
  return left ? GRASS_EDGE.l : right ? GRASS_EDGE.r : null;
}
/** BG1 da arena 4 sem os barrancos do meio: só a moldura de barranco em volta do campo (as palavras da própria arena). */
function cleanBg1Arena4(bg1: Uint16Array): void {
  const BLANK = 0x1400, LINE_H = 0x14ac, LINE_L = 0x148c, LINE_R = 0x548c, CORNER_L = 0x14ce, CORNER_R = 0x54ce;
  for (let lin = 0; lin <= 12; lin++) for (let col = 1; col <= 15; col++) {
    const i = mapIndex(col, lin);
    if (lin === 0) bg1[i] = col === 1 ? CORNER_L : col === 15 ? CORNER_R : LINE_H;
    else if (lin === 12) bg1[i] = BLANK;
    else bg1[i] = col === 1 ? LINE_L : col === 15 ? LINE_R : BLANK;
  }
}

function roleOf(one: ArenaAssets, i: number): Role | null {
  if (one.bg2Base[i] === ONE.pillar) return 'pillar';
  switch (one.floor[i]) {
    case ONE.floor: return 'floor';
    case ONE.shadowPillar: return 'shadowPillar';
    case ONE.shadowTop: return 'shadowTop';
  }
  return null;
}

/** Monta a arena da fase `stage` (cópia da fase 1 com a ambientação da arena `stageLook(stage)`). */
export function buildLookArena(a: RomAssets, stage: number): ArenaAssets {
  const look = stageLook(stage), one = a.arena(coreStage(stage)), v = a.arena(look);
  const word = (r: Role): number => { const [col, lin, m] = SAMPLE[r]; return v[m][mapIndex(col, lin)]; };
  const w = { pillar: word('pillar'), soft: word('soft'), floor: word('floor'), shadowPillar: word('shadowPillar'), shadowTop: word('shadowTop') };
  const bg2Base = v.bg2Base.slice(), floor = v.floor.slice(), bg1 = v.bg1.slice();
  for (let lin = 1; lin <= 11; lin++) for (let col = 2; col <= 14; col++) {
    const i = mapIndex(col, lin), role = roleOf(one, i);
    if (role === null) throw new Error(`fase 1: casa (${col},${lin}) sem papel conhecido`);
    if (role === 'pillar') { bg2Base[i] = floor[i] = w.pillar; continue; }
    floor[i] = (look === 4 ? grassEdge(col, lin) : null) ?? w[role];
    bg2Base[i] = one.bg2Base[i] === ONE.soft ? w.soft : floor[i];
  }
  if (look === 4) cleanBg1Arena4(bg1);
  for (let lin = 1; lin <= 11; lin++) for (let col = 2; col <= 14; col++) {
    const i = mapIndex(col, lin);
    if (bg1[i] & PRIO) bg1[i] = 0;   // moitas (arena 7): esconderiam quem está embaixo
  }
  return {
    ...v, stage: one.stage, bg1, bg2Base, floor,
    logicBase: one.logicBase, removeN: one.removeN,
    objCommon: one.objCommon,   // a arena 3 põe as bolas sobre tiles comuns de OBJ: aqui ficam os da fase 1
  };
}

const cache = new WeakMap<RomAssets, Map<number, ArenaAssets>>();
/** Arena (memorizada) que a fase `stage` da interface desenha. */
export function lookArena(a: RomAssets, stage: number): ArenaAssets {
  if (stageLook(stage) === coreStage(stage)) return a.arena(coreStage(stage));
  let m = cache.get(a);
  if (!m) { m = new Map(); cache.set(a, m); }
  let ar = m.get(stage);
  if (!ar) { ar = buildLookArena(a, stage); m.set(stage, ar); }
  return ar;
}
