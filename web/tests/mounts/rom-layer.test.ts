import { createHash } from 'node:crypto';
import fx from '../fixtures/rom/mount-render.json';
import { ASSETS, stable } from './rom-helpers';
import { mkRound, placePx, ride, cx, cy } from './helpers';
import { riderHook } from '../../src/render/rom/mounts/rider';
import { mountRomSprites } from '../../src/render/rom/mounts/sprites';
import { fallbackMountFrame, objPx } from '../../src/render/rom/mounts/gfx';
import { MOUNT_GFX, MOUNTING_ANIMS, DANCE_NOTE_TICKS } from '../../src/render/rom/mounts/facts';
import { cellOf } from '../../src/core/units';
import type { ObjEntry } from '../../src/render/ppu';
import type { Anim, RomAssets } from '../../src/rom/types';

const sha1 = (b: Uint8Array) => createHash('sha1').update(b).digest('hex');
const DIRS = ['up', 'right', 'down', 'left'] as const;
const FACE = { up: 0, right: 2, down: 4, left: 6 } as const;
type FxPiece = { dx: number; dy: number; size: number; hflip: boolean; vflip: boolean; pxSha1: string };
type FxSample = { anim: number; frame: number; anim2?: number; frame2?: number; pieces: FxPiece[] };
const norm = (ps: FxPiece[]) => ps.map(p => `${p.dx},${p.dy},${p.size},${+p.hflip},${+p.vflip},${p.pxSha1}`).sort();
function facts(es: ObjEntry[], X: number, Y: number) {
  return norm(es.map(e => ({ dx: e.x - X, dy: e.y - Y, size: e.size, hflip: e.hflip, vflip: e.vflip, pxSha1: sha1((e.src as { px: Uint8Array }).px) })));
}

