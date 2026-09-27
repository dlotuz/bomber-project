import { Apu } from '../../src/audio/apu/apu';
import { WorkletCore } from '../../src/audio/worklet-core';
import { slicesFromRom } from '../../src/audio/host/image';
import type { AudioCmd } from '../../src/audio/engine/commands';
import { ROM } from './rom';

/** Motor real (WorkletCore a 32 kHz + Apu) com a ROM: operações que chegam durante o stream de uma voz (I1). */
function setup() {
  const core = new WorkletCore(32000, ring => new Apu(ring), () => {});
  const { c0, data } = slicesFromRom(ROM!);
  core.onMessage({ t: 'image', c0, data });
  const L = new Float32Array(128), R = new Float32Array(128);
  const send = (c: AudioCmd) => core.onMessage(c);
  /** Renderiza ≈ `frames` frames de 60 Hz (533,3 quadros cada) e devolve o pico de |amostra|. */
  const run = (frames: number): number => {
    let peak = 0;
    for (let n = Math.round((frames * 32000) / 60 / 128); n > 0; n--) {
      core.process(L, R, 128);
      for (let i = 0; i < 128; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    }
    return peak;
  };
  return { core, send, run, eng: () => core.engine! };
}

describe.skipIf(!ROM)('motor real: banco/música durante o stream de uma voz (I1)', () => {
  for (const n of [20, 28, 30]) {
    it(`voz $0E e, ${n} frames depois, banco $2F + música $14: o som volta e a voz seguinte toca`, () => {
      const { send, run, eng } = setup();
      send({ t: 'boot' }); send({ t: 'bank', id: 0x30 }); send({ t: 'music', id: 0x18 });
      run(150);
      send({ t: 'voice', id: 0x0e });
      run(n);
      send({ t: 'bank', id: 0x2f }); send({ t: 'music', id: 0x14 });
      run(150);
      const e = eng();
      expect(e.broken).toBe(false);
      expect(e.stats.errors).toBe(0);
      expect(run(60)).toBeGreaterThan(0.01);                // a música $14 toca
      const ignored = e.stats.ignoredVoices;
      send({ t: 'voice', id: 0x06 });                        // voz do banco $2F
      let streamed = false;
      for (let f = 0; f < 60 && !streamed; f++) { run(1); streamed = e.host.streaming; }
      expect(e.stats.ignoredVoices).toBe(ignored);
      expect(streamed).toBe(true);
      run(90);
      expect(e.host.streaming).toBe(false);
      expect(e.stats.errors).toBe(0);
    }, 60_000);
  }
});
