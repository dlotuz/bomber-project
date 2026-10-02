import { CODE, cellOf, invisibleVisible, itemCode, ITEM, DISEASE, type Bomb, type Player } from '../../src/core';
import { drawHdBattle, FOOT_DY, hdClock, HUD_AT } from '../../src/render/hdart/draw';
import type { HdCategory } from '../../src/render/hdart/cover';
import { FEET_BELOW_CENTER } from '../../src/render/hdart/catalog';
import { fakeRound } from '../render-rom/fakes';
import { anim, arenaAnims, IMG_A, IMG_B, recCtx, still, testPack, type DrawCall } from './helpers';

const cats = (...c: HdCategory[]) => ({ cats: new Set(c) });
const SUB = 256;
/** Centro da casa → posição de 1/256 px do núcleo. */
const at = (col: number, lin: number) => ({ x: (16 * col) * SUB, y: (16 * lin + 32) * SUB });

function round(players = 0) {
  const s = fakeRound({ stage: 1, tick: 100 });
  s.players.forEach((p, i) => { p.present = i < players; p.char = i; p.act = 'idle'; p.face = 4; });
  return s;
}
function place(p: Player, col: number, lin: number) { Object.assign(p, at(col, lin)); }
const bomb = (over: Partial<Bomb>): Bomb => ({
  id: 1, owner: 0, bad: false, cell: 0, x: 0, y: 0, fuse: 100, fire: 2, type: 0, state: 'idle', dir: 0, step: 0,
  kickedBy: -1, turn: -1, chainAt: 0, born: 0, ...over,
});
const dest = (c: DrawCall) => [c.dx, c.dy, c.dw, c.dh];

describe('drawHdBattle: escala, apoio e transformação', () => {
  it('pés na mesma regra do catálogo', () => expect(FOOT_DY).toBe(FEET_BELOW_CENTER));

  it('item: apoio no centro da casa, 64 px do pacote = 16 px da base, sob (sx, sy, ox, oy)', () => {
    const s = round();
    s.grid[cellOf(3, 1)] = itemCode(ITEM.FIRE);
    const out = recCtx();
    drawHdBattle(out, s, testPack({ 'item/03': still(64) }), 5, 4, 3, -2, hdClock(s), cats('items'));
    expect(out.transforms[0]).toEqual([5, 0, 0, 4, 3, -2]);
    expect(out.calls).toHaveLength(1);
    expect(out.calls[0]).toMatchObject({ img: IMG_A, sx: 64, sy: 0, sw: 64, sh: 64 });
    expect(dest(out.calls[0])).toEqual([48 - 8, 48 - 8, 16, 16]);
  });

  it('cell 32: o mesmo desenho sai com o dobro do tamanho na base', () => {
    const s = round();
    s.grid[cellOf(3, 1)] = itemCode(ITEM.FIRE);
    const out = recCtx();
    drawHdBattle(out, s, testPack({ 'item/03': still() }, 32), 1, 1, 0, 0, hdClock(s), cats('items'));
    expect(dest(out.calls[0])).toEqual([48 - 16, 48 - 16, 32, 32]);
  });

  it('categorias fora da passada não desenham', () => {
    const s = round();
    s.grid[cellOf(3, 1)] = itemCode(ITEM.FIRE);
    const out = recCtx();
    expect(drawHdBattle(out, s, testPack({ 'item/03': still(), ...arenaAnims(1) }), 1, 1, 0, 0, hdClock(s), cats('flames'))).toBe(0);
    expect(out.calls).toHaveLength(0);
  });
});

