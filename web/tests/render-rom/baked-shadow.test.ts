import { CHAR_SHADOW, COSTUME_SHADOW, MOUNT_SHADOW, stripBakedShadow, type ShadowFamily, type ShadowResult } from '../../src/render/rom/baked-shadow';
import { FrameBuilder } from '../../src/render/rom/builder';
import { PLAYER_OBJ_PAL, drawSprites } from '../../src/render/rom/sprites';
import { romTables } from '../../src/render/rom/tables';
import { newMemo, type RomScene } from '../../src/render/rom/scene';
import { playerAnimRef, resolveAnim } from '../../src/render/anim/player-anim';
import { piecePx } from '../../src/render/rom/mounts/gfx';
import { sheetFrame } from '../../src/rom/assets-char';
import {
  COSTUME_ANIMS, COSTUME_SHEETS, DANCE_ANIMS, DISMOUNT_ANIMS, MOUNT_ANIMS, MOUNTING_ANIMS, MOUNTING_MOUNT_ANIMS,
  REMOUNT_ANIMS, REMOUNT_MOUNT_ANIMS, RIDER_ANIMS, SHEET2,
} from '../../src/render/rom/mounts/facts';
import type { RoundState } from '../../src/core';
import type { RomAssets } from '../../src/rom/types';
import type { ObjEntry } from '../../src/render/ppu';
import { fakeAssets, fakeRound } from './fakes';
import { ASSETS } from './rom-fixture';

/** Quadro 32×32 a partir de linhas (índice em hexa; '.' = 0), começando na linha `top`. */
function frame(top: number, rows: string[]): Uint8Array {
  const f = new Uint8Array(1024);
  rows.forEach((r, i) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') f[(top + i) * 32 + x] = parseInt(r[x], 16); });
  return f;
}
const rowsOf = (f: Uint8Array, y0: number, y1: number) => {
  const out: string[] = [];
  for (let y = y0; y <= y1; y++) { let s = ''; for (let x = 0; x < 32; x++) s += f[y * 32 + x] ? f[y * 32 + x].toString(16) : '.'; out.push(s.replace(/\.+$/, '')); }
  return out;
};

/** Critério de aceite: nada fora da máscara muda; dentro dela só sai (vira 0) pixel da cor da sombra que não encosta
 *  em outra cor; a máscara fica nas linhas de baixo (no máximo a altura da elipse da família). */
function exact(src: Uint8Array, size: number, fam: ShadowFamily, r: ShadowResult, what: string): number {
  if (r.status !== 'stripped') { expect(r.px, what).toBe(src); return 0; }
  const m = r.mask!;
  let low = -1;
  for (let i = src.length - 1; i >= 0 && low < 0; i--) if (src[i]) low = Math.floor(i / size);
  const rows = Math.max(...fam.shapes.map(s => s.length));
  let removed = 0;
  for (let i = 0; i < src.length; i++) {
    const x = i % size, y = Math.floor(i / size);
    if (m[i]) expect(y > low - rows - 1 && y <= low, `${what}: máscara fora das linhas de baixo (${x},${y})`).toBe(true);
    if (src[i] === r.px[i]) continue;
    expect(m[i], `${what}: pixel (${x},${y}) mudou fora da máscara`).toBe(1);
    expect([src[i], r.px[i]], `${what}: (${x},${y})`).toEqual([fam.color, 0]);
    const nb = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => (x + dx < 0 || x + dx >= size || y + dy < 0 || y + dy >= size ? 0 : src[(y + dy) * size + x + dx]));
    expect(nb.every(v => v === 0 || v === fam.color), `${what}: (${x},${y}) encostava numa cor`).toBe(true);
    removed++;
  }
  return removed;
}

