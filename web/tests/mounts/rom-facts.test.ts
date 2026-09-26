import { createHash } from 'node:crypto';
import fx from '../fixtures/rom/mount-render.json';
import { ASSETS, ROM } from './rom-helpers';
import { sheetFrame } from '../../src/rom/assets-char';
import {
  RIDER_ANIMS, MOUNT_ANIMS, COSTUME_ANIMS, MOUNTING_ANIMS, MOUNTING_MOUNT_ANIMS, DISMOUNT_ANIMS, REMOUNT_ANIMS,
  REMOUNT_MOUNT_ANIMS, RESERVE_EGG_ANIMS, PROJ_ANIMS, DANCE_ANIMS, EGG_ANIMS, SHEET2, MOUNT_GFX, MOUNT_SHEET_TABLE,
  COSTUME_SHEETS, COSTUME_SHEET_TABLE,
} from '../../src/render/rom/mounts/facts';

const sha1 = (b: Uint8Array) => createHash('sha1').update(b).digest('hex');
const TYPES = [2, 3, 10, 12, 13, 14, 15];
const DIRS = ['up', 'right', 'down', 'left'] as const;
type FxPiece = { tile: number; size: number; pxSha1: string };
type FxSample = { anim: number; frame: number; anim2?: number; frame2?: number; sheet1?: number; pieces: FxPiece[] };
type FxDirs = Record<(typeof DIRS)[number], { walk: FxSample[]; idle: FxSample[] }>;
const riders = fx.riders as unknown as Record<string, FxDirs>;
const costumes = fx.costumes as unknown as Record<string, FxDirs>;
/** Amostras estáveis: mesma animação/quadro que a anterior. Na troca, a VRAM ainda mostra o gráfico anterior por 1 quadro
 *  (o DMA do novo quadro chega no quadro seguinte), então a troca não serve para conferir o gráfico. */
const stable = (ss: FxSample[]) => ss.filter((s, i) => i > 0 &&
  [s.anim, s.frame, s.anim2, s.frame2].join() === [ss[i - 1].anim, ss[i - 1].frame, ss[i - 1].anim2, ss[i - 1].frame2].join());

describe('fixture das montarias (sem ROM)', () => {
  it('só fatos: nenhuma chave de bytes crus', () => {
    const txt = JSON.stringify(fx);
    expect(txt).not.toMatch(/"(bytes|data|raw|pixels)"\s*:/);
    expect(fx.romSha1).toBe('38f4394986bd39fcbe32a722a3fe103ee6177d9b');
  });
  it('facts.ts cobre os 7 tipos, 4 direções e 8 trajes', () => {
    expect(Object.keys(RIDER_ANIMS).map(Number).sort((a, b) => a - b)).toEqual([2, 3, 10, 12, 13, 14, 15]);
    for (const t of Object.values(RIDER_ANIMS)) { expect(t).toHaveLength(4); for (const d of t) expect(d.idle.length).toBeGreaterThan(0); }
    expect(Object.keys(COSTUME_ANIMS)).toHaveLength(8);
    for (const k of Object.keys(MOUNTING_ANIMS)) expect(MOUNTING_ANIMS[Number(k)].length).toBeGreaterThan(0);
    expect(DISMOUNT_ANIMS.length).toBeGreaterThan(0);
    expect(PROJ_ANIMS.d.length * PROJ_ANIMS.e.length * PROJ_ANIMS.f.length).toBeGreaterThan(0);
    expect(DANCE_ANIMS.length).toBeGreaterThan(0);
    expect(EGG_ANIMS.length).toBeGreaterThan(0);
    expect(SHEET2).toBe(0xd40000);
  });
  it('montaria (+$38), remonte, reserva e folhas dos trajes medidos', () => {
    expect(Object.keys(MOUNT_ANIMS).map(Number).sort((a, b) => a - b)).toEqual(TYPES);
    for (const t of TYPES) {
      expect(MOUNT_ANIMS[t]).toHaveLength(4);
      for (const d of MOUNT_ANIMS[t]) expect(d.walk.length * d.idle.length).toBeGreaterThan(0);
      expect(MOUNTING_MOUNT_ANIMS[t].length).toBeGreaterThan(0);
      expect(MOUNT_GFX[t].format).toBe('raw');
    }
    expect(REMOUNT_ANIMS.length * REMOUNT_MOUNT_ANIMS.length * RESERVE_EGG_ANIMS.length).toBeGreaterThan(0);
    expect(Object.keys(COSTUME_SHEETS)).toHaveLength(8);
  });
});

