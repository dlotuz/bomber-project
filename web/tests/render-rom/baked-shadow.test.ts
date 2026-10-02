import { stripBakedShadow } from '../../src/render/rom/baked-shadow';
import { FrameBuilder } from '../../src/render/rom/builder';
import { PLAYER_OBJ_PAL, drawSprites } from '../../src/render/rom/sprites';
import { romTables } from '../../src/render/rom/tables';
import { newMemo, type RomScene } from '../../src/render/rom/scene';
import { playerAnimRef, resolveAnim } from '../../src/render/anim/player-anim';
import { sampleAnim } from '../../src/render/anim/sample';
import { MOUNT_ANIMS } from '../../src/render/rom/mounts/facts';
import { piecePx } from '../../src/render/rom/mounts/gfx';
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
/** A elipse que sobra: pixels da cor da sombra (`k`: 1 nos personagens; $B na montaria tipo 3) abaixo da última
 *  linha com outra cor, menos os que ficam logo embaixo de uma cor (o contorno de baixo dos pés/da barriga). Num quadro
 *  da ROM com a sombra, são dezenas; sem ela, 0. */
function ellipse(px: Uint8Array, size: number, k = 1): number {
  const color = (v: number) => v !== 0 && v !== k;
  let last = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (color(px[y * size + x])) last = y;
  let n = 0;
  for (let y = last + 1; y < size; y++) for (let x = 0; x < size; x++) {
    if (px[y * size + x] === k && !(y === last + 1 && color(px[(y - 1) * size + x]))) n++;
  }
  return n;
}

describe('sombra chapada do sprite da ROM (tirada quando a sombra suave dos efeitos está ligada)', () => {
  // Pés (cores 6/7 com contorno 1) sobre a elipse preta de 5 linhas, como nos quadros do personagem ($C2:0730).
  const FEET = frame(23, [
    '............12321',
    '............11111233',
    '..........1111111bbb111',
    '.........111111116776111',
    '..........1111111111111',
    '............111111111',
  ]);

  it('apaga a elipse e mantém o contorno que encosta nas cores', () => {
    expect(rowsOf(stripBakedShadow(FEET, 32), 23, 28)).toEqual([
      '............12321',
      '.............1111233',
      '................1bbb1',
      '................167761',
      '.................1111',
      '',
    ]);
  });

  it('quadro sem sombra (última linha com cor, ou só pontas de contorno) fica igual — mesmo objeto', () => {
    const feetOnly = frame(26, ['............1771.1771', '............b771.177b', '.............11b.b11']);
    expect(stripBakedShadow(feetOnly, 32)).toBe(feetOnly);
    const seated = frame(26, ['.........1776b.....b6771', '..........1671.....1761', '...........11.......11']);
    expect(stripBakedShadow(seated, 32)).toBe(seated);
  });

  it('mesmo resultado em cache (mesmo objeto) e o original não muda', () => {
    const copy = Uint8Array.from(FEET);
    expect(stripBakedShadow(FEET, 32)).toBe(stripBakedShadow(FEET, 32));
    expect(FEET).toEqual(copy);
  });

  function run(s: RoundState, softShadows: boolean, a: RomAssets = fakeAssets()) {
    const b = new FrameBuilder(new Uint16Array(1024), new Uint16Array(1024), new Uint16Array(256));
    const scene: RomScene = { gridBombs: new Map(), objs: [], drops: [], flame: () => 'center', burn: () => 'soft', team: false };
    drawSprites(b, { s, a, tb: romTables(a), scene, clock: { tick: s.tick, bombTick: s.tick, frame: 0 }, memo: newMemo(), tiles: a.arena(1).bgTiles, softShadows });
    return b.oam();
  }

  it('sem a sombra suave o desenho é o de sempre (fidelidade com fx=0)', () => {
    const s = fakeRound();
    expect(run(s, false)).toEqual(run(s, false));
    const a = fakeAssets();
    const ch = a.character(0);
    const plain = run(s, false, a).filter(e => e.pal === PLAYER_OBJ_PAL[0]);
    expect(plain.length).toBe(1);
    expect((plain[0].src as { px: Uint8Array }).px).toBe(ch.frame(12));
  });

  describe.skipIf(!ASSETS)('ROM real', () => {
    const acts = ['idle', 'walk', 'lift', 'carryIdle', 'carryWalk', 'throw', 'punch', 'detonate', 'held'] as const;

    it('jogador vivo: em todo quadro de pé/andando dos 6 personagens a elipse preta some (só fica o contorno)', () => {
      const a = ASSETS!;
      let frames = 0;
      for (let char = 0; char < 6; char++) for (const act of acts) for (const face of [0, 2, 4, 6]) {
        const anim = resolveAnim(a, playerAnimRef({ act, face, char, moving: true }, 0).ref, char);
        for (let t = 0; t < 64; t += 4) for (const pc of sampleAnim(anim, t).frame.pieces) {
          if (!pc.big) continue;
          const f = a.character(char).frame(pc.tile);
          if (ellipse(f, 32) < 5) continue;   // quadro sem a elipse
          frames++;
          expect(ellipse(stripBakedShadow(f, 32), 32), `char ${char} ${act} face ${face} tile ${pc.tile}`).toBe(0);
        }
      }
      expect(frames).toBeGreaterThan(50);
    });

    it('montaria (todos os tipos, direções e passos): a elipse dela também some', () => {
      const a = ASSETS!;
      const seen = new Set<number>();
      for (const type of Object.keys(MOUNT_ANIMS).map(Number)) for (let d = 0; d < 4; d++) {
        for (const addr of [...MOUNT_ANIMS[type][d].idle, ...MOUNT_ANIMS[type][d].walk]) for (const fr of a.anim(addr)) for (const pc of fr.pieces) {
          if (!pc.big) continue;
          const f = piecePx(a, pc, { role: 'mount', type, stage: 1 });
          // cor da sombra = a mais comum na última linha (preto na paleta de cada tipo: 1; $B no 3; 4 no 4/5/C; 5 no B)
          const k = ({ 3: 0xb, 4: 4, 5: 4, 0xb: 5, 0xc: 4 } as Record<number, number>)[type] ?? 1;
          if (ellipse(f, 32, k) < 5) continue;
          seen.add(type);
          expect(ellipse(stripBakedShadow(f, 32), 32, k), `montaria ${type} dir ${d} tile ${pc.tile}`).toBe(0);
        }
      }
      expect([...seen].sort((x, y) => x - y)).toEqual(Object.keys(MOUNT_ANIMS).map(Number).sort((x, y) => x - y));   // todos têm a elipse
    });

    it('desenho com a sombra suave: o vivo sai sem a elipse; o que está morrendo fica como na ROM', () => {
      const a = ASSETS!;
      const s = fakeRound();
      s.players.forEach(p => { p.char = p.slot % 6; });
      const px = (e: ObjEntry) => (e.src as { px: Uint8Array }).px;
      const rom = run(s, false, a).filter(e => e.size === 32), soft = run(s, true, a).filter(e => e.size === 32);
      expect(rom.length).toBe(5);
      expect(rom.every(e => ellipse(px(e), 32) >= 10)).toBe(true);   // a ROM desenha a sombra no sprite
      expect(soft.map(e => ellipse(px(e), 32))).toEqual([0, 0, 0, 0, 0]);
      Object.assign(s.players[0], { act: 'dying', state: 'dying', actT0: s.tick });
      s.players.forEach((p, i) => { p.present = i === 0; });
      expect(run(s, true, a)).toEqual(run(s, false, a));
    });
  });
});
