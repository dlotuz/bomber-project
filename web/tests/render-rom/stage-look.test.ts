import { CODE, GRID_H, GRID_W } from '../../src/core';
import { STAGE_MAX, VISIBLE_STAGES, coreStage } from '../../src/game/stages';
import { lookArena } from '../../src/render/rom/stage-look';
import { buildBattleFrame } from '../../src/render/rom/battle';
import { battleStageFor, setBattleStage, stageLook } from '../../src/render/stage-skin';
import { mapIndex } from '../../src/render/rom/scene';
import { ASSETS } from './rom-fixture';
import { stageIcon, stagePalette } from '../../src/render/screens-rom/stagesel';
import { newRound, toPlay } from './core-fixture';

/** Fases de ambientação nova → arena do original cujo visual elas usam. */
const LOOKS: [number, number][] = [[14, 3], [15, 4], [16, 7], [17, 9], [18, 10]];
const words = (m: Uint16Array, pred: (col: number, lin: number) => boolean): Set<number> => {
  const out = new Set<number>();
  for (let lin = 1; lin <= 11; lin++) for (let col = 2; col <= 14; col++) if (pred(col, lin)) out.add(m[mapIndex(col, lin)]);
  return out;
};

describe('fase → visual (game/stages.ts + render/stage-skin.ts)', () => {
  afterEach(() => setBattleStage(0));
  it.each(LOOKS)('fase %i: o núcleo joga a fase 1, visível na seleção, com o visual da arena %i', (st, look) => {
    expect([coreStage(st), stageLook(st), VISIBLE_STAGES.includes(st)]).toEqual([1, look, true]);
    expect(STAGE_MAX).toBeGreaterThanOrEqual(st);
  });
  it('originais e cópias de paleta desenham a própria arena base', () => {
    for (let st = 1; st <= 10; st++) expect(stageLook(st)).toBe(st);
    for (const st of [11, 12, 13]) expect(stageLook(st)).toBe(1);
  });
  it('battleStageFor: a fase da interface só vale para a rodada da fase base dela', () => {
    setBattleStage(17);
    expect([battleStageFor(1), battleStageFor(9)]).toEqual([17, 9]);
    setBattleStage(0);
    expect(battleStageFor(1)).toBe(1);
  });
});

