// Desenho da partida com o pacote HD, em resolução nativa no canvas de saída. Tudo é posicionado em px da base
// (256×224) sob a transformação (sx, sy, ox, oy) da tela; um px do pacote vale 16 / `cell` px da base. O ponto de
// apoio (`anchor`) de cada quadro vai no ponto do jogo:
//  - peças da arena, itens, chamas e ovos: centro da casa (16·col, 16·lin + 32);
//  - bombas: centro da bomba (px(b.x), px(b.y)), subindo z quando na mão/voando;
//  - jogadores, cavaleiros, trajes e montarias: pés em (px(p.x), px(p.y) + FOOT_DY − z) — o ponto do núcleo é o
//    centro da casa quando parado; FOOT_DY = `FEET_BELOW_CENTER` do catálogo;
//  - HUD: canto de cima à esquerda de cada elemento no lugar do original (`HUD_AT`).
import { BURN, CODE, invisibleVisible, isEggCode, isItemCode, itemOfCode, px, type RoundState } from '../../core';
import { rider } from '../../core/mounts/types';
import { LIFT_Z, readScene } from '../rom/adapt';
import { newMemo, type RomMemo } from '../rom/scene';
import { pressureSprite } from '../anim/effects';
import { charKey, faceToHdDir, frameAt, itemKey, stageKey, type HdAnim, type HdFrame, type HdKey, type HdPack, type HdTile } from './types';
import { bombColor } from '../fx/bomb-tint';
import { bombKey, bombTypeOf, eggKey, fieldPlayers, flameKey, hudClockGlyphs, hudCrownKey, hudHeadKey, playerKeys, type HdCategory } from './cover';

/** Cores das etiquetas nP (mesmas de draw-game.ts; time 0 vermelho, time 1 branco). */
const PLAYER_COLORS = ['#ff5f5f', '#5fa8ff', '#ffd23f', '#5fe07a', '#c77dff'];
const TEAM_TAG_COLORS = ['#ff5f5f', '#ffffff'];
/** Pés do personagem/montaria abaixo do ponto do núcleo (px da base): = `FEET_BELOW_CENTER` do catálogo (um teste
 *  garante; o catálogo não entra no jogo para não levar as tabelas dele junto). */
export const FOOT_DY = 4;
/** A etiqueta nunca sobe até o HUD. */
const HUD_BOTTOM = 24;

/** Canto de cima à esquerda (px da base) de cada elemento do HUD, no lugar dos da ROM (mapa do HUD com hofs 8: coluna
 *  c em x = 8c − 8): ícone do relógio nas colunas 2–3, relógio nas 3–7 (∞ nas 4–6), rosto do jogador k nas 10 + 4k e
 *  11 + 4k, contador de coroas na 12 + 4k da linha do meio. */
export const HUD_AT = {
  bar: [0, 0] as const,
  clock: [8, 0] as const,
  glyph: (i: number) => [16 + 8 * i, 0] as const,
  infinity: [24, 0] as const,
  head: (k: number) => [72 + 32 * k, 0] as const,
  crown: (k: number) => [88 + 32 * k, 8] as const,
};

/** Relógio visual: congela tudo no TIME UP (e no `over` seguinte) e só as bombas na vitória (mesma regra do
 *  `battleClock` da ROM, com memória própria para valer também sem a ROM). */
export interface HdClock { tick: number; bombTick: number }
const freeze = new WeakMap<RoundState, { all: number | null; bombs: number | null; memo: RomMemo }>();
function memoOf(s: RoundState) {
  let m = freeze.get(s);
  if (!m) { m = { all: null, bombs: null, memo: newMemo() }; freeze.set(s, m); }
  return m;
}
export function hdClock(s: RoundState): HdClock {
  const m = memoOf(s);
  if (s.phase === 'timeUp') m.all ??= s.phaseT0;
  else if (s.phase !== 'over') m.all = null;
  if (s.phase === 'won') m.bombs ??= s.phaseT0;
  else if (s.phase !== 'over') m.bombs = null;
  return { tick: m.all ?? s.tick, bombTick: m.all ?? m.bombs ?? s.tick };
}

