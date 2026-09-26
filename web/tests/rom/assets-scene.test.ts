import { ROM, fixture, sha1Hex, u16le } from './helpers';
import { RomView } from '../../src/rom/view';
import { loadScene, loadMode7Draw, audioSlices, segmentBytes } from '../../src/rom/assets-scene';
import { SCENES } from '../../src/rom/catalog';
import { decodeZte } from '../../src/rom/decode/zte';
import { SCENE_IDS, type SceneId } from '../../src/rom/types';

interface Fx { scenes: { id: SceneId; segments: { vramByte: number; bytes: number; sha1: string }[]; written: number;
  vramSha1: string; cgramSha1: string; cgramLinesEqualCapture: number }[] }

describe('catálogo das telas (sem ROM)', () => {
  it('tem as 11 telas, com 16 linhas de CGRAM cada', () => {
    expect(Object.keys(SCENES).sort()).toEqual([...SCENE_IDS].sort());
    for (const id of SCENE_IDS) expect(SCENES[id].cgram).toHaveLength(16);
  });
  it('contagem de segmentos por tela = catalogo.json', () => {
    expect(SCENE_IDS.map(id => SCENES[id].vram.length)).toEqual([32, 21, 22, 21, 20, 25, 25, 24, 55, 22, 22]);
  });
});

describe.skipIf(!ROM)('telas montadas da ROM (gfx-scenes.json)', () => {
  const fx = fixture<Fx>('gfx-scenes.json');
  const view = new RomView(ROM ?? new Uint8Array(0));
  const cache = new Map<number, Uint8Array>();
  const zte = (a: number) => { let d = cache.get(a); if (!d) { d = decodeZte(view.data, a).data; cache.set(a, d); } return d; };
  for (const e of fx.scenes) it(e.id, () => {
    expect(e.cgramLinesEqualCapture).toBe(16);
    const s = loadScene(view, e.id, zte);
    const segs = SCENES[e.id].vram.map(g => ({ vramByte: g.vramByte, bytes: g.bytes, sha1: sha1Hex(segmentBytes(view, g, zte)) }));
    expect(segs).toEqual(e.segments);
    expect(s.written.reduce((n, v) => n + v, 0)).toBe(e.written);
    expect(sha1Hex(s.vram)).toBe(e.vramSha1);
    expect(sha1Hex(u16le(s.cgram))).toBe(e.cgramSha1);
    expect([s.bgTiles.count, s.bg3Tiles.count, s.objTiles.count]).toEqual([1024, 512, 512]);
  });
  it('Modo 7 do DRAW GAME separado em chr e map', () => {
    const m = loadMode7Draw(view);
    expect([m.chr.length, m.map.length]).toEqual([16384, 16384]);
  });
  it('fatias do áudio [AUD §1.1]', () => {
    const a = audioSlices(view);
    expect([a.cpu.base, a.cpu.bytes.length, a.data.base, a.data.bytes.length]).toEqual([0xc00190, 0x65a, 0xd90000, 0x59c94]);
  });
});