describe('drawHdBattle: arena', () => {
  it('17×13 casas: borda = parede, pilar = chão + pilar, bloco = chão + bloco; xadrez com floorAlt', () => {
    const s = round();
    s.grid[cellOf(4, 3)] = CODE.SOFT;
    s.grid[cellOf(2, 2)] = CODE.HARD;
    const pack = testPack({ ...arenaAnims(1), 'stage/1/floorAlt': still(6 * 64) });
    const out = recCtx();
    drawHdBattle(out, s, pack, 1, 1, 0, 0, hdClock(s), cats('arena'));
    const byPos = (x: number, y: number) => out.calls.filter(c => c.dx === x - 8 && c.dy === y - 8).map(c => c.sx);
    // recortes: floor 0, hard 64, wall 128, soft 192, burning 256, pressure 320, floorAlt 384
    expect(byPos(0, 32)).toEqual([128]);                 // (0, 0) borda
    expect(byPos(16 * 2, 16 * 2 + 32)).toEqual([0, 64]); // (2, 2) pilar sobre o chão
    expect(byPos(16 * 4, 16 * 3 + 32)).toEqual([384, 192]); // (4, 3) bloco sobre o chão alternado
    expect(byPos(16 * 3, 16 * 1 + 32)).toEqual([0]);     // (3, 1) chão
  });

  it('bloco queimando anima desde o início da queima', () => {
    const s = round();
    const c = cellOf(5, 5);
    s.grid[c] = CODE.BURNING; s.cellT0[c] = 92;   // 8 ticks atrás
    const out = recCtx();
    drawHdBattle(out, s, testPack({ ...arenaAnims(1), 'stage/1/burning': anim(4, 4, false) }), 1, 1, 0, 0, hdClock(s), cats('arena'));
    const burn = out.calls.find(k => k.img === IMG_B)!;
    expect(burn.sx).toBe(128);   // 3º quadro (ticks 8–11)
  });
});

describe('drawHdBattle: efeitos opcionais da arena', () => {
  it('item queimando usa fx/item-burn quando existe; senão a peça burning', () => {
    const s = round();
    const c = cellOf(5, 5);
    s.grid[c] = CODE.BURNING; s.cellAux[c] = 1; s.cellT0[c] = 100;   // BURN.ITEM
    const run = (extra: Record<string, ReturnType<typeof still>>) => {
      const o = recCtx();
      drawHdBattle(o, s, testPack({ ...arenaAnims(1), ...extra }), 1, 1, 0, 0, hdClock(s), cats('arena'));
      return o.calls.filter(k => k.dx === 80 - 8 && k.dy === 112 - 8).map(k => k.sx);
    };
    expect(run({})).toEqual([0, 256]);                               // chão + burning
    expect(run({ 'fx/item-burn': still(7 * 64) })).toEqual([0, 448]);
  });
  it('bloco da pressão caindo: fx/pressure-block (ou a peça pressure) e a sombra opcional', () => {
    const s = round();
    const cell = cellOf(4, 6);
    s.pressure.falling.push({ cell, t0: 98, land: 104 });
    const o = recCtx();
    drawHdBattle(o, s, testPack({ ...arenaAnims(1), 'fx/pressure-block': still(8 * 64), 'fx/pressure-shadow': still(9 * 64) }), 1, 1, 0, 0, hdClock(s), cats('arena'));
    const fx = o.calls.filter(k => k.sx >= 8 * 64).map(k => [k.sx, k.dx + 8, k.dy + 8]);
    expect(fx).toEqual([[9 * 64, 64, 16 * 6 + 32], [8 * 64, 64, 16 * 6 + 24 - 8 * 4 + 8]]);   // sombra, bloco 4 ticks acima
  });
});