export interface HdDrawOpts {
  /** Categorias desenhadas nesta passada (as outras ficam com a base ou com a outra passada). */
  cats: ReadonlySet<HdCategory>;
  crowns?: readonly number[];
  /** Brilho 0..1 (fade do App); a passada por cima da base precisa aplicá-lo ela mesma. */
  fade?: number;
  /** Cor da bomba por jogador (fx): devolve o recorte `rect` de `img` com o corpo na cor `color` (imagem do tamanho
   *  do recorte) ou null (sem como pintar: desenha a arte como está). Ausente = bombas na arte do pacote. */
  bombTint?: (img: CanvasImageSource, rect: readonly [number, number, number, number], color: number) => CanvasImageSource | null;
}

/** Item da lista ordenada por y (sprites do original). */
interface Spr { sortY: number; order: number; draw: () => void }

/** Desenha a partida (as categorias de `opts.cats`) em `out`. Devolve quantos quadros do pacote desenhou. */
export function drawHdBattle(out: CanvasRenderingContext2D, round: RoundState, pack: HdPack, sx: number, sy: number,
  ox: number, oy: number, clock: HdClock, opts: HdDrawOpts): number {
  const { cats } = opts;
  if (!cats.size) return 0;
  const k = 16 / pack.manifest.cell;
  const { tick, bombTick } = clock;
  let drawn = 0;
  /** Quadro de `key` no tempo `t` com o apoio em (x, y); devolve o quadro (topo = y − ay·k) ou null. */
  const put = (key: HdKey, t: number, x: number, y: number, owner = -1): HdFrame | null => {
    const a = pack.anim(key);
    if (!a) return null;
    const f = frameAt(a, t);
    let img = pack.images.get(f.img);
    if (!img) return null;
    let [rx, ry] = f.rect;
    const [, , rw, rh] = f.rect;
    const tinted = owner >= 0 && opts.bombTint ? opts.bombTint(img, f.rect, bombColor(owner)) : null;   // bomba do dono
    if (tinted) { img = tinted; rx = 0; ry = 0; }
    out.drawImage(img, rx, ry, rw, rh, x - f.anchor[0] * k, y - f.anchor[1] * k, rw * k, rh * k);
    drawn++;
    return f;
  };

  out.save();
  out.setTransform(sx, 0, 0, sy, ox, oy);
  out.beginPath(); out.rect(0, 0, 256, 224); out.clip();
  out.imageSmoothingEnabled = true;
  out.imageSmoothingQuality = 'high';
  out.globalAlpha = 1;
  const fade = opts.fade ?? 1;
  if (fade < 1) out.filter = `brightness(${Math.max(0, fade)})`;

  const s = round, st = s.stage;
  const has = (key: HdKey) => pack.anim(key) !== null;
  const cx = (c: number) => 16 * (c % 17), cy = (c: number) => 16 * Math.floor(c / 17) + 32;

  // ---- arena (BG): chão em xadrez, paredes da borda, pilares, blocos, blocos queimando, pressão
  if (cats.has('arena')) {
    const alt = has(stageKey(st, 'floorAlt'));
    for (let lin = 0; lin < 13; lin++) for (let col = 0; col < 17; col++) {
      const c = lin * 17 + col, v = s.grid[c], x = 16 * col, y = 16 * lin + 32;
      if (col <= 1 || col >= 15 || lin === 0 || lin === 12) { put(stageKey(st, 'wall'), tick, x, y); continue; }
      put(stageKey(st, alt && (col + lin) % 2 ? 'floorAlt' : 'floor'), tick, x, y);
      if (v === CODE.BURNING && s.cellAux[c] === BURN.ITEM && has('fx/item-burn')) { put('fx/item-burn', tick - s.cellT0[c], x, y); continue; }
      const top: HdTile | null = v === CODE.HARD ? 'hard' : v === CODE.PRESSURE ? 'pressure' : v === CODE.SOFT ? 'soft'
        : v === CODE.BURNING ? 'burning' : null;
      if (top) put(stageKey(st, top), top === 'burning' ? tick - s.cellT0[c] : tick, x, y);
    }
  }
  // ---- itens, chamas e bombas paradas (BG do original: sempre por baixo dos sprites)
  if (cats.has('items')) s.grid.forEach((v, c) => { if (isItemCode(v) && !isEggCode(v)) put(itemKey(itemOfCode(v)), tick, cx(c), cy(c)); });
  if (cats.has('flames')) s.grid.forEach((v, c) => { if (v === CODE.FLAME) put(flameKey(s.cellAux[c]), tick - s.cellT0[c], cx(c), cy(c)); });
  if (cats.has('bombs')) for (const b of s.bombs) if (b.state === 'idle') put(bombKey(b.type), bombTick - b.born, px(b.x), px(b.y), b.owner);

  // ---- sprites, ordenados por y como na OAM (maior y na frente; empate: menor `order` na frente)
  const spr: Spr[] = [];
  if (cats.has('arena')) {   // blocos da pressão caindo (sem `fx/pressure-block`, a peça `pressure` da arena)
    const scene = readScene(s, tick, memoOf(s).memo);
    const block = has('fx/pressure-block') ? 'fx/pressure-block' : stageKey(st, 'pressure');
    scene.drops.forEach((d, i) => {
      const ps = pressureSprite(d, Math.floor(d.cell / 17), tick);
      if (ps.shadow && has('fx/pressure-shadow')) spr.push({ sortY: cy(d.cell) - 1, order: 301 + 2 * i, draw: () => put('fx/pressure-shadow', tick, cx(d.cell), cy(d.cell)) });
      if (ps.blockY !== null) spr.push({ sortY: cy(d.cell) - 1, order: 300 + 2 * i, draw: () => put(block, tick, cx(d.cell), ps.blockY! + 8) });
    });
  }
  if (cats.has('bombs')) {
    let i = 0;
    for (const b of s.bombs) {
      if (b.state === 'kicked') { const x = px(b.x), y = px(b.y); spr.push({ sortY: y, order: 100 + i++, draw: () => put(bombKey(b.type), bombTick - b.born, x, y, b.owner) }); }
      else if (b.state === 'held') {
        const p = s.players.find(q => q.present && q.carry === b.id);
        const bb = p ? null : s.bad.find(q => q.slot === b.owner);
        if (!p && !bb) continue;
        const x = p ? px(p.x) : bb!.x, y = p ? px(p.y) - p.z : bb!.y;
        const z = p && p.act === 'lift' ? LIFT_Z[Math.min(3, Math.max(0, tick - p.actT0))] : 16;
        spr.push({ sortY: y - z, order: 100 + i++, draw: () => put(bombKey(b.type), bombTick - b.born, x, y - z) });
      }
    }
    for (const f of s.flyers) if (f.kind === 'bomb') {
      const x = px(f.x), y = px(f.y) - Math.max(0, -f.z), b = s.bombs.find(q => q.id === f.ref);
      spr.push({ sortY: y, order: 100 + i++, draw: () => put(bombKey(bombTypeOf(s, f.ref)), bombTick - (b?.born ?? 0), x, y, b?.owner ?? -1) });
    }
  }
  if (cats.has('items')) s.flyers.forEach((f, i) => {
    if (f.kind !== 'item') return;
    const x = px(f.x), y = px(f.y) - Math.max(0, -f.z);
    spr.push({ sortY: y, order: 150 + i, draw: () => put(itemKey(f.ref), tick, x, y) });
  });
  if (cats.has('eggs')) s.grid.forEach((v, c) => {
    if (isEggCode(v)) spr.push({ sortY: cy(c), order: 200 + c, draw: () => put(eggKey(v & 0xf), tick - s.phaseT0, cx(c), cy(c)) });
  });
  const tags: { x: number; top: number; slot: number }[] = [];
  if (cats.has('players')) {
    for (const p of fieldPlayers(s)) {
      const keys = playerKeys(p);
      const r = rider(p);
      // montado: a animação da montaria/cavaleiro é uma só; parado mostra o 1º quadro (catálogo)
      const t = r?.phase === 'riding' && p.moveDir === 8 ? 0 : tick - p.actT0;
      if (p.state === 'dying') { const a = pack.anim(keys.body); if (!a || (!a.loop && t >= total(a))) continue; }
      if (p.state === 'alive' && (!invisibleVisible(p) || (p.inv & 2) !== 0)) continue;   // invisível / piscando
      const X = px(p.x), Y = px(p.y) + FOOT_DY - p.z;
      spr.push({ sortY: px(p.y) + (p.z ? 1 : 0), order: p.slot, draw: () => {
        if (keys.mount && r) put(keys.mount, r.phase === 'riding' ? t : tick - r.t0, X, Y);   // montaria atrás do cavaleiro
        const f = put(keys.body, t, X, Y);
        if (f && p.state === 'alive') tags.push({ x: X, top: Y - f.anchor[1] * k, slot: p.slot });
      } });
    }
    for (const b of s.bad) {
      const p = s.players[b.slot];
      if (p) spr.push({ sortY: b.y, order: 50 + b.slot, draw: () => put(charKey(p.char, 'bad', faceToHdDir(b.face)), tick, b.x, b.y + FOOT_DY) });
    }
  }
  spr.sort((a, b) => a.sortY - b.sortY || b.order - a.order);
  for (const e of spr) e.draw();
  // etiqueta nP acima da cabeça (distingue bombers iguais); some durante a morte
  for (const t of tags) {
    const color = s.rules.mode === 'team' ? TEAM_TAG_COLORS[s.players[t.slot].team] : PLAYER_COLORS[t.slot];
    label(out, `${t.slot + 1}P`, t.x, Math.max(HUD_BOTTOM + 4, t.top - 4), 7, color);
  }

  // ---- HUD (como o da ROM: rostos e contadores de quem está na partida, vivo ou não)
  if (cats.has('hud')) {
    put('hud/bar', tick, ...HUD_AT.bar);
    put('hud/clock', tick, ...HUD_AT.clock);
    const glyphs = hudClockGlyphs(s.clock.sec);
    if (glyphs === 'infinity') put('hud/infinity', tick, ...HUD_AT.infinity);
    else glyphs.forEach((k, i) => { if (k) put(k, tick, ...HUD_AT.glyph(i)); });
    s.players.forEach((p, i) => {
      if (!p.present) return;
      put(hudHeadKey(p.char), tick, ...HUD_AT.head(i));
      put(hudCrownKey(opts.crowns?.[i] ?? 0), tick, ...HUD_AT.crown(i));
    });
  }
  out.restore();
  return drawn;
}

const total = (a: HdAnim): number => a.ticks.reduce((n, d) => n + d, 0);

/** Texto HD centrado em (x, y) com contorno escuro (etiquetas, relógio, coroas). `size` em px da base. */
function label(out: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string): void {
  out.font = `700 ${size}px "Fredoka", "Arial Rounded MT Bold", system-ui, sans-serif`;
  out.textAlign = 'center';
  out.textBaseline = 'middle';
  out.lineJoin = 'round';
  out.strokeStyle = '#101018';
  out.lineWidth = size * 0.3;
  out.strokeText(text, x, y);
  out.fillStyle = color;
  out.fillText(text, x, y);
}
