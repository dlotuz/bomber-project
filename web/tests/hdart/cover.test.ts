import { CODE, FLAME_PIECE, cellOf, itemCode, ITEM } from '../../src/core';
import { HD_CATEGORIES, hdCoverage, hdPlan, requiredKeys, type HdCategory } from '../../src/render/hdart/cover';
import { hdBattleSkip, hdBattleBegin, hdBattleActive, setHdPack, drawHdBattleLayer } from '../../src/render/hdart/mode';
import { fakeRound } from '../render-rom/fakes';
import { arenaAnims, recCtx, still, testPack } from './helpers';

const setOf = (...c: HdCategory[]) => new Set(c);

describe('requiredKeys / hdCoverage', () => {
  it('arena: as 6 peças da arena atual; faltando uma, não cobre', () => {
    const s = fakeRound({ stage: 3 });
    expect(requiredKeys(s).arena).toEqual(['stage/3/floor', 'stage/3/hard', 'stage/3/wall', 'stage/3/soft', 'stage/3/burning', 'stage/3/pressure']);
    expect(hdCoverage(s, testPack(arenaAnims(3))).has('arena')).toBe(true);
    expect(hdCoverage(s, testPack(arenaAnims(4))).has('arena')).toBe(false);
    const partial = arenaAnims(3);
    delete partial['stage/3/burning'];
    expect(hdCoverage(s, testPack(partial)).has('arena')).toBe(false);
  });

  it('itens, chamas e ovos: só os que estão em campo neste quadro', () => {
    const s = fakeRound();
    s.grid[cellOf(3, 1)] = itemCode(ITEM.FIRE);
    s.grid[cellOf(5, 1)] = CODE.FLAME; s.cellAux[cellOf(5, 1)] = FLAME_PIECE.TIP_LEFT;
    s.grid[cellOf(6, 1)] = CODE.FLAME; s.cellAux[cellOf(6, 1)] = FLAME_PIECE.ARM_UP;
    s.grid[cellOf(7, 1)] = 0x097c;   // ovo tipo C
    const req = requiredKeys(s);
    expect(req.items).toEqual(['item/03']);
    expect(req.flames.sort()).toEqual(['flame/left', 'flame/v']);
    expect(req.eggs).toEqual(['egg/c']);
    const cov = hdCoverage(s, testPack({ 'item/03': still(), 'flame/left': still() }));
    expect(cov.has('items')).toBe(true);
    expect(cov.has('flames')).toBe(false);   // falta flame/v
    expect(cov.has('eggs')).toBe(false);
  });

  it('jogadores: personagem × ação atual × direção; montado precisa de montaria e cavaleiro; traje como no original', () => {
    const s = fakeRound();
    s.players.forEach((p, i) => { p.present = i < 2; p.char = i; });
    s.players[0].act = 'walk'; s.players[0].face = 6;
    s.players[1].state = 'dying'; s.players[1].act = 'dying';
    expect(requiredKeys(s).players).toEqual(['char/0/walk/left', 'char/1/dying']);
    expect(hdCoverage(s, testPack({ 'char/0/walk/left': still(), 'char/1/dying': still() })).has('players')).toBe(true);
    s.players[0].act = 'idle';
    expect(hdCoverage(s, testPack({ 'char/0/walk/left': still(), 'char/1/dying': still() })).has('players')).toBe(false);
    s.players[0].mount = { type: 0xa, slot: 1, phase: 'riding', t0: 0, reserves: [], trail: [], cooldown: 0, remount: false, remountFx: null };
    expect(requiredKeys(s).players).toEqual(['rider/0/left', 'mount/a/riding/left', 'char/1/dying']);
    s.players[0].mount = null;
    s.players[0].costume = 2;
    s.players[0].moveDir = 6;
    expect(requiredKeys(s).players).toEqual(['costume/2/walk/left', 'char/1/dying']);
    s.players[0].act = 'punch';   // sem desenho de traje no original: aparece normal
    expect(requiredKeys(s).players).toEqual(['char/0/punch/left', 'char/1/dying']);
  });

  it('HUD: barra, relógio, algarismos do tempo atual, rosto e contador de coroas de cada presente', () => {
    const s = fakeRound();
    s.players.forEach((p, i) => { p.present = i < 2; p.char = i + 3; });
    s.clock.sec = 125;
    expect(requiredKeys(s, [2, 0]).hud).toEqual(['hud/bar', 'hud/clock', 'hud/digit/2', 'hud/colon', 'hud/digit/0', 'hud/digit/5',
      'hud/head/3', 'hud/crown/2', 'hud/head/4', 'hud/crown/0']);
    s.clock.sec = 9999;
    expect(requiredKeys(s, [0, 0]).hud.slice(0, 3)).toEqual(['hud/bar', 'hud/clock', 'hud/infinity']);
  });

  it('categoria sem nada em campo conta como coberta (nada a desenhar)', () => {
    const s = fakeRound();
    const cov = hdCoverage(s, testPack({}));
    expect(cov.has('items') && cov.has('flames') && cov.has('bombs') && cov.has('eggs')).toBe(true);
    expect(cov.has('arena')).toBe(false);
  });
});