describe.skipIf(!ASSETS)('camada ROM das montarias × emulador', () => {
  for (const t of ['2', '3', 'a', 'c', 'd', 'e', 'f']) for (const d of DIRS) {
    it(`montado tipo ${t} parado olhando ${d} = OAM medida`, () => {
      const s = mkRound();
      const p = placePx(s, 0, cx(7), cy(5));
      p.face = FACE[d]; p.act = 'idle'; p.actT0 = s.tick; p.moveDir = 8;
      ride(s, 0, parseInt(t, 16));
      const exp = (fx.riders as Record<string, Record<string, { idle: { pieces: FxPiece[] }[] }>>)[t][d].idle.at(-1)!.pieces;
      const got = riderHook(s, p, ASSETS!, s.tick)!;
      expect(got).not.toBeNull();
      expect(facts(got, cx(7), cy(5))).toEqual(norm(exp));
    });
  }
  it('andando: a sequência de quadros distintos (amostras estáveis) bate com a medida (tipo 3, direita)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(7), cy(5));
    p.face = 2; p.act = 'walk'; p.actT0 = s.tick; p.moveDir = 2;
    ride(s, 0, 0x3);
    const seq: string[] = [];
    for (let i = 0; i < 24; i++) { const k = facts(riderHook(s, p, ASSETS!, s.tick)!, cx(7), cy(5)).join('|'); if (seq.at(-1) !== k) seq.push(k); s.tick++; }
    const exp: string[] = [];
    for (const smp of stable(fx.riders['3'].right.walk as FxSample[])) { const k = norm(smp.pieces as FxPiece[]).join('|'); if (exp.at(-1) !== k) exp.push(k); }
    expect(seq).toEqual(exp);
  });
  it('ovo no chão: peças medidas em st_ride_pre', () => {
    const g = fx.eggs[0];
    const s = mkRound();
    s.grid[5 * 17 + 7] = 0x0970 | (g.id & 0xf);
    const got = mountRomSprites(s, ASSETS!, s.tick).map(x => x.e);
    expect(facts(got, 16 * 7, 16 * (5 + 2))).toEqual(norm(g.samples[0].pieces as FxPiece[]));
  });
  it('sem montaria, sem traje: o gancho não troca o jogador', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(7), cy(5));
    expect(riderHook(s, p, ASSETS!, s.tick)).toBeNull();
  });

  // Fix round 2: Plano B (facts.ts marca MOUNT_GFX[type].format === 'unknown') — nenhum dos 7 tipos medidos está
  // nesse caso hoje, então fabricamos uma entrada sintética para exercitar o ramo sem depender de dados reais.
  it('Plano B: format "unknown" desenha o jogador normal e a montaria pelo fallback (mountPix)', () => {
    const type = 0x2, original = MOUNT_GFX[type];
    (MOUNT_GFX as Record<number, { src: number; format: 'zte' | 'raw' | 'unknown' }>)[type] = { src: original.src, format: 'unknown' };
    try {
      const s = mkRound();
      const p = placePx(s, 0, cx(7), cy(5));
      p.face = 4; p.act = 'idle'; p.actT0 = s.tick; p.moveDir = 8;
      const r = ride(s, 0, type);
      const got = riderHook(s, p, ASSETS!, s.tick)!;
      expect(got).not.toBeNull();
      expect(got).toHaveLength(2);
      const X = cx(7), Y = cy(5);
      const charEntry = got.find(e => e.size === 32 && e.pal === 0)!;
      expect(charEntry).toBeDefined();   // peça do personagem: continua vindo da ROM, sem mudança
      const mountEntry = got.find(e => e !== charEntry)!;
      const { px } = fallbackMountFrame(type, 4, 0);
      expect(sha1((mountEntry.src as { px: Uint8Array }).px)).toBe(sha1(px));
      expect(mountEntry.pal).toBe(1 + r.slot);
      expect(mountEntry.size).toBe(32);
      expect(mountEntry.x - X).toBe(-16);
      expect(mountEntry.y - Y).toBe(-18);
    } finally {
      (MOUNT_GFX as Record<number, unknown>)[type] = original;
    }
  });

  // Fix round 2: nenhuma tabela medida hoje empacota mais de 1 peça por quadro (ver relatório da T14), então
  // fabricamos um `RomAssets.anim` sintético para exercitar o roteamento de peça extra (tile absoluto >= 256 →
  // objCommon, paleta 7) sem depender de dados reais.
  it('peça extra (tile absoluto >= 256) de uma tabela de personagem sai por objCommon, paleta 7', () => {
    const FAKE_ADDR = 0x123456;
    const fakeFrames: Anim = [{
      dur: 255, mx: 0, my: 0,
      pieces: [
        { dx: -16, dy: -24, tile: 22, hflip: false, vflip: false, big: true, palAdd: 0 },     // personagem (g=22)
        { dx: -8, dy: -8, tile: 256 + 44, hflip: false, vflip: false, big: false, palAdd: 0 }, // extra: objCommon 44
      ],
    }];
    const fakeAssets: RomAssets = { ...ASSETS!, anim: (addr: number) => (addr === FAKE_ADDR ? fakeFrames : ASSETS!.anim(addr)) };
    const type = 0x2, original = MOUNTING_ANIMS[type];
    MOUNTING_ANIMS[type] = [FAKE_ADDR];
    try {
      const s = mkRound();
      const p = placePx(s, 0, cx(7), cy(5));
      const r = ride(s, 0, type, { phase: 'mounting', t0: s.tick });
      const got = riderHook(s, p, fakeAssets, s.tick)!;
      expect(got).not.toBeNull();
      const X = cx(7), Y = cy(5);
      const charPiece = got.find(e => e.pal !== 7)!;
      const extraPiece = got.find(e => e.pal === 7)!;
      expect(charPiece).toBeDefined();
      expect(extraPiece).toBeDefined();
      expect(charPiece.x - X).toBe(-16); expect(charPiece.y - Y).toBe(-24); expect(charPiece.size).toBe(32);
      expect(extraPiece.x - X).toBe(-8); expect(extraPiece.y - Y).toBe(-8); expect(extraPiece.size).toBe(16);
      expect(extraPiece.pal).toBe(7);
      expect(sha1((extraPiece.src as { px: Uint8Array }).px)).toBe(sha1(objPx(ASSETS!.arena(s.stage).objCommon, 0, 44, 16)));
      void r;
    } finally {
      MOUNTING_ANIMS[type] = original;
    }
  });

  // T14b: notas da dança (mont. F) — objeto OAM independente, medido em fx.danceNote (não peça de DANCE_ANIMS).
  // Só nos ticks "estáveis" (mesma anim/quadro do tick anterior): na troca, a VRAM ainda mostra o gráfico
  // anterior por 1 tick (atraso de DMA, T4/T14) — um RomPlayerHook puro não reproduz esse atraso (sem memória
  // do tick anterior), então comparamos onde a fixture já mostra o gráfico "definitivo" do quadro.
  it('T14b: notas da dança (mont. F) batem com o objeto medido, nos ticks estáveis', () => {
    const s = mkRound();
    const p = placePx(s, 1, 72, 47);   // mesma posição de P2 medida (fx.danceNote é relativo a ela)
    p.face = 2; p.act = 'dance'; p.actT0 = s.tick; p.moveDir = 8;
    const raw = (fx.danceNote as unknown as FxSample[]).map((smp, i) => ({ ...smp, i }));
    let n = 0;
    for (const smp of stable(raw.slice(0, DANCE_NOTE_TICKS))) {
      const got = riderHook(s, p, ASSETS!, s.tick + smp.i)!;
      const notes = got.filter(e => e.pal === 7);
      expect(facts(notes, 72, 47), `t=${smp.i}`).toEqual(norm(smp.pieces as FxPiece[]));
      n++;
    }
    expect(n).toBeGreaterThan(20);
    const after = riderHook(s, p, ASSETS!, s.tick + DANCE_NOTE_TICKS)!;
    expect(after.filter(e => e.pal === 7)).toHaveLength(0);   // depois do fim medido, sem notas
  });

  // T14b: "ovo brilhando → explosão → montaria" do remonte — o próprio objeto do ovo reserva (não nasce outro),
  // medido em fx.remountGlow (cenário do brief: tipo 3 com reserva tipo 2, acerto direto na rotina $C2:105E).
  // Mesma ressalva do atraso de DMA acima: só nos ticks estáveis.
  it('T14b: ovo brilhando/explosão/montaria do remonte bate com o objeto medido, nos ticks estáveis', () => {
    const s = mkRound();
    const p = placePx(s, 0, 63, 47);   // mesma posição de P1 medida (col 4, lin 1: 16·4−1=63, 16·(1+2)−1=47)
    p.face = 2; p.moveDir = 8;
    const ownCell = cellOf(4, 1), originCell = cellOf(3, 1);   // origem: 1 casa atrás (col 3), mesma linha
    ride(s, 0, 2, { phase: 'dismount', remount: true, t0: s.tick, reserves: [], trail: [ownCell, originCell] });
    const raw = (fx.remountGlow as unknown as (FxSample & { x: number; y: number })[]).map((smp, i) => ({ ...smp, i }));
    let n = 0;
    for (const smp of stable(raw)) {
      const got = riderHook(s, p, ASSETS!, s.tick + smp.i)!;
      const glow = got.filter(e => e.pal === 7);
      expect(facts(glow, smp.x, smp.y), `t=${smp.i}`).toEqual(norm(smp.pieces as FxPiece[]));
      n++;
    }
    expect(n).toBeGreaterThan(40);
  });
});
