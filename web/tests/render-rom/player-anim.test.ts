import { BORED_AFTER, animAddr, playerAnimRef, resolveAnim } from '../../src/render/anim/player-anim';
import { animCycle, sampleAnim } from '../../src/render/anim/sample';
import type { PlayerAct } from '../../src/core';
import { ASSETS } from './rom-fixture';

const FACES = [0, 2, 4, 6] as const;
const pose = (act: PlayerAct, face = 4, char = 0, moving = false) => ({ act, face, char, moving });
const hex = (n: number) => n.toString(16);

describe('ação → tabela (sem ROM)', () => {
  it('parado e andando: $C2:76C5 com [8,9,12,13] e [0,1,4,5]', () => {
    expect(FACES.map(f => playerAnimRef(pose('idle', f), 0).ref)).toEqual([8, 9, 12, 13].map(idx => ({ tab: 0xc276c5, idx })));
    expect(FACES.map(f => playerAnimRef(pose('walk', f), 0).ref)).toEqual([0, 1, 4, 5].map(idx => ({ tab: 0xc276c5, idx })));
  });
  it('tédio depois de 383 ticks parado: $C2:6F71 [4 + char], tempo contado a partir do 383', () => {
    expect(playerAnimRef(pose('idle', 4, 0), BORED_AFTER - 1).ref).toEqual({ tab: 0xc276c5, idx: 12 });
    expect(playerAnimRef(pose('idle', 4, 0), BORED_AFTER + 10)).toEqual({ ref: { tab: 0xc26f71, idx: 4 }, t: 10 });
  });
  it('vilões (personagens 1 a 5): sem tédio próprio e o P na pose de andar (extra)', () => {
    for (let c = 1; c < 6; c++) {
      expect(playerAnimRef(pose('idle', 4, c), BORED_AFTER + 10).ref).toEqual({ tab: 0xc276c5, idx: 12 });
      expect(playerAnimRef(pose('pPunch', 2, c), 0).ref).toEqual({ tab: 0xc276c5, idx: 1 });
    }
  });
  it('luva, soco e P pelas tabelas da §7.4', () => {
    expect(playerAnimRef(pose('lift', 2), 0).ref).toEqual({ tab: 0xc27515, idx: 1 });
    expect(playerAnimRef(pose('carryIdle', 6), 0).ref).toEqual({ tab: 0xc27665, idx: 13 });
    expect(playerAnimRef(pose('carryWalk', 0), 0).ref).toEqual({ tab: 0xc27665, idx: 0 });
    expect(playerAnimRef(pose('throw', 4), 0).ref).toEqual({ tab: 0xc2755d, idx: 4 });
    expect(playerAnimRef(pose('punch', 6), 0).ref).toEqual({ tab: 0xc2746d, idx: 5 });
    expect(playerAnimRef(pose('pPunch', 2), 0).ref).toEqual({ tab: 0xc2749d, idx: 1 });
  });
  it('diretas (morte, vitória) e de índice fixo (B, choque, atordoado)', () => {
    expect(playerAnimRef(pose('dying'), 3)).toEqual({ ref: { tab: 0xc26e15, idx: null }, t: 3 });
    expect(playerAnimRef(pose('victory'), 3).ref).toEqual({ tab: 0xc26f05, idx: null });
    expect(playerAnimRef(pose('detonate', 0), 0).ref).toEqual({ tab: 0xc26ce8, idx: 12 });
    expect(playerAnimRef(pose('shocked', 6), 0).ref).toEqual({ tab: 0xc26ce8, idx: 4 });
    expect(playerAnimRef(pose('stunned', 2), 0).ref).toEqual({ tab: 0xc26f71, idx: 10 });
  });
  it('provisórios (D14): lançado, empurrado e dança por face/2; Bad Bomber; montando sem tédio', () => {
    expect(FACES.map(f => playerAnimRef(pose('launched', f), 0).ref)).toEqual([0, 1, 2, 3].map(idx => ({ tab: 0xc26f35, idx })));
    expect(playerAnimRef(pose('pushed', 6), 0).ref).toEqual({ tab: 0xc26ce8, idx: 3 });
    expect(playerAnimRef(pose('dance', 2), 0).ref).toEqual({ tab: 0xc26fc5, idx: 1 });
    expect(playerAnimRef(pose('bad', 2, 0, true), 0).ref).toEqual({ tab: 0xc276c5, idx: 1 });
    expect(playerAnimRef(pose('mounting', 4), 500).ref).toEqual({ tab: 0xc276c5, idx: 12 });
    expect(playerAnimRef(pose('dismount', 0), 500).ref).toEqual({ tab: 0xc276c5, idx: 8 });
  });
});

