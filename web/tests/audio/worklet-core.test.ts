import { WorkletCore } from '../../src/audio/worklet-core';
import type { WorkletOut } from '../../src/audio/engine/commands';
import { FakeApu } from './fake-apu';
import { synthImage } from './gen/synth-image';

function setup(rate: number) {
  const posted: WorkletOut[] = [];
  let apu: FakeApu | null = null;
  const core = new WorkletCore(rate, ring => (apu = new FakeApu(ring)), m => { posted.push(m); });
  return { core, posted, apu: () => apu! };
}

describe('WorkletCore', () => {
  it('antes da imagem: silêncio e comandos guardados; depois: ready e os comandos na ordem', () => {
    const { core, posted, apu } = setup(32000);
    const L = new Float32Array(128).fill(9), R = new Float32Array(128).fill(9);
    core.process(L, R, 128);
    expect(L.every(v => v === 0)).toBe(true);
    core.onMessage({ t: 'boot' });
    core.onMessage({ t: 'music', id: 0x14 });
    const { c0, data } = synthImage().slices;
    core.onMessage({ t: 'image', c0, data });
    expect(posted).toEqual([{ t: 'ready' }]);
    for (let i = 0; i < 50; i++) core.process(L, R, 128);
    expect(apu().drv.cmds).toEqual([0x01]);
    expect(L[0]).toBeCloseTo(1000 / 32768, 6);
  });
  it('a 48 kHz reamostra: 1 s de saída consome ≈ 1 s de APU e publica estatísticas', () => {
    const { core, posted, apu } = setup(48000);
    const { c0, data } = synthImage().slices;
    core.onMessage({ t: 'image', c0, data });
    const L = new Float32Array(128), R = new Float32Array(128);
    for (let i = 0; i < 375; i++) core.process(L, R, 128);
    expect(Math.abs(apu().drv.cycles - 1_024_000)).toBeLessThan(256 * 32);
    const stats = posted.filter(m => m.t === 'stats');
    expect(stats).toHaveLength(1);
    expect(L[127]).toBeCloseTo(1000 / 32768, 5);
  });
});
