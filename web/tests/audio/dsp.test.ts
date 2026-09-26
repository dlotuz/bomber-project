import { SpcDsp } from '../../src/audio/apu/dsp/spc-dsp';
import { dspScenes } from './gen/inputs';
import { fixture, sha1 } from './node';

function render(sc: ReturnType<typeof dspScenes>[number]): Int16Array {
  const out: number[] = [];
  const dsp = new SpcDsp(sc.ram.slice(), { push: (l, r) => { out.push(l, r); } });
  dsp.reset();
  let now = 0;
  for (const w of sc.writes) {
    if (w.clock > now) dsp.run(w.clock - now);
    now = w.clock;
    dsp.write(w.reg, w.value);
  }
  if (sc.totalClocks > now) dsp.run(sc.totalClocks - now);
  return new Int16Array(out);
}

describe('DSP (porte do SPC_DSP): PCM bit a bit igual à referência', () => {
  const fx = fixture<{ scenes: Record<string, { frames: number; sha1: string; first: number[] }> }>('audio-dsp.json');
  for (const sc of dspScenes()) {
    it(sc.name, () => {
      const pcm = render(sc);
      const want = fx.scenes[sc.name];
      expect(pcm.length / 2).toBe(want.frames);
      const nz = pcm.findIndex(v => v !== 0);
      expect(Array.from(pcm.subarray(nz, nz + 8))).toEqual(want.first);
      expect(sha1(new Uint8Array(pcm.buffer))).toBe(want.sha1);
    });
  }
});

describe('DSP: registradores', () => {
  it('reset: a leitura devolve os valores iniciais do snes9x (initial_regs)', () => {
    const dsp = new SpcDsp(new Uint8Array(0x10000), { push() {} });
    dsp.reset();
    expect([dsp.read(0x00), dsp.read(0x01), dsp.read(0x0f)]).toEqual([0x45, 0x8b, 0x80]);
  });
  it('qualquer escrita em ENDX zera o registrador; KON guarda o valor', () => {
    const dsp = new SpcDsp(new Uint8Array(0x10000), { push() {} });
    dsp.reset();
    dsp.write(0x7c, 0xff);
    // snes9x: a escrita vai para external_regs como veio; o ENDX interno é zerado e só chega à
    // leitura no próximo V7 (voice_V7 grava REG(endx) e XREG(endx)).
    expect(dsp.read(0x7c)).toBe(0xff);
    dsp.run(32);
    expect(dsp.read(0x7c)).toBe(0);
    dsp.write(0x4c, 0x81);
    expect(dsp.read(0x4c)).toBe(0x81);
  });
  it('32 ciclos = 1 quadro', () => {
    let n = 0;
    const dsp = new SpcDsp(new Uint8Array(0x10000), { push: () => { n++; } });
    dsp.reset();
    dsp.run(32 * 100);
    expect(n).toBe(100);
    dsp.run(16); dsp.run(16);
    expect(n).toBe(101);
  });
});
