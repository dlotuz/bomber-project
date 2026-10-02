// A "lista do que pular" no desenho base: vazia = saída idêntica; categoria coberta = a base não desenha nada dela.
import { CODE, cellOf, createRound, defaultRules, itemCode, ITEM, makeRng, type Bomb } from '../../src/core';
import { drawRound } from '../../src/render/draw-game';
import { blankWord, buildBattleFrame, drawRomBattle } from '../../src/render/rom/battle';
import { createView } from '../../src/render/view';
import type { SpriteBank } from '../../src/render/sprite-bank';
import type { HdCategory } from '../../src/render/hdart/cover';
import { setHdPack, hdBattleBegin } from '../../src/render/hdart/mode';
import { fakeAssets, fakeRound, fakeTiles } from '../render-rom/fakes';
import { arenaAnims, testPack } from './helpers';

const VIS = { crowns: [0, 0, 0, 0, 0] };
const skip = (...c: HdCategory[]) => new Set<HdCategory>(c);

function fakeBank(): SpriteBank {
  const im = (k: string) => ({ width: 16, height: 16, k });
  const tiles = { floor: im('floor'), floorAlt: im('floorAlt'), hard: im('hard'), wall: im('wall'), soft: im('soft'), burning: [im('burn0'), im('burn1')], bg: '#000' };
  return {
    bomber: () => im('bomber'), head: () => im('head'), bomb: () => im('bomb'), item: () => im('item'), flame: () => im('flame'),
    clock: () => im('clock'), text: (s: string) => ({ width: 6 * s.length, height: 8, k: `text:${s}` }),
    plainText: (s: string) => ({ width: 6 * s.length, height: 8, k: `plain:${s}` }), tiles: () => tiles,
  } as unknown as SpriteBank;
}
/** Contexto que grava tudo o que a base faz, em ordem. */
function logCtx() {
  const log: string[] = [];
  const ctx = {
    log, fillStyle: '', globalAlpha: 1,
    fillRect: (x: number, y: number, w: number, h: number) => log.push(`fill ${x},${y},${w},${h}`),
    clearRect: (x: number, y: number, w: number, h: number) => log.push(`clear ${x},${y},${w},${h}`),
    drawImage: (img: { k: string }, x: number, y: number) => log.push(`img ${img.k} ${x},${y}`),
  };
  return ctx as unknown as CanvasRenderingContext2D & { log: string[] };
}
function scene() {
  const s = createRound(1, defaultRules(), makeRng());
  s.grid[cellOf(3, 1)] = itemCode(ITEM.FIRE);
  s.grid[cellOf(5, 1)] = CODE.FLAME;
  s.bombs.push({ id: 1, owner: 0, bad: false, cell: cellOf(7, 1), x: 112 * 256, y: 48 * 256, fuse: 99, fire: 2, type: 0,
    state: 'idle', dir: 0, step: 0, kickedBy: -1, turn: -1, chainAt: 0, born: 0 } as Bomb);
  return s;
}
const draw = (s = scene(), opts: { skip?: Set<HdCategory> } = {}) => {
  const ctx = logCtx();
  drawRound(ctx, s, createView(), fakeBank(), [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0], opts);
  return ctx.log;
};

describe('drawRound (arte simples) com a lista do que pular', () => {
  afterEach(() => { setHdPack(null); hdBattleBegin(); });

  it('lista vazia = sem pacote = o desenho de sempre', () => {
    expect(draw(scene(), { skip: new Set() })).toEqual(draw());
  });

  it('pacote que não cobre nada completo: a base desenha tudo igual', () => {
    const base = draw();
    setHdPack(testPack({ 'stage/1/floor': arenaAnims(1)['stage/1/floor'] }));   // arena incompleta
    expect(draw()).toEqual(base);
  });

  it('arena coberta: limpa em vez de pintar o fundo e não desenha peças; itens, chamas e bombas continuam', () => {
    const log = draw(scene(), { skip: skip('arena') });
    expect(log[0]).toBe('clear 0,0,256,224');
    expect(log.some(l => /img (floor|floorAlt|hard|wall|soft) /.test(l))).toBe(false);
    expect(log.filter(l => l.startsWith('img item')).length).toBe(1);
    expect(log.filter(l => l.startsWith('img flame')).length).toBe(1);
    expect(log.filter(l => l.startsWith('img bomb ')).length).toBe(1);
  });

  it('cada categoria some sozinha da base', () => {
    const all = draw();
    const n = (log: string[], re: RegExp) => log.filter(l => re.test(l)).length;
    expect(n(draw(scene(), { skip: skip('items') }), /img item/)).toBe(0);
    expect(n(draw(scene(), { skip: skip('flames') }), /img flame/)).toBe(0);
    expect(n(draw(scene(), { skip: skip('bombs') }), /img bomb /)).toBe(0);
    const noPlayers = draw(scene(), { skip: skip('players') });
    expect(n(noPlayers, /img bomber/)).toBe(0);
    expect(n(noPlayers, /img text:\dP/)).toBe(0);
    expect(n(all, /img bomber/)).toBe(5);
    const noHud = draw(scene(), { skip: skip('hud') });
    expect(n(noHud, /img (clock|head)/)).toBe(0);
    expect(noHud[noHud.length - 1]).toBe('clear 0,0,256,24');
  });

  it('com pacote completo para a arena, o quadro com atores pergunta ao modo HD e pula a arena', () => {
    setHdPack(testPack(arenaAnims(1)));
    expect(draw()[0]).toBe('clear 0,0,256,224');
  });
});

