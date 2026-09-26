import { createHash } from 'node:crypto';
import { buildBattleFrame } from '../../src/render/rom/battle';
import { faceTileIds, headTiles } from '../../src/render/rom/hud';
import { PLAYER_OBJ_PAL } from '../../src/render/rom/sprites';
import { renderPpu, type ObjEntry } from '../../src/render/ppu';
import { px, type RoundState } from '../../src/core';
import { blankImage } from './fakes';
import { ASSETS } from './rom-fixture';
import { BTN, NO_INPUT, newRound, stepN, toPlay } from './core-fixture';

const VIS = { crowns: [0, 0, 0, 0, 0] };
const frameOf = (s: RoundState, frame = 0) => buildBattleFrame(s, VIS, ASSETS!, frame);
const A1 = [BTN.A, 0, 0, 0, 0];
const RIGHT1 = [BTN.RIGHT, 0, 0, 0, 0];
function runs<T>(xs: readonly T[]): [T, number][] {
  const out: [T, number][] = [];
  for (const v of xs) { if (out.length && out[out.length - 1][0] === v) out[out.length - 1][1]++; else out.push([v, 1]); }
  return out;
}
const sha = (b: Uint8Array) => createHash('sha1').update(b).digest('hex');
const p1Obj = (oam: ObjEntry[]) => oam.find(e => e.size === 32 && e.pal === PLAYER_OBJ_PAL[0]) ?? null;
function gIndex(char: number): (e: ObjEntry | null) => number | null {
  const byHash = new Map<string, number>();
  for (let g = 63; g >= 0; g--) byHash.set(sha(ASSETS!.character(char).frame(g)), g);
  return e => (e && 'px' in e.src ? byHash.get(sha(e.src.px)) ?? -1 : null);
}