describe('elipse chapada do sprite da ROM (tirada quando a sombra suave dos efeitos está ligada)', () => {
  // Pés (cores 6/7/b/2/3 com contorno 1) sobre a elipse 9/13/15/13/9 dos personagens ($C2:0730, char 0 parado ↓).
  const FEET = frame(23, [
    '............12321',
    '............11111233',
    '..........1111111bbb111',
    '.........111111116776111',
    '..........1111111111111',
    '............111111111',
  ]);

  it('apaga só a elipse: a linha em que um pé passa da borda (e as de cima) fica igual; o contorno dos pés fica', () => {
    const r = stripBakedShadow(FEET, 32, CHAR_SHADOW);
    expect(r.status).toBe('stripped');
    expect(rowsOf(r.px, 23, 28)).toEqual([
      '............12321',
      '............11111233',
      '................1bbb1',
      '................167761',
      '.................1111',
      '',
    ]);
    expect(exact(FEET, 32, CHAR_SHADOW, r, 'FEET')).toBeGreaterThan(30);
  });

  it('quadro sem elipse (pés no chão, sentado na montaria) fica igual — o mesmo objeto', () => {
    const feetOnly = frame(26, ['............1771.1771', '............b771.177b', '.............11b.b11']);
    expect(stripBakedShadow(feetOnly, 32, CHAR_SHADOW)).toMatchObject({ status: 'none', px: feetOnly });
    const seated = frame(26, ['.........1776b.....b6771', '..........1671.....1761', '...........11.......11']);
    expect(stripBakedShadow(seated, 32, CHAR_SHADOW)).toMatchObject({ status: 'none', px: seated });
  });

  it('elipse que não encaixa (corpo cobrindo as bordas) fica como na ROM: `kept`', () => {
    const covered = frame(24, ['.......2222222222222222', '......2111111111111111112', '........111111111111111', '..........11111111111']);
    expect(stripBakedShadow(covered, 32, CHAR_SHADOW)).toMatchObject({ status: 'kept', px: covered });
  });

  it('em cache (mesmo objeto) e o original não muda', () => {
    const copy = Uint8Array.from(FEET);
    expect(stripBakedShadow(FEET, 32, CHAR_SHADOW)).toBe(stripBakedShadow(FEET, 32, CHAR_SHADOW));
    expect(FEET).toEqual(copy);
  });

  function run(s: RoundState, softShadows: boolean, a: RomAssets = fakeAssets(), hardShadows?: Set<number>) {
    const b = new FrameBuilder(new Uint16Array(1024), new Uint16Array(1024), new Uint16Array(256));
    const scene: RomScene = { gridBombs: new Map(), objs: [], drops: [], flame: () => 'center', burn: () => 'soft', team: false };
    drawSprites(b, { s, a, tb: romTables(a), scene, clock: { tick: s.tick, bombTick: s.tick, frame: 0 }, memo: newMemo(), tiles: a.arena(1).bgTiles, softShadows, hardShadows });
    return b.oam();
  }

  it('sem a sombra suave o desenho é o de sempre (fidelidade com fx=0)', () => {
    const a = fakeAssets();
    const plain = run(fakeRound(), false, a).filter(e => e.pal === PLAYER_OBJ_PAL[0]);
    expect(plain.length).toBe(1);
    expect((plain[0].src as { px: Uint8Array }).px).toBe(a.character(0).frame(12));
  });

  describe.skipIf(!ASSETS)('ROM real: todos os quadros', () => {
    const ACTS = ['idle', 'walk', 'lift', 'carryIdle', 'carryWalk', 'throw', 'punch', 'pPunch', 'detonate', 'shocked', 'stunned',
      'dying', 'victory', 'launched', 'held', 'pushed', 'dance', 'bad'] as const;
    const small = (px: Uint8Array) => Uint8Array.from({ length: 256 }, (_, i) => px[(i >> 4) * 32 + (i & 15)]);

    it('personagens (todas as ações, direções e quadros; cavaleiro, dança, desmonte): nada muda fora da elipse', () => {
      const a = ASSETS!;
      let stripped = 0, removed = 0;
      for (let char = 0; char < 6; char++) {
        const seen = new Set<Uint8Array>();
        const check = (what: string, pc: { tile: number; big: boolean }) => {
          const full = piecePx(a, pc as never, { role: 'char', char, stage: 1 });
          if (seen.has(full)) return;
          seen.add(full);
          const px = pc.big ? full : small(full), size = pc.big ? 32 : 16;
          const r = stripBakedShadow(px, size, CHAR_SHADOW);
          if (r.status === 'stripped') stripped++;
          removed += exact(px, size, CHAR_SHADOW, r, `char ${char} ${what} tile ${pc.tile}`);
        };
        for (const act of ACTS) for (const face of [0, 2, 4, 6]) for (const t of [0, 400]) {
          let anim; try { anim = resolveAnim(a, playerAnimRef({ act, face, char, moving: true }, t).ref, char); } catch { continue; }
          for (const fr of anim) for (const pc of fr.pieces) check(`${act}/${face}`, pc);
        }
        const extra = [...[0, 1, 2, 3].flatMap(d => [...RIDER_ANIMS[2][d].idle, ...RIDER_ANIMS[2][d].walk]), ...MOUNTING_ANIMS[2], ...DISMOUNT_ANIMS, ...REMOUNT_ANIMS, ...DANCE_ANIMS];
        for (const ad of extra) for (const fr of a.anim(ad)) for (const pc of fr.pieces) if (pc.tile < 256) check(`anim ${ad.toString(16)}`, pc);
      }
      expect(stripped).toBeGreaterThan(200);
      expect(removed).toBeGreaterThan(5000);
    });

    it('andando/parado em cada direção, nenhum personagem alterna entre tirar e manter a elipse (sem pisca)', () => {
      const a = ASSETS!;
      for (let char = 0; char < 6; char++) for (const act of ['idle', 'walk', 'carryIdle', 'carryWalk'] as const) for (const face of [0, 2, 4, 6]) for (const moving of [true, false]) {
        const anim = resolveAnim(a, playerAnimRef({ act, face, char, moving }, 0).ref, char);
        const st = anim.flatMap(fr => fr.pieces.map(pc => stripBakedShadow(a.character(char).frame(pc.tile), 32, CHAR_SHADOW).status));
        expect(st.filter(x => x === 'kept'), `char ${char} ${act} ${face}`).toEqual([]);
      }
    });

    it('montarias (todos os tipos, direções e quadros): nada muda fora da elipse; nenhuma mantém em andar/parado', () => {
      const a = ASSETS!;
      for (const type of Object.keys(MOUNT_ANIMS).map(Number)) {
        const fam = MOUNT_SHADOW[type];
        if (!fam) continue;   // tipo E: fica a da ROM
        const addrs = [...[0, 1, 2, 3].flatMap(d => [...MOUNT_ANIMS[type][d].idle, ...MOUNT_ANIMS[type][d].walk]), ...(MOUNTING_MOUNT_ANIMS[type] ?? []), ...REMOUNT_MOUNT_ANIMS];
        let stripped = 0;
        for (const ad of addrs) for (const fr of a.anim(ad)) for (const pc of fr.pieces) {
          if (pc.tile >= 256) continue;
          const full = piecePx(a, pc, { role: 'mount', type, stage: 1 });
          const px = pc.big ? full : small(full), size = pc.big ? 32 : 16;
          const r = stripBakedShadow(px, size, fam);
          expect(r.status, `montaria ${type} tile ${pc.tile}`).not.toBe('kept');
          if (r.status === 'stripped') stripped++;
          exact(px, size, fam, r, `montaria ${type} tile ${pc.tile}`);
        }
        expect(stripped, `montaria ${type}`).toBeGreaterThan(0);
      }
    });

    it('trajes: nada muda fora da elipse', () => {
      const a = ASSETS!;
      for (const c of [0, 1]) for (let d = 0; d < 4; d++) for (const k of ['idle', 'walk'] as const) for (const ad of COSTUME_ANIMS[c][d][k]) for (const fr of a.anim(ad)) for (const pc of fr.pieces) {
        const px = sheetFrame(a.rom, pc.tile & 0x100 ? SHEET2 : COSTUME_SHEETS[c], pc.tile & 0xff);
        exact(px, 32, COSTUME_SHADOW, stripBakedShadow(px, 32, COSTUME_SHADOW), `traje ${c} tile ${pc.tile}`);
      }
    });

    it('desenho com a sombra suave: o vivo sai sem a elipse; o que está morrendo fica como na ROM', () => {
      const a = ASSETS!;
      const s = fakeRound();
      s.players.forEach(p => { p.char = p.slot % 6; });
      const px = (e: ObjEntry) => (e.src as { px: Uint8Array }).px;
      const rom = run(s, false, a).filter(e => e.size === 32), hard = new Set<number>();
      const soft = run(s, true, a, hard).filter(e => e.size === 32);
      expect(rom.length).toBe(5);
      soft.forEach((e, i) => {
        const r = stripBakedShadow(px(rom[i]), 32, CHAR_SHADOW);
        expect(r.status).toBe('stripped');
        expect(px(e)).toBe(r.px);
      });
      expect([...hard]).toEqual([]);
      Object.assign(s.players[0], { act: 'dying', state: 'dying', actT0: s.tick });
      s.players.forEach((p, i) => { p.present = i === 0; });
      expect(run(s, true, a)).toEqual(run(s, false, a));
    });
  });
});