describe.skipIf(!ASSETS)('fatos das montarias × ROM', () => {
  it('toda animação medida decodifica pelo formato da ANI §2.1', () => {
    const dirs = (x: Record<number, { walk: number[]; idle: number[] }[]>) => Object.values(x).flatMap(t => t.flatMap(d => [...d.walk, ...d.idle]));
    const all = [
      ...dirs(RIDER_ANIMS), ...dirs(MOUNT_ANIMS), ...dirs(COSTUME_ANIMS),
      ...Object.values(MOUNTING_ANIMS).flat(), ...Object.values(MOUNTING_MOUNT_ANIMS).flat(),
      ...DISMOUNT_ANIMS, ...REMOUNT_ANIMS, ...REMOUNT_MOUNT_ANIMS, ...RESERVE_EGG_ANIMS,
      ...DANCE_ANIMS, ...EGG_ANIMS, ...PROJ_ANIMS.d, ...PROJ_ANIMS.e, ...PROJ_ANIMS.f,
    ];
    for (const a of all) {
      const anim = ASSETS!.anim(a);
      expect(anim.length, a.toString(16)).toBeGreaterThan(0);
      for (const fr of anim) expect(fr.pieces.length).toBeGreaterThan(0);
    }
  });
  it('paletas medidas existem na ROM nos endereços gravados', () => {
    for (const p of fx.palettes) for (const a of p.romAddrs) {
      const b = ROM!.subarray(a - 0xc00000, a - 0xc00000 + 32);
      expect(sha1(b)).toBe(p.sha1);
    }
  });
  it('folhas: montaria = p24($C4:70DC + 3·tipo), traje = p24($C2:0718 + 3·traje)', () => {
    const rom = ASSETS!.rom;
    for (const t of TYPES) expect(MOUNT_GFX[t].src).toBe(rom.p24(MOUNT_SHEET_TABLE + 3 * t));
    for (let c = 0; c < 8; c++) expect(COSTUME_SHEETS[c]).toBe(rom.p24(COSTUME_SHEET_TABLE + 3 * c));
  });
  it('montado: peça do jogador = quadro de +$A0 pela anim +$08, peça da montaria = quadro de MOUNT_GFX pela anim +$38', () => {
    const rom = ASSETS!.rom;
    const g = (addr: number, frame: number) => ASSETS!.anim(addr)[frame].pieces[0].tile;
    let n = 0;
    for (const t of TYPES) for (const d of DIRS) for (const s of [...stable(riders[t.toString(16)][d].walk), ...stable(riders[t.toString(16)][d].idle)]) {
      const rider = s.pieces.find(p => p.tile === 0x000)!, mount = s.pieces.find(p => p.tile === 0x008)!;
      expect(rider.pxSha1).toBe(sha1(sheetFrame(rom, s.sheet1!, g(s.anim, s.frame))));
      expect(mount.pxSha1).toBe(sha1(sheetFrame(rom, MOUNT_GFX[t].src, g(s.anim2!, s.frame2!))));
      n++;
    }
    expect(n).toBeGreaterThan(700);
  });
  it('traje: peça do jogador = quadro de COSTUME_SHEETS[traje] pela anim de COSTUME_ANIMS', () => {
    const rom = ASSETS!.rom;
    let n = 0;
    for (let c = 0; c < 8; c++) for (const d of DIRS) for (const s of [...stable(costumes[String(c)][d].walk), ...stable(costumes[String(c)][d].idle)]) {
      const pc = s.pieces.find(p => p.tile === 0x000)!;
      expect(pc.pxSha1).toBe(sha1(sheetFrame(rom, COSTUME_SHEETS[c], ASSETS!.anim(s.anim)[s.frame].pieces[0].tile)));
      n++;
    }
    expect(n).toBeGreaterThan(700);
  });
});