describe.skipIf(!ASSETS)('ação × direção → animação da ROM (§7.4)', () => {
  const A = () => ASSETS!;
  const addrs = (act: PlayerAct, c: number) => FACES.map(f => animAddr(A().rom, playerAnimRef(pose(act, f, 0), 0).ref, c));
  const same = (a: number) => [a, a, a, a];
  const EXPECT: [PlayerAct, number[]][] = [
    ['idle', [0xd8165a, 0xd81653, 0xd81645, 0xd8164c]],
    ['walk', [0xd816ac, 0xd81693, 0xd81661, 0xd8167a]],
    ['lift', [0xd81dd2, 0xd81db9, 0xd81d87, 0xd81da0]],
    ['carryIdle', [0xd8208c, 0xd82085, 0xd82077, 0xd8207e]],
    ['carryWalk', [0xd820de, 0xd820c5, 0xd82093, 0xd820ac]],
    ['throw', [0xd81f48, 0xd81f41, 0xd81f33, 0xd81f3a]],
    ['punch', [0xd8205e, 0xd82045, 0xd82013, 0xd8202c]],
    ['pPunch', [0xd82adf, 0xd82ad8, 0xd82aca, 0xd82ad1]],
    ['detonate', same(0xd82aa7)], ['stunned', same(0xd819b2)], ['shocked', same(0xd82a9a)],
    ['dying', same(0xd81999)], ['victory', same(0xd82a74)],
    ['launched', [0xd80a1e, 0xd809c9, 0xd8091f, 0xd80974]],
    ['pushed', [0xd82a00, 0xd829f3, 0xd829d9, 0xd829e6]],
    ['dance', [0xd81d44, 0xd81d01, 0xd81c7b, 0xd81cbe]],
  ];
  for (const [act, list] of EXPECT) it(`${act}: mesmos endereços nos 6 personagens`, () => {
    for (let c = 0; c < 6; c++) expect(addrs(act, c).map(hex)).toEqual(list.map(hex));
  });
  it('tédio por personagem ($C2:6F71 [4 + char])', () => {
    const got = [0, 1, 2, 3, 4, 5].map(c => animAddr(A().rom, { tab: 0xc26f71, idx: 4 + c }, c));   // tabela da ROM (o jogo só usa a do Blanco)
    expect(got.map(hex)).toEqual([0xd82a0d, 0xd8023d, 0xd802e0, 0xd80335, 0xd803fc, 0xd8046f].map(hex));
  });
  const first = (act: PlayerAct) => FACES.map(f => sampleAnim(resolveAnim(A(), playerAnimRef(pose(act, f), 0).ref, 0), 0).frame.pieces[0].tile);
  it('1º quadro (g) por ação × ↑→↓←', () => {
    expect(first('idle')).toEqual([0, 3, 6, 9]);
    expect(first('walk')).toEqual([1, 4, 7, 10]);
    expect(first('lift')).toEqual([32, 35, 38, 41]);
    expect(first('carryIdle')).toEqual([32, 35, 38, 41]);
    expect(first('carryWalk')).toEqual([33, 36, 39, 42]);
    expect(first('throw')).toEqual([28, 29, 30, 31]);
    expect(first('punch')).toEqual([12, 13, 14, 15]);
    expect(first('pPunch')).toEqual([60, 61, 62, 63]);
    expect(first('detonate')).toEqual([47, 47, 47, 47]);
    expect(first('dying')).toEqual([24, 24, 24, 24]);
    expect(first('victory')).toEqual([45, 45, 45, 45]);
  });
  const seq = (act: PlayerAct, f: number) => resolveAnim(A(), playerAnimRef(pose(act, f), 0).ref, 0).map(x => `g${x.pieces[0].tile}:${x.dur}`);
  it('sequências literais da ANI', () => {
    expect(seq('walk', 2)).toEqual(['g4:12', 'g3:8', 'g5:12', 'g3:8']);
    expect(seq('walk', 4)).toEqual(['g7:12', 'g6:8', 'g8:12', 'g6:8']);
    expect(seq('dying', 4)).toEqual(['g24:5', 'g25:5', 'g26:6', 'g27:6']);
    expect(seq('victory', 4)).toEqual(['g45:12', 'g46:12']);
    expect(seq('stunned', 4)).toEqual(['g0:4', 'g3:4', 'g6:4', 'g9:4']);
    expect(seq('detonate', 4)).toEqual(['g47:255']);
    expect(animCycle(resolveAnim(A(), { tab: 0xc26e15, idx: null }, 0))).toBe(22);
  });
  it('peça padrão do jogador: (−16, −24), 32×32', () => {
    const p = resolveAnim(A(), playerAnimRef(pose('walk', 4), 0).ref, 0)[0].pieces[0];
    expect([p.dx, p.dy, p.big, p.palAdd]).toEqual([-16, -24, true, 0]);
  });
});