describe('drawHdBattle: chamas e bombas', () => {
  it('chama pela peça e pela idade (encolhe no fim: animação sem loop)', () => {
    const s = round();
    const c = cellOf(6, 2);
    s.grid[c] = CODE.FLAME; s.cellAux[c] = 6; s.cellT0[c] = 70;   // ponta direita, 30 ticks
    const out = recCtx();
    drawHdBattle(out, s, testPack({ 'flame/right': anim(3, 8, false) }), 1, 1, 0, 0, hdClock(s), cats('flames'));
    expect(out.calls[0].sx).toBe(128);
  });

  it('bomba pulsa desde que nasceu; na vitória o pulso congela', () => {
    const s = round();
    s.bombs.push(bomb({ ...at(4, 4), born: 95, type: 1 }));
    const pack = testPack({ 'bomb/1': anim(2, 4, true) });
    const out = recCtx();
    drawHdBattle(out, s, pack, 1, 1, 0, 0, hdClock(s), cats('bombs'));
    expect(out.calls[0].sx).toBe(64);                           // t = 5
    expect(dest(out.calls[0]).slice(0, 2)).toEqual([64 - 8, 96 - 14]);   // apoio (32, 56)
    s.phase = 'won'; s.phaseT0 = 96;
    hdClock(s);
    s.tick = 140;
    const o2 = recCtx();
    drawHdBattle(o2, s, pack, 1, 1, 0, 0, hdClock(s), cats('bombs'));
    expect(o2.calls[0].sx).toBe(0);                             // t = 1 (congelado em 96)
  });

  it('bomba na mão sobe 16 px; item voando sobe a altura dele', () => {
    const s = round(1);
    place(s.players[0], 5, 5);
    s.players[0].carry = 7;
    s.bombs.push(bomb({ id: 7, state: 'held', owner: 0 }));
    s.flyers.push({ id: 9, kind: 'item', ref: ITEM.BOMB, ...at(8, 8), z: -10, dir: 0, flight: 'item', script: 0, i: 0, born: 0 });
    const out = recCtx();
    drawHdBattle(out, s, testPack({ 'bomb/0': still(), 'item/01': still(64) }), 1, 1, 0, 0, hdClock(s), cats('bombs', 'items'));
    const b = out.calls.find(c => c.sx === 0)!, it = out.calls.find(c => c.sx === 64)!;
    expect([b.dx + 8, b.dy + 8]).toEqual([80, 112 - 16]);
    expect([it.dx + 8, it.dy + 8]).toEqual([128, 160 - 10]);
  });
});

describe('drawHdBattle: jogadores', () => {
  it('ordem por y (mais embaixo na frente); empate: slot menor na frente', () => {
    const s = round(3);
    place(s.players[0], 5, 6);
    place(s.players[1], 5, 4);
    place(s.players[2], 7, 6);
    const pack = testPack({ 'char/0/idle/down': still(0), 'char/1/idle/down': still(64), 'char/2/idle/down': still(128) });
    const out = recCtx();
    drawHdBattle(out, s, pack, 1, 1, 0, 0, hdClock(s), cats('players'));
    expect(out.calls.map(c => c.sx)).toEqual([64, 128, 0]);
  });

  it('ação pela face e tempo desde o início da ação; montaria antes do cavaleiro', () => {
    const s = round(1);
    const p = s.players[0];
    place(p, 5, 5);
    p.act = 'walk'; p.face = 2; p.actT0 = 95;
    const out = recCtx();
    drawHdBattle(out, s, testPack({ 'char/0/walk/right': anim(3, 4, true) }), 1, 1, 0, 0, hdClock(s), cats('players'));
    expect(out.calls[0].sx).toBe(64);   // t = 5
    expect(dest(out.calls[0])).toEqual([80 - 8, 112 + FOOT_DY - 14, 16, 16]);   // pés FOOT_DY abaixo do centro da casa
    p.mount = { type: 0xc, slot: 1, phase: 'riding', t0: 50, reserves: [], trail: [], cooldown: 0, remount: false, remountFx: null };
    const o2 = recCtx();
    drawHdBattle(o2, s, testPack({ 'mount/c/riding/right': still(0, 'b'), 'rider/0/right': still(0, 'a') }), 1, 1, 0, 0, hdClock(s), cats('players'));
    expect(o2.calls.map(c => c.img)).toEqual([IMG_B, IMG_A]);
  });

  it('montado parado mostra o 1º quadro; andando, o tempo desde o início da ação', () => {
    const s = round(1);
    const p = s.players[0];
    place(p, 5, 5);
    p.face = 4; p.actT0 = 95; p.moveDir = 8;
    p.mount = { type: 0xc, slot: 1, phase: 'riding', t0: 0, reserves: [], trail: [], cooldown: 0, remount: false, remountFx: null };
    const pack = testPack({ 'mount/c/riding/down': anim(3, 4, true), 'rider/0/down': anim(3, 4, true, 'a') });
    const xs = () => { const o = recCtx(); drawHdBattle(o, s, pack, 1, 1, 0, 0, hdClock(s), cats('players')); return o.calls.map(c => c.sx); };
    expect(xs()).toEqual([0, 0]);
    p.moveDir = 4;
    expect(xs()).toEqual([64, 64]);   // t = 5
  });

  it('piscar da invencibilidade e invisibilidade: mesmas regras da arte simples', () => {
    const s = round(1);
    const p = s.players[0];
    place(p, 5, 5);
    const pack = testPack({ 'char/0/idle/down': still() });
    const n = () => { const o = recCtx(); drawHdBattle(o, s, pack, 1, 1, 0, 0, hdClock(s), cats('players')); return o.calls.length; };
    expect(n()).toBe(1);
    p.inv = 6; expect(n()).toBe(0);
    p.inv = 5; expect(n()).toBe(1);
    p.inv = 0; p.disease = DISEASE.INVISIBLE;
    const seen = new Set<number>();
    for (let t = 0; t < 128; t++) { p.diseaseT = t; const k = n(); seen.add(k); expect(k).toBe(invisibleVisible(p) ? 1 : 0); }
    expect([...seen].sort()).toEqual([0, 1]);
  });

  it('morrendo: a animação (sem loop) toca até o fim e o jogador some', () => {
    const s = round(1);
    const p = s.players[0];
    place(p, 5, 5);
    p.state = 'dying'; p.act = 'dying'; p.actT0 = 90;
    const pack = testPack({ 'char/0/dying': anim(3, 4, false) });
    const o = recCtx();
    drawHdBattle(o, s, pack, 1, 1, 0, 0, hdClock(s), cats('players'));
    expect(o.calls[0].sx).toBe(128);   // t = 10
    s.tick = 102;
    const o2 = recCtx();
    drawHdBattle(o2, s, pack, 1, 1, 0, 0, hdClock(s), cats('players'));
    expect(o2.calls).toHaveLength(0);
  });

  it('etiqueta nP acima da cabeça, na cor do jogador', () => {
    const s = round(2);
    place(s.players[0], 5, 5);
    place(s.players[1], 9, 5);
    const out = recCtx();
    drawHdBattle(out, s, testPack({ 'char/0/idle/down': still(), 'char/1/idle/down': still() }), 1, 1, 0, 0, hdClock(s), cats('players'));
    expect(out.texts.map(t => [t.text, t.x, t.color]).sort()).toEqual([['1P', 80, '#ff5f5f'], ['2P', 144, '#5fa8ff']]);
    expect(out.texts[0].y).toBeLessThan(112 + FOOT_DY - 8);
  });
});