describe.skipIf(!ASSETS)('ambientação de outra arena com o layout da fase 1 (render/rom/stage-look.ts)', () => {
  const a = ASSETS!;
  afterEach(() => setBattleStage(0));

  it.each(LOOKS)('fase %i: tiles, paleta, animações e decoração da arena %i', (st, look) => {
    const ar = lookArena(a, st), v = a.arena(look);
    expect(ar.bgTiles).toBe(v.bgTiles);
    expect(ar.bgCgram).toBe(v.bgCgram);
    expect(ar.tileAnim).toBe(v.tileAnim);
    expect(ar.palAnim).toBe(v.palAnim);
    expect(ar.colorMath).toBe(v.colorMath);
    // borda e paredes (fora do campo) são as da arena
    for (const [col, lin] of [[0, 0], [1, 5], [15, 5], [16, 12], [8, 0], [8, 12]]) {
      expect([col, lin, ar.bg2Base[mapIndex(col, lin)]]).toEqual([col, lin, v.bg2Base[mapIndex(col, lin)]]);
    }
  });

  it.each(LOOKS)('fase %i: campo com os pilares e os blocos da fase 1, sem elemento especial da arena %i', (st, look) => {
    const ar = lookArena(a, st), one = a.arena(1), v = a.arena(look);
    expect(Array.from(ar.logicBase)).toEqual(Array.from(one.logicBase));
    const pillar = v.bg2Base[mapIndex(3, 2)], soft = v.bg2Base[mapIndex(2, 1)];
    const hard = (col: number, lin: number) => one.logicBase[mapIndex(col, lin)] === CODE.HARD;
    expect(words(ar.bg2Base, hard)).toEqual(new Set([pillar]));
    expect(words(ar.bg2Base, (c, l) => !hard(c, l))).toEqual(new Set([soft]));
    // piso: só palavras que a própria arena usa como piso, nenhuma de mecânica (seta, pad, gangorra, piso especial)
    const floors = words(ar.floor, (c, l) => !hard(c, l));
    for (const w of floors) expect(Array.from(v.floor)).toContain(w);
    const MECH = [0x1cc0, 0x1cc2, 0x1cc4, 0x1cc6, 0x1c6e, 0x08e0, 0x08e2, 0x08e4, 0x08ec];   // setas, pad, gangorras
    for (const w of MECH) expect(floors.has(w)).toBe(false);
    expect(floors.size).toBeGreaterThan(0);
  });

  it('fase 15 (arena 4): sem os contornos de barranco da arena 4 no meio do campo', () => {
    const ar = lookArena(a, 15), blank = ar.bg1[mapIndex(4, 4)];
    for (let lin = 1; lin <= 11; lin++) for (let col = 2; col <= 14; col++) expect(ar.bg1[mapIndex(col, lin)]).toBe(blank);
  });

  it('fase 16 (arena 7): sem as moitas (BG1 com prioridade, que esconderiam os jogadores)', () => {
    const ar = lookArena(a, 16), v = a.arena(7);
    const prio = (m: Uint16Array) => words(m, () => true);
    expect([...prio(v.bg1)].some(w => w & 0x2000)).toBe(true);
    expect([...prio(ar.bg1)].some(w => w & 0x2000)).toBe(false);
  });
  it('fase 18 (arena 10): as luzes do BG1 ficam (só visual, sem prioridade)', () => {
    const ar = lookArena(a, 18), v = a.arena(10);
    expect(Array.from(ar.bg1)).toEqual(Array.from(v.bg1));
  });

  it.each(LOOKS)('seleção de fase: a fase %i mostra a prévia e as cores da arena %i', (st, look) => {
    expect(Array.from(stagePalette(a, st))).toEqual(Array.from(stagePalette(a, look)));
    const mine = stageIcon(a, st), orig = stageIcon(a, look);
    if (look !== 9) expect(Array.from(mine)).toEqual(Array.from(orig));
  });
  it('prévia da fase 17: a gangorra do meio da arena 9 vira piso (com a sombra dos prédios)', () => {
    const mine = stageIcon(a, 17), orig = stageIcon(a, 9);
    const SAW = [0x0f26, 0x0f28, 0x0f2a];
    expect(SAW.every(w => orig.includes(w))).toBe(true);
    expect(SAW.some(w => mine.includes(w))).toBe(false);
    const at = (m: Uint16Array, col: number, row: number) => m[row * 7 + col];
    // linha 3, colunas 2–4: sombra sob prédio, piso, sombra sob prédio (como a linha 5, embaixo da 2ª fileira)
    expect([2, 3, 4].map(c => at(mine, c, 3))).toEqual([at(orig, 2, 5), at(orig, 3, 5), at(orig, 4, 5)]);
    expect(mine.filter((w, i) => w !== orig[i]).length).toBe(3);
  });

  it('as outras fases desenham a própria arena base, sem troca', () => {
    for (const st of [1, 2, 9, 10]) expect(lookArena(a, st)).toBe(a.arena(st));
    for (const st of [11, 12, 13]) expect(lookArena(a, st)).toBe(a.arena(1));
    expect(lookArena(a, 17)).toBe(lookArena(a, 17));   // memorizada
  });

  it('a partida da fase 17 desenha a arena 9 com a grade da fase 1', () => {
    const s = newRound(1);
    toPlay(s);
    setBattleStage(17);
    const f = buildBattleFrame(s, { crowns: [0, 0, 0, 0, 0] }, a, 0, { sprites: false });
    const nine = a.arena(9), ar = lookArena(a, 17);
    expect(f.bg2!.tiles.count).toBe(nine.bgTiles.count);
    for (let lin = 0; lin < GRID_H; lin++) for (let col = 1; col < GRID_W - 1; col++) {
      const i = mapIndex(col, lin), code = s.grid[lin * GRID_W + col];
      if (code === CODE.HARD) expect(f.bg2!.map[i]).toBe(ar.bg2Base[i]);
      if (code === CODE.FLOOR) expect(f.bg2!.map[i]).toBe(ar.floor[i]);
    }
    expect(f.cgram[16 * 7 + 1]).toBe(nine.bgCgram[16 * 7 + 1]);   // paleta 7 (piso e blocos), sem animação
  });
});
