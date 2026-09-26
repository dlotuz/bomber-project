import { Apu } from '../../src/audio/apu/apu';
import { SpcHost } from '../../src/audio/host/host';
import { AudioImage, slicesFromRom } from '../../src/audio/host/image';
import { runScript } from '../../src/audio/host/script';
import { HOST_SCRIPTS } from './gen/host-scripts';
import { PROG_STEPS, progDsp } from './gen/inputs';
import { env, fixture, fs, mmioBytes, sha1 } from './node';
import { ROM, ROM_SHA1 } from './rom';
import { blockSegments, compareSegs, sampleSetSegments } from './blocks';
import { runProg, type ProgResult } from './prog';

interface HostFx {
  romSha1: string;
  hosts: Record<string, { script: string; ops: [string, number, number][]; pcmFrames: number; pcmSha1PerSecond: string[];
    apuramSha1: string; mmioCount: number; mmioSha1: string; mmioWindows: string[] }>;
}

/** Roda um roteiro no APU completo, com log de MMIO e PCM (só enquanto `rec`). */
function runHost(script: string) {
  const pcm: number[] = [];
  let rec = false;
  const apu = new Apu({ push: (l, r) => { if (rec) pcm.push(l, r); } });
  const log: number[] = [];
  apu.smp.onBus = (k, a, d, c) => { if (k !== 3 && (a & 0xfff0) === 0x00f0) log.push(c, k === 1 ? 0x72 : 0x77, a & 0xff, d); };
  const img = new AudioImage(slicesFromRom(ROM!));
  const ops = runScript(apu, new SpcHost(img, apu), script, on => { rec = on; });
  return { apu, img, ops, pcm: new Int16Array(pcm), mmio: mmioBytes(log) };
}

describe('APU + programa sintético do DSP (sem ROM)', () => {
  it('ENVX/OUTX/ENDX lidos pelo SMP e PCM = referência', () => {
    const fx = fixture<{ progs: Record<string, ProgResult & { pcmSha1: string }> }>('audio-prog.json');
    const pcm: number[] = [];
    const apu = new Apu({ push: (l, r) => { pcm.push(l, r); } });
    const got = runProg(apu.smp, progDsp(), PROG_STEPS);
    const want = fx.progs.dsp;
    expect(got.regs).toEqual(want.regs);
    expect(got.mmioSha1).toBe(want.mmioSha1);
    expect(got.ramSha1).toBe(want.ramSha1);
    expect(sha1(new Uint8Array(new Int16Array(pcm).buffer))).toBe(want.pcmSha1);
  });
});

describe.skipIf(!ROM)('host + APU com a ROM = referência (spctrace)', () => {
  const fx = fixture<HostFx>('audio-host.json');

  it('mesma ROM do fixture', () => { expect(sha1(ROM!)).toBe(ROM_SHA1); expect(fx.romSha1).toBe(ROM_SHA1); });

  it('RAM do APU depois de init; blk 2F; mus 14 = bytes da ROM (§10.2)', () => {
    const { apu, img } = runHost('init; blk 2F; mus 14');
    const r = (segs: [number, Uint8Array][]) => compareSegs(apu.ram, segs);
    expect(r(blockSegments(img, 0x31))).toEqual({ bytes: 10295, diffs: 0 });     // driver 10.075 + 220
    expect(r(blockSegments(img, 0x2e))).toEqual({ bytes: 5366, diffs: 0 });
    expect(r(blockSegments(img, 0x2f))).toEqual({ bytes: 4515, diffs: 0 });
    expect(r(blockSegments(img, 0x14))).toEqual({ bytes: 4064, diffs: 0 });
    const set = sampleSetSegments(img, 0x13);
    expect(r(set.list)).toEqual({ bytes: 144, diffs: 0 });
    expect(r(set.samples)).toEqual({ bytes: 31158, diffs: 0 });
  }, 60_000);

  for (const name of Object.keys(HOST_SCRIPTS)) {
    it(`roteiro "${name}": ciclos por operação, PCM, RAM e MMIO bit a bit`, () => {
      const want = fx.hosts[name];
      expect(want.script).toBe(HOST_SCRIPTS[name]);
      const got = runHost(want.script);
      const dump = env.AUDIO_DUMP;                 // depuração: grava as saídas do TS para comparar com o spctrace
      if (dump) {
        fs.writeFileSync(`${dump}/${name}.mmio.bin`, got.mmio);
        fs.writeFileSync(`${dump}/${name}.pcm.raw`, new Uint8Array(got.pcm.buffer));
      }
      const firstBadWindow = want.mmioWindows.findIndex((h, i) => sha1(got.mmio.subarray(i * 65536 * 8, (i + 1) * 65536 * 8)) !== h);
      expect(firstBadWindow, 'primeira janela de 65.536 acessos MMIO diferente').toBe(-1);
      expect(got.mmio.length / 8).toBe(want.mmioCount);
      expect(got.ops).toEqual(want.ops.map(([op, , cyc]) => [op, cyc]));
      expect(got.pcm.length / 2).toBe(want.pcmFrames);
      const pcmBytes = new Uint8Array(got.pcm.buffer);
      const perSecond = want.pcmSha1PerSecond.map((_, i) => sha1(pcmBytes.subarray(i * 128000, (i + 1) * 128000)));
      expect(perSecond).toEqual(want.pcmSha1PerSecond);     // "batalha"[0] = 1º segundo da $14 a partir do boot (§11)
      expect(sha1(got.apu.ram)).toBe(want.apuramSha1);
    }, 120_000);
  }
});