describe.skipIf(!ASSETS)('partida real com a ROM (§11, aceite 7)', () => {
  it('bomba 18, 12, 16, 16, 20, 12, 16; chama A2 B2 C2 … A1; soft (4,1) queima 6 × 4', () => {
    const s = newRound(1);
    toPlay(s);
    stepN(s, 1, A1);
    expect(s.grid[1 * 17 + 2]).toBe(0xc900);
    const center: number[] = [];
    const soft: number[] = [];
    for (let i = 0; i < 170; i++) {
      const m = frameOf(s).bg2!.map;
      center.push(m[1 * 32 + 2]);
      soft.push(m[1 * 32 + 4]);
      stepN(s, 1);
    }
    expect(runs(center).slice(0, 7)).toEqual([[0x0b00, 18], [0x0b02, 12], [0x0b04, 16], [0x0b06, 16], [0x0b00, 20], [0x0b02, 12], [0x0b04, 16]]);
    const f = center.indexOf(0x0f6c);
    expect(f).toBeGreaterThan(100);
    expect(runs(center.slice(f, f + 25))).toEqual([[0x0f6c, 2], [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0fac, 2],
      [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0f6c, 1]]);
    expect(center[f + 25]).toBe(ASSETS!.arena(1).floor[1 * 32 + 2]);
    const b = soft.indexOf(0x0c20);
    expect(runs(soft.slice(b, b + 24))).toEqual([0x0c20, 0x0c22, 0x0c24, 0x0c26, 0x0c28, 0x0c2a].map(w => [w, 4]));
    const after = soft[b + 24];
    expect(after === ASSETS!.arena(1).floor[1 * 32 + 4] || (after & 0xff00) === 0x1200).toBe(true);
  });

  it('andar → (fase 5): g4:12 g3:8 g5:12 g3:8 em (X − 16, Y − 24)', () => {
    const s = newRound(5);
    toPlay(s);
    const g = gIndex(s.players[0].char);
    const seq: (number | null)[] = [];
    for (let i = 0; i < 60; i++) {
      stepN(s, 1, RIGHT1);
      const e = p1Obj(frameOf(s).oam);
      const p = s.players[0];
      expect([e!.x, e!.y]).toEqual([px(p.x) - 16, px(p.y) - 24]);
      if (p.act === 'walk') seq.push(g(e));
    }
    expect(runs(seq.slice(0, 40))).toEqual([[4, 12], [3, 8], [5, 12], [3, 8]]);
  });

  it('morte: g24:5 g25:5 g26:6 g27:6 e some', () => {
    const s = newRound(1);
    toPlay(s);
    stepN(s, 1, A1);
    for (let i = 0; i < 200 && s.players[0].act !== 'dying'; i++) stepN(s, 1);
    expect(s.players[0].act).toBe('dying');
    const g = gIndex(s.players[0].char);
    const seq: (number | null)[] = [];
    for (let i = 0; i < 30; i++) { seq.push(g(p1Obj(frameOf(s).oam))); stepN(s, 1); }
    expect(runs(seq)).toEqual([[24, 5], [25, 5], [26, 6], [27, 6], [null, 8]]);
  });

  it('ordem de desenho no início da fase 5: P2, P4, P5, P1, P3 (maior Y na frente; empate = slot menor)', () => {
    const s = newRound(5);
    toPlay(s);
    const slots = frameOf(s).oam.filter(e => e.size === 32).map(e => PLAYER_OBJ_PAL.indexOf(e.pal as 0));
    expect(slots).toEqual([1, 3, 4, 0, 2]);
  });

  it('HUD: dígitos seguem o relógio (M2: até o jogo mudar de 3:00 para 2:59); rostos = ordem/endereço da própria ROM', () => {
    const s = newRound(1);
    toPlay(s);   // sem isso a intro trava o relógio em 3:00 e o teste não prova a mudança (M2)
    const digit = (w: number) => { const t = (w & 0x3ff) - 0x200; return t === 0x39 ? 0 : t - 0x2f; };
    const secsSeen = new Set<number>();
    for (let i = 0; i < 65; i++) {
      const m = frameOf(s).bg1!.map;
      const row = 28 * 32;
      const shown = `${digit(m[row + 4])}:${digit(m[row + 6])}${digit(m[row + 7])}`;
      expect(shown).toBe(`${Math.floor(s.clock.sec / 60)}:${String(s.clock.sec % 60).padStart(2, '0')}`);
      secsSeen.add(s.clock.sec);
      stepN(s, 1);
    }
    expect(secsSeen.has(180)).toBe(true);
    expect(secsSeen.has(179)).toBe(true);   // o relógio realmente mudou de 3:00 para 2:59 (M2)
    // M2: verdade da ROM (sondas da revisão) em vez de comparar headTiles com ele mesmo — a folha-base da arena,
    // nos endereços do rosto de cada slot, já é o rosto do personagem 0, byte a byte, nas 6 posições (TL,TR,ML,MR,BL,BR).
    const ar = ASSETS!.arena(1);
    for (let slot = 0; slot < 5; slot++) {
      const head = headTiles(ASSETS!.character(0), slot);
      faceTileIds(slot).forEach((tile, i) => {
        expect(Array.from(ar.bgTiles.px.subarray(tile * 64, tile * 64 + 64))).toEqual(Array.from(head[i]));
      });
    }
  });

  it('bomba em movimento: anim $D8:D3A8 = peça 16×16 em (−8, −8), tile $80', () => {
    const p = ASSETS!.anim(0xd8d3a8)[0].pieces[0];
    expect([p.dx, p.dy, p.tile, p.big]).toEqual([-8, -8, 0x80, false]);
  });

  it('color math da arena 6 não mistura os jogadores (só BG1)', () => {
    const s = newRound(6);
    toPlay(s);
    const f = frameOf(s);
    const img = blankImage();
    renderPpu(f, img);
    const e = p1Obj(f.oam)!;
    const src = (e.src as { px: Uint8Array }).px;
    const c8 = (c: number) => (c << 3) | (c >> 2);
    let total = 0;
    let exact = 0;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const i = src[y * 32 + (e.hflip ? 31 - x : x)];
      const sx = e.x + x, sy = e.y + y;
      if (!i || sx < 0 || sx > 255 || sy < 24 || sy > 223) continue;
      const c = f.cgram[128 + 16 * e.pal + i];
      const o = (sy * 256 + sx) * 4;
      total++;
      if (img.data[o] === c8(c & 31) && img.data[o + 1] === c8((c >> 5) & 31) && img.data[o + 2] === c8((c >> 10) & 31)) exact++;
    }
    expect(total).toBeGreaterThan(100);
    expect(exact / total).toBeGreaterThan(0.9);
  });

  it('desempenho: montar + renderPpu abaixo de 8 ms por quadro (Node)', () => {
    const s = newRound(2);
    toPlay(s);
    const img = blankImage();
    renderPpu(frameOf(s), img);
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) { stepN(s, 1, NO_INPUT); renderPpu(frameOf(s, i), img); }
    expect((performance.now() - t0) / 60).toBeLessThan(8);
  });
});
