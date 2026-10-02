import { createHash } from 'node:crypto';
import { INTRO_TICKS, type Player, type RoundState } from '../../src/core';
import { hitPlayer } from '../../src/core/hit';
import { HUD_CRY_FROM, hudCrying, isPlayRefreshTick, nextPlayRefresh } from '../../src/render/hud-cry';
import { buildBattleFrame } from '../../src/render/rom/battle';
import { faceTileIds } from '../../src/render/rom/hud';
import { HUD_HEAD_SRC, hudHeadBuffer, hudHeadRaw } from '../../src/rom/assets-char';
import { RomView } from '../../src/rom/view';
import { decodeTiles } from '../../src/rom/decode/tiles';
import { fakeAssets } from './fakes';
import { newRound, stepN, toPlay } from './core-fixture';
import { ASSETS } from './rom-fixture';
import { ROM, fixture } from '../rom/helpers';

const sha1 = (b: Uint8Array) => createHash('sha1').update(b).digest('hex');
const VIS = { crowns: [0, 0, 0, 0, 0] };

/** Rodada da arena `stage` em jogo, no tick `h`, com o slot `slot` acertado nesse tick (hitT0 = h). */
function killedAt(stage: number, slot: number, h: number): RoundState {
  const s = newRound(stage);
  toPlay(s);
  stepN(s, h - s.tick);
  hitPlayer(s, s.players[slot], 'flame', []);
  expect(s.players[slot].hitT0).toBe(h);
  return s;
}
/** Avança até o tick `t` (sem entradas) e devolve se o rosto do slot está chorando. */
function cryingAt(s: RoundState, slot: number, t: number): boolean {
  stepN(s, t - s.tick);
  expect(s.tick).toBe(t);
  return hudCrying(s, s.players[slot]);
}

describe('rosto chorando no HUD: quando troca ($C4:52BC pelo relógio $C1:0AA6)', () => {
  it('a atualização do HUD em jogo cai nos ticks em que o relógio troca o segundo', () => {
    const s = newRound(1);
    toPlay(s);
    let seen = 0;
    for (let i = 0; i < 400; i++) {
      const sec = s.clock.sec;
      stepN(s, 1);
      expect(isPlayRefreshTick(s.tick)).toBe(s.clock.sec !== sec);
      if (s.clock.sec !== sec) seen++;
    }
    expect(seen).toBeGreaterThanOrEqual(6);
    expect(isPlayRefreshTick(INTRO_TICKS + 51)).toBe(true);
  });
  it('troca na 1ª atualização a partir de H+2 e não volta mais na rodada (pós-morte e fora de jogo)', () => {
    const r = nextPlayRefresh(200);
    for (const h of [r - 30, r - 2]) {
      const s = killedAt(1, 1, h);
      expect(cryingAt(s, 1, r - 1)).toBe(false);
      expect(cryingAt(s, 1, r)).toBe(true);
      expect(cryingAt(s, 1, h + 80)).toBe(true);
      expect(s.players[1].state).toBe('out');
    }
  });
  it('acerto em H = atualização − 1: o bit 3 de +$C0 ainda não subiu, fica para a seguinte (+60)', () => {
    const r = nextPlayRefresh(200);
    const s = killedAt(1, 1, r - 1);
    expect(HUD_CRY_FROM).toBe(2);
    expect(cryingAt(s, 1, r)).toBe(false);
    expect(cryingAt(s, 1, r + 59)).toBe(false);
    expect(cryingAt(s, 1, r + 60)).toBe(true);
  });
  it('vivo ou ausente nunca chora; os outros slots não mudam', () => {
    const s = killedAt(1, 1, nextPlayRefresh(200) - 10);
    stepN(s, 80);
    expect(s.players.map(p => hudCrying(s, p))).toEqual([false, true, false, false, false]);
    const off = { ...s.players[2], present: false, state: 'out', hitT0: 5 } as Player;
    expect(hudCrying(s, off)).toBe(false);
  });
  it('rodada ganha: o relógio para e a atualização passa a cada 32', () => {
    const p = { present: true, state: 'dying', hitT0: 1000 } as Player;
    const at = (tick: number, phase: RoundState['phase'], phaseT0 = 1002) => hudCrying({ tick, phase, phaseT0 } as RoundState, p);
    expect(nextPlayRefresh(1002)).toBeGreaterThan(1002);
    expect(at(1023, 'won')).toBe(false);
    expect(at(1024, 'won')).toBe(true);      // 1024 = 32·32
    expect(at(1023, 'timeUp')).toBe(false);
    expect(at(1024, 'timeUp')).toBe(true);
  });
});