describe('hdPlan (o que pular e em que passada)', () => {
  it('tudo coberto: tudo por baixo da base', () => {
    const p = hdPlan(new Set(HD_CATEGORIES));
    expect(p.under).toEqual(HD_CATEGORIES);
    expect(p.over).toEqual([]);
    expect([...p.skip]).toEqual(HD_CATEGORIES);
  });
  it('nada coberto: lista vazia (a base desenha tudo)', () => {
    const p = hdPlan(new Set());
    expect(p.skip.size).toBe(0);
  });
  it('prefixo por baixo, sufixo por cima, o meio fica na base', () => {
    const p = hdPlan(setOf('arena', 'items', 'bombs', 'players', 'hud'));
    expect(p.under).toEqual(['arena', 'items']);
    expect(p.over).toEqual(['players', 'hud']);
    expect(p.skip.has('bombs')).toBe(false);   // flames (base) abaixo e eggs (base) acima: não dá para ordenar
  });
  it('só o HUD: por cima', () => {
    expect(hdPlan(setOf('hud'))).toMatchObject({ under: [], over: ['hud'] });
  });
});

describe('modo HD: estado do quadro', () => {
  afterEach(() => { setHdPack(null); hdBattleBegin(); });
  it('sem pacote: nada a pular e nada guardado', () => {
    const s = fakeRound();
    hdBattleBegin();
    expect(hdBattleSkip(s, [0, 0, 0, 0, 0]).size).toBe(0);
    expect(hdBattleActive()).toBe(false);
    expect(drawHdBattleLayer(recCtx(), 4, 4, 0, 0, 'under')).toBe(false);
  });
  it('com pacote: guarda a rodada e a passada desenha as categorias do plano', () => {
    const s = fakeRound({ stage: 1 });
    s.players.forEach(p => { p.present = false; });
    setHdPack(testPack(arenaAnims(1)));
    hdBattleBegin();
    const skip = hdBattleSkip(s, [0, 0, 0, 0, 0]);
    expect([...skip]).toEqual(['arena', 'items', 'flames', 'bombs', 'eggs', 'players']);   // HUD: falta hud/bar
    const out = recCtx();
    expect(drawHdBattleLayer(out, 4, 4, 0, 0, 'under')).toBe(true);
    expect(out.calls.length).toBeGreaterThan(17 * 13 - 1);
    expect(drawHdBattleLayer(recCtx(), 4, 4, 0, 0, 'over')).toBe(false);
    hdBattleBegin();
    expect(drawHdBattleLayer(recCtx(), 4, 4, 0, 0, 'under')).toBe(false);
  });
});