describe('drawHdBattle: HUD', () => {
  it('canto de cima à esquerda no lugar do original: barra, relógio, algarismos, rostos e coroas', () => {
    const s = round(2);
    s.clock.sec = 65;
    const tl = (x: number, w = 64, h = 96): ReturnType<typeof still> => still(x, 'a', [0, 0], [x, 0, w, h]);
    const pack = testPack({
      'hud/bar': tl(0, 1024, 96), 'hud/clock': tl(1), 'hud/colon': tl(2, 32), 'hud/digit/0': tl(3, 32), 'hud/digit/1': tl(4, 32),
      'hud/digit/5': tl(5, 32), 'hud/head/0': tl(6), 'hud/head/1': tl(7), 'hud/crown/2': tl(8, 32, 32), 'hud/crown/1': tl(9, 32, 32),
    });
    const out = recCtx();
    drawHdBattle(out, s, pack, 1, 1, 0, 0, hdClock(s), { cats: new Set<HdCategory>(['hud']), crowns: [2, 1, 0, 0, 0] });
    expect(out.calls.map(c => [c.sx, c.dx, c.dy, c.dw, c.dh])).toEqual([
      [0, 0, 0, 256, 24],                                  // barra
      [1, 8, 0, 16, 24],                                   // ícone do relógio
      [4, 24, 0, 8, 24], [2, 32, 0, 8, 24], [3, 40, 0, 8, 24], [5, 48, 0, 8, 24],   // 1:05 (sem dezena de minutos)
      [6, HUD_AT.head(0)[0], 0, 16, 24], [8, 88, 8, 8, 8],
      [7, HUD_AT.head(1)[0], 0, 16, 24], [9, 120, 8, 8, 8],
    ]);
    expect(out.texts).toEqual([]);
  });
});
