import { Apu } from '../../src/audio/apu/apu';
import { SpcHost, runSync, FRAME_CYCLES } from '../../src/audio/host/host';
import { AudioImage, slicesFromRom } from '../../src/audio/host/image';
import { ROM } from './rom';

describe.skipIf(!ROM)('desempenho do APU em TS', () => {
  it('3 s da música $14 emulados em menos de 1,5 s (≥ 2× o tempo real)', () => {
    const apu = new Apu({ push() {} });
    const host = new SpcHost(new AudioImage(slicesFromRom(ROM!)), apu);
    runSync(apu, host.boot()); runSync(apu, host.bank(0x2f)); runSync(apu, host.music(0x14));
    const t0 = performance.now();
    for (let f = 0; f < 180; f++) { apu.run(FRAME_CYCLES); runSync(apu, host.nmi()); }
    const ms = performance.now() - t0;
    console.log(`APU: 3 s de áudio em ${ms.toFixed(0)} ms (${(3000 / ms).toFixed(1)}× o tempo real)`);
    expect(ms).toBeLessThan(1500);
  }, 30_000);
});
