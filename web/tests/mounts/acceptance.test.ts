import { cpuRound, createMatch, finishRound, startRound, rulesWith } from './sim';
import { placePx, ride, run, cx, cy } from './helpers';
import { hashState } from '../../src/core/hash';
import { rider } from '../../src/core/mounts/types';
import { mkRound } from './helpers';
import { ASSETS } from './rom-helpers';
import { buildBattleFrame } from '../../src/render/rom/battle';
import { romPlayerHooks, fallbackLayers, fallbackOverLayers } from '../../src/render/battle-layers';
import { MOUNT_FRONT_ROW } from '../../src/render/fallback/mounts/layer';
import { drawRound } from '../../src/render/draw-game';
import { createView, updateView } from '../../src/render/view';
import type { ObjEntry } from '../../src/render/ppu';
import type { SpriteBank } from '../../src/render/sprite-bank';
import type { RoundState } from '../../src/core/types';

describe('aceite do plano 9', () => {
  it('fases 1, 2, 3, 6 e 7: ovos aparecem, teto de 2 nunca é passado, rodadas terminam', () => {
    let revealed = 0, mounted = 0;
    for (const stage of [1, 2, 3, 6, 7]) for (const seed of [1, 2, 3, 4]) {
      const r = cpuRound(stage, seed);
      expect(r.maxActive, `fase ${stage} semente ${seed}`).toBeLessThanOrEqual(2);
      expect(r.s.phase, `fase ${stage} semente ${seed}`).toBe('over');
      revealed += r.events.filter(e => (e.type === 'mount' && e.id === 'egg_revealed')).length;
      mounted += r.events.filter(e => (e.type === 'mount' && e.id === 'mount_ready')).length;
    }
    expect(revealed).toBeGreaterThan(0);
    expect(mounted).toBeGreaterThan(0);
   }, 120_000);
  it('fases 4, 5, 8, 9, 10: nenhum ovo', () => {
    for (const stage of [4, 5, 8, 9, 10]) {
      const r = cpuRound(stage, 1);
      expect(r.events.some(e => (e.type === 'mount' && e.id === 'egg_revealed')), `fase ${stage}`).toBe(false);
    }
   }, 120_000);
  it('fase 8: ovos do caça-níquel (plano 8) respeitam o teto de 2 contando as reservas', () => {
    // sementes 24 e 25 passavam para 3 (montado com 1 reserva + 1 ovo do caça-níquel) antes de `eggsInPlay` contar reservas;
    // desde a revisão final `eggsInPlay` é `activeCount` (fonte única do $1ED4)
    for (const seed of [24, 25]) expect(cpuRound(8, seed).maxActive, `semente ${seed}`).toBeLessThanOrEqual(2);
  }, 120_000);
  it('determinismo: mesma semente → mesmo hash, com montarias', () => {
    const a = cpuRound(1, 7), b = cpuRound(1, 7);
    expect(hashState(a.s)).toBe(hashState(b.s));
   }, 120_000);
  it('montaria zerada na rodada seguinte', () => {
    const m = createMatch(rulesWith([true, true, false, false, false]), 1, 3);
    const s = startRound(m);
    s.phase = 'play';
    placePx(s, 0, cx(2), cy(1)); ride(s, 0, 0x3, { reserves: [2] });
    s.players[1].state = 'out';
    run(s, 200);
    finishRound(m, s);
    const s2 = startRound(m);
    expect(s2.players.every(p => rider(p) === null)).toBe(true);
    expect(s2.mountState ?? null).toBeNull();
  });
});

const VIS = { crowns: [0, 0, 0, 0, 0] };
/** Entradas OAM (topo-esquerda da peça) a até 48 px de (X, Y). */
const near = (oam: ObjEntry[], X: number, Y: number) => oam.filter(e => Math.abs(e.x - X) <= 48 && Math.abs(e.y - Y) <= 48);
const key = (es: ObjEntry[]) => es.map(e => `${e.x},${e.y},${e.pal},${(e.src as { px?: Uint8Array }).px?.join('') ?? ''}`).join('|');
function mountedRound(): RoundState {
  const s = mkRound();
  const p = placePx(s, 0, cx(7), cy(5));
  p.face = 2; p.act = 'walk'; p.actT0 = s.tick; p.moveDir = 2;
  ride(s, 0, 0x3);
  s.players[1].state = 'out';
  return s;
}