describe('buildBattleFrame (ROM) com a lista do que pular', () => {
  it('lista vazia: quadro idêntico ao de sempre', () => {
    const s = fakeRound();
    s.grid[cellOf(3, 1)] = itemCode(ITEM.FIRE);
    const a = buildBattleFrame(s, VIS, fakeAssets(), 0, { layers: [] });
    const b = buildBattleFrame(s, VIS, fakeAssets(), 0, { layers: [], skip: new Set() });
    expect(b).toEqual(a);
    expect('backdrop' in b).toBe(false);
  });

  it('item pulado com a arena da ROM: a casa mostra o piso', () => {
    const s = fakeRound();
    const c = cellOf(3, 1);
    s.grid[c] = itemCode(ITEM.FIRE);
    const f = buildBattleFrame(s, VIS, fakeAssets(), 0, { layers: [], skip: skip('items') });
    expect(f.bg2!.map[1 * 32 + 3]).toBe(0x1000 | (1 * 32 + 3));   // ar.floor da casa
    expect('backdrop' in f).toBe(false);
  });

  it('arena pulada: BG2 e a decoração do BG1 transparentes, item da base mantido, sem color math, fundo livre', () => {
    const s = fakeRound();
    s.grid[cellOf(3, 1)] = itemCode(ITEM.FIRE);
    const a = fakeAssets({ arena: { colorMath: 'half', bg1: new Uint16Array(1024).fill(0x0123), bgTiles: fakeTiles(1024, t => (t === 0x40 || t === 0x41 || t === 0x50 || t === 0x51 ? 0 : 1)) } });
    const full = buildBattleFrame(s, VIS, a, 0, { layers: [] });
    const f = buildBattleFrame(s, VIS, a, 0, { layers: [], skip: skip('arena') });
    const blank = 0x40;
    expect(f.bg2!.map[1 * 32 + 3]).toBe(full.bg2!.map[1 * 32 + 3]);   // item continua
    expect(f.bg2!.map[1 * 32 + 4]).toBe(blank);
    expect(f.bg2!.map[0]).toBe(blank);
    expect(f.bg1!.map[5 * 32 + 3]).toBe(blank);
    expect(f.bg1!.map[28 * 32 + 4]).toBe(full.bg1!.map[28 * 32 + 4]);   // HUD intacto
    expect(f.bands[1]).toMatchObject({ math: 'none', sub: 0 });
    expect(f.backdrop).toBeDefined();
    expect([...f.cgram]).not.toContain(f.backdrop);
  });

  it('HUD pulado: a faixa do HUD só com sprites; jogadores pulados: sem sprites de jogador', () => {
    const s = fakeRound();
    s.players[0].present = true;
    const f = buildBattleFrame(s, VIS, fakeAssets(), 0, { layers: [], skip: skip('hud', 'players') });
    expect(f.bands[0].main).toBe(16);
    expect(f.oam).toHaveLength(0);
    expect(buildBattleFrame(s, VIS, fakeAssets(), 0, { layers: [] }).oam.length).toBeGreaterThan(0);
  });

  it('blankWord acha a 1ª palavra 16×16 toda transparente', () => {
    expect(blankWord(fakeTiles(1024, t => (t === 0x40 || t === 0x41 || t === 0x50 || t === 0x51 ? 0 : 1)))).toBe(0x40);
  });

  it('drawRomBattle: pixels de fundo viram transparentes só nas faixas puladas', () => {
    const s = fakeRound();
    const put = vi.fn();
    const ctx = { putImageData: put, createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) } as unknown as CanvasRenderingContext2D;
    const a = fakeAssets({ arena: { bgTiles: fakeTiles(1024, () => 0) } });   // tudo transparente → só fundo
    expect(drawRomBattle(ctx, s, VIS, a, 0, { layers: [], skip: skip('hud') })).toBe(true);
    const img = put.mock.calls[0][0] as ImageData;
    const alpha = (x: number, y: number) => img.data[(y * 256 + x) * 4 + 3];
    expect([alpha(10, 5), alpha(10, 100)]).toEqual([0, 255]);
  });
});