describe('rosto chorando: caminho da ROM (assets falsos)', () => {
  it('slot morto usa hudCry nos tiles $201+2·slot a partir da troca; os outros seguem com hudHead', () => {
    const a = fakeAssets();
    const r = nextPlayRefresh(200);
    const s = killedAt(1, 1, r - 10);
    stepN(s, 9);
    const before = buildBattleFrame(s, VIS, a, 0, { layers: [], sprites: false }).bg1!.tiles.px;
    stepN(s, 1);
    const after = buildBattleFrame(s, VIS, a, 0, { layers: [], sprites: false }).bg1!.tiles.px;
    const t = faceTileIds(1);
    expect([before[t[0] * 64], before[t[5] * 64]]).toEqual([0x48, 0x4d]);
    expect([after[t[0] * 64], after[t[5] * 64]]).toEqual([0x88, 0x8d]);
    expect(after[faceTileIds(0)[0] * 64]).toBe(0x40);
    expect(after[faceTileIds(2)[0] * 64]).toBe(0x50);
  });
});

interface Fx {
  faces: { char: number; slot: number; normalSha1: string; crySha1: string }[];
  survivor: { char: number; slot: number; normalSha1: string };
  timing: { hitClockCall: number; refreshClockCalls: number[]; crySwapClockCall: number };
}

describe.skipIf(!ROM || !ASSETS)('rosto chorando: ROM real contra a VRAM capturada (hud-cry.json)', () => {
  const fx = fixture<Fx>('hud-cry.json');
  const view = new RomView(ROM ?? new Uint8Array(0));
  it('entrada c·5+slot de $C4:617F = os bytes que a ROM sobe ao morrer; (6+c)·5+slot = os de antes', () => {
    const buf = hudHeadBuffer(view);
    for (const f of fx.faces) {
      expect(sha1(hudHeadRaw(view, buf, f.char * 5 + f.slot))).toBe(f.crySha1);
      expect(sha1(hudHeadRaw(view, buf, (6 + f.char) * 5 + f.slot))).toBe(f.normalSha1);
      const ch = ASSETS!.character(f.char);
      expect(Array.from(ch.hudCry(f.slot).px)).toEqual(Array.from(decodeTiles(hudHeadRaw(view, buf, f.char * 5 + f.slot), 4).px));
      expect(ch.hudCry(f.slot)).toBe(ch.hudCry(f.slot));
    }
    expect(sha1(hudHeadRaw(view, buf, (6 + fx.survivor.char) * 5 + fx.survivor.slot))).toBe(fx.survivor.normalSha1);
    expect(view.u16(HUD_HEAD_SRC)).toBe(0x1140);
    expect(() => ASSETS!.character(0).hudCry(5)).toThrow(RangeError);
  });
  it('medida: troca na 1ª atualização (a cada 60) ≥ acerto+2', () => {
    const { hitClockCall: h, refreshClockCalls: rs, crySwapClockCall: swap } = fx.timing;
    expect(rs.slice(1).map((r, i) => r - rs[i])).toEqual([60, 60, 60]);
    expect(swap).toBe(rs.find(r => r >= h + HUD_CRY_FROM));
  });
  it('quadro da arena 5: os 6 tiles do slot 1 viram o rosto chorando do personagem 1 no tick da troca', () => {
    const r = nextPlayRefresh(200);
    const s = killedAt(5, 1, r - 20);
    const tilesAt = (t: number) => {
      stepN(s, t - s.tick);
      const px = buildBattleFrame(s, VIS, ASSETS!, 0, { layers: [] }).bg1!.tiles.px;
      return faceTileIds(1).map(id => sha1(px.subarray(id * 64, id * 64 + 64)));
    };
    const tiles6 = (t: { px: Uint8Array }) => [0, 1, 2, 3, 4, 5].map(i => sha1(t.px.subarray(i * 64, i * 64 + 64)));
    const ch = ASSETS!.character(1);
    expect(tilesAt(r - 1)).toEqual(tiles6(ch.hudHead(1)));
    expect(tilesAt(r)).toEqual(tiles6(ch.hudCry(1)));
    expect(tilesAt(r + 100)).toEqual(tiles6(ch.hudCry(1)));
  });
});
