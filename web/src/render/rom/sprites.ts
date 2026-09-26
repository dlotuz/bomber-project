import { colOf, invisibleVisible, linOf, px, type Player, type RoundState } from '../../core';
import type { RomAssets, Tiles } from '../../rom/types';
import type { ObjEntry } from '../ppu';
import { romPlayerHooks } from '../battle-layers';
import { animCycle, sampleAnim } from '../anim/sample';
import { playerAnimRef, resolveAnim } from '../anim/player-anim';
import { invincibleHidden, pressureSprite, skullBlack } from '../anim/effects';
import { ORDER_OBJ, ORDER_PLAYER, ORDER_PRESSURE, type FrameBuilder } from './builder';
import type { RomTables } from './tables';
import { OBJ_ITEM_PAL, type RomClock, type RomMemo, type RomScene } from './scene';

export interface SpriteCtx {
  s: RoundState; a: RomAssets; tb: RomTables; scene: RomScene; clock: RomClock; memo: RomMemo;
  tiles: Tiles;   // tiles de BG do quadro (itens voando, D12)
}

export const PLAYER_OBJ_PAL = [0, 1, 4, 5, 6] as const;   // P1..P5 (ANI §2.5)
export const OBJ_BOMB = { tile: 0x180, pal: 7 } as const;  // anim $D8:D3A8: peça (−8,−8), tile $80 + base $100, attr $2F
export const OBJ_SHADOW = 0x04e;
export const OBJ_FALLING = 0x04c;
export const OBJ_PRESSURE_PAL = 7;                          // attr $2E

const BLACK = new Uint16Array(16);

/** 16×16 (tiles n, n+1, n+16, n+17) a partir de uma palavra de BG, com os flips dela. */
export function tile16Px(t: Tiles, word: number): Uint8Array {
  const n = word & 0x3ff;
  const h = (word & 0x4000) !== 0;
  const v = (word & 0x8000) !== 0;
  const out = new Uint8Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const sx = h ? 15 - x : x;
    const sy = v ? 15 - y : y;
    const tile = (n + (sx >> 3) + 16 * (sy >> 3)) & 0x3ff;
    out[y * 16 + x] = t.px[tile * 64 + (sy & 7) * 8 + (sx & 7)];
  }
  return out;
}

const itemPx = new WeakMap<Tiles, Map<number, Uint8Array>>();
function itemTilePx(t: Tiles, word: number): Uint8Array {
  let m = itemPx.get(t);
  if (!m) { m = new Map(); itemPx.set(t, m); }
  let p = m.get(word);
  if (!p) { p = tile16Px(t, word); m.set(word, p); }
  return p;
}

function loadPalette(b: FrameBuilder, c: SpriteCtx, p: Player): void {
  const colors = c.scene.team ? c.tb.teamPalette(p.char, p.slot) : c.a.character(p.char).palettes[p.slot];
  const black = p.disease !== 0 && p.disease !== 0x29 && skullBlack(c.clock.frame);
  const src = black ? BLACK : colors;
  const base = 128 + 16 * PLAYER_OBJ_PAL[p.slot];
  for (let i = 0; i < 16; i++) b.cgram(base + i, src[i] ?? 0);
}

function drawFrame(b: FrameBuilder, c: SpriteCtx, p: Player, X: number, Y: number, act: Player['act'], face: number,
  moving: boolean, t: number): void {
  const { ref, t: at } = playerAnimRef({ act, face, char: p.char, moving }, t);
  const anim = resolveAnim(c.a, ref, p.char);
  if (act === 'dying' && at >= animCycle(anim)) return;
  const sm = sampleAnim(anim, at);
  const ch = c.a.character(p.char);
  const pal = PLAYER_OBJ_PAL[p.slot];
  for (const pc of sm.frame.pieces) {
    b.sprite({ x: X + pc.dx + sm.ox, y: Y + pc.dy + sm.oy, size: 32, pal: (pal + pc.palAdd) & 7, prio: 2,
      hflip: pc.hflip, vflip: pc.vflip, src: { px: ch.frame(pc.tile) } }, Y, ORDER_PLAYER + p.slot);
  }
}

export function drawPlayers(b: FrameBuilder, c: SpriteCtx): void {
  const { s, a, clock } = c;
  for (const p of s.players) {
    if (!p.present || p.state === 'out' || p.state === 'bad') continue;
    loadPalette(b, c, p);
    if (invincibleHidden(p.inv)) continue;
    if (p.disease === 0x29 && !invisibleVisible(p)) continue;
    const X = px(p.x);
    const Y = px(p.y);
    let hooked = false;
    for (const h of romPlayerHooks) {
      const r = h(s, p, a, clock.frame);
      if (r) { for (const e of r) b.sprite(e, Y, ORDER_PLAYER + p.slot); hooked = true; break; }
    }
    if (!hooked) drawFrame(b, c, p, X, Y, p.act, p.face, p.moveDir !== 8, clock.tick - p.actT0);
  }
}

/** Bad Bombers (D20): posição e face de s.bad, animação de andar amostrada em `tick`. */
export function drawBadBombers(b: FrameBuilder, c: SpriteCtx): void {
  for (const bb of c.s.bad) {
    const p = c.s.players[bb.slot];
    if (!p) continue;
    loadPalette(b, c, p);
    drawFrame(b, c, p, bb.x, bb.y, 'bad', bb.face, true, c.clock.tick);
  }
}

export function drawObjects(b: FrameBuilder, c: SpriteCtx): void {
  c.scene.objs.forEach((o, i) => {
    const y = o.y - o.z;
    const e: ObjEntry = o.kind === 'bomb'
      ? { x: o.x - 8, y: y - 8, size: 16, pal: OBJ_BOMB.pal, prio: 2, hflip: false, vflip: false, src: { tile: OBJ_BOMB.tile } }
      : { x: o.x - 8, y: y - 8, size: 16, pal: OBJ_ITEM_PAL, prio: 2, hflip: false, vflip: false,
        src: { px: itemTilePx(c.tiles, c.tb.itemWord(o.item)) } };
    b.sprite(e, y, ORDER_OBJ + i);
  });
}

export function drawPressure(b: FrameBuilder, c: SpriteCtx): void {
  c.scene.drops.forEach((d, i) => {
    const col = colOf(d.cell);
    const lin = linOf(d.cell);
    const ps = pressureSprite(d, lin, c.clock.tick);
    const x = 16 * col - 8;
    const sortY = 16 * lin + 31;
    if (ps.blockY !== null) b.sprite({ x, y: ps.blockY, size: 16, pal: OBJ_PRESSURE_PAL, prio: 2, hflip: false, vflip: false,
      src: { tile: OBJ_FALLING } }, sortY, ORDER_PRESSURE + 2 * i);
    if (ps.shadow) b.sprite({ x, y: 16 * lin + 24, size: 16, pal: OBJ_PRESSURE_PAL, prio: 2, hflip: false, vflip: false,
      src: { tile: OBJ_SHADOW } }, sortY, ORDER_PRESSURE + 2 * i + 1);
  });
}

export function drawSprites(b: FrameBuilder, c: SpriteCtx): void {
  drawPlayers(b, c);
  drawBadBombers(b, c);
  drawObjects(b, c);
  drawPressure(b, c);
}