describe.skipIf(!ASSETS)('integração com o desenhista ROM do plano 7', () => {
  it('drawRomBattle consulta romPlayerHooks: gancho que devolve [] tira o jogador montado do quadro', () => {
    const s = mountedRound();
    const before = near(buildBattleFrame(s, VIS, ASSETS!, 0).oam, cx(7), cy(5));
    expect(before.length).toBeGreaterThanOrEqual(2);                 // cavaleiro + montaria (riderHook)
    const spy = vi.fn((_s: RoundState, p: { slot: number }) => (p.slot === 0 ? [] : null));
    romPlayerHooks.unshift(spy);
    try {
      const after = near(buildBattleFrame(s, VIS, ASSETS!, 0).oam, cx(7), cy(5));
      expect(spy).toHaveBeenCalled();
      expect(after).toHaveLength(0);
    } finally { romPlayerHooks.splice(romPlayerHooks.indexOf(spy), 1); }
  });
  it('a animação montada anda com o tick do core (visualTick), não com o quadro do host', () => {
    const s = mountedRound();
    const seen = new Set<string>();
    for (let k = 0; k < 32; k++) { seen.add(key(near(buildBattleFrame(s, VIS, ASSETS!, 0).oam, cx(7), cy(5)))); s.tick++; }
    expect(seen.size).toBeGreaterThan(1);
  });
  it('TIME UP congela o desenho do montado (visualTick), mesmo com o quadro do host andando', () => {
    const s = mountedRound();
    s.tick += 5;
    s.phase = 'timeUp'; s.phaseT0 = s.tick;
    const seen = new Set<string>();
    for (let k = 0; k < 32; k++) { seen.add(key(near(buildBattleFrame(s, VIS, ASSETS!, 1000 + k).oam, cx(7), cy(5)))); s.tick++; }
    expect(seen.size).toBe(1);
  });
});

describe('fallback: a montaria cobre a metade de baixo do cavaleiro', () => {
  it('montaria inteira antes do jogador; parte da frente (camada over) depois dele', () => {
    expect(fallbackLayers.map(l => l.id)).toContain('mounts');
    expect(fallbackOverLayers.map(l => l.id)).toContain('mounts-front');
    // canvas falso: pixToCanvas só precisa de createElement/getContext/putImageData e de ImageData
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) });
    vi.stubGlobal('ImageData', class { constructor(public data: unknown, public width: number, public height: number) {} });
    try {
      const s = mountedRound();
      const view = createView(); updateView(view, s, []);
      const img = (w: number, h: number) => ({ width: w, height: h });
      const bank = {
        bomber: () => img(16, 20), head: () => img(16, 16), bomb: () => img(16, 16), item: () => img(16, 16),
        flame: () => img(16, 16), clock: () => img(16, 16),
        text: () => img(10, 12), plainText: () => img(10, 10),
        tiles: () => ({ floor: img(16, 16), floorAlt: img(16, 16), hard: img(16, 16), wall: img(16, 16), soft: img(16, 16), burning: [img(16, 16), img(16, 16)], bg: '#000' }),
      } as unknown as SpriteBank;
      const order: string[] = [];
      const ctx = {
        fillStyle: '', globalAlpha: 1, fillRect() {},
        drawImage(im: { width: number; height: number }, ...a: number[]) {
          if (im.width === 24 && im.height === 20) order.push(a.length === 2 ? 'mount' : `front:${a[1]}`);
          else if (im.width === 16 && im.height === 20) order.push('player');
        },
      } as unknown as CanvasRenderingContext2D;
      drawRound(ctx, s, view, bank, [0, 1, 2, 3, 4], 0, [0, 0, 0, 0, 0]);
      const i = (k: string) => order.indexOf(k);
      expect(i('mount')).toBeGreaterThanOrEqual(0);
      expect(i('mount')).toBeLessThan(i('player'));
      expect(i(`front:${MOUNT_FRONT_ROW}`)).toBeGreaterThan(order.lastIndexOf('player'));
    } finally { vi.unstubAllGlobals(); }
  });
});
