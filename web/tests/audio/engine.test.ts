import { AudioEngine, MAX_RECOVERIES, SFX_FIFO } from '../../src/audio/engine/engine';
import { SampleRing } from '../../src/audio/engine/ring';
import { AudioImage } from '../../src/audio/host/image';
import { FRAME_CYCLES } from '../../src/audio/host/host';
import { FakeApu } from './fake-apu';
import { synthImage } from './gen/synth-image';

function setup() {
  const ring = new SampleRing(4096);
  const apu = new FakeApu(ring);
  const eng = new AudioEngine(new AudioImage(synthImage().slices), apu, ring);
  const L = new Float32Array(128), R = new Float32Array(128);
  const render = (blocks: number) => { for (let i = 0; i < blocks; i++) eng.render(L, R, 128); };
  return { ring, apu, eng, L, R, render };
}

describe('AudioEngine (tempo real)', () => {
  it('entrega exatamente os quadros pedidos e avança 32 ciclos por quadro', () => {
    const { apu, eng, L, render } = setup();
    render(250);                                   // 32.000 quadros = 1 s
    expect(eng.stats.frames).toBe(32000);
    expect(Math.abs(apu.drv.cycles - 1_024_000)).toBeLessThan(64);
    expect(L[0]).toBeCloseTo(1000 / 32768, 6);
  });

  it('sem boot não roda NMI nem comandos; SFX antes do boot é descartado', () => {
    const { apu, eng, render } = setup();
    eng.post({ t: 'sfx', id: 3 });
    eng.post({ t: 'music', id: 0x14 });
    render(100);
    expect(apu.drv.cmds).toEqual([]);
    expect(eng.stats.nmis).toBe(0);
  });

  it('boot e música rodam em fila; depois o NMI roda a 60 Hz', () => {
    const { apu, eng, render } = setup();
    eng.post({ t: 'boot' }); eng.post({ t: 'music', id: 0x14 });
    render(50);
    expect(apu.drv.cmds).toEqual([0x01]);
    const n0 = eng.stats.nmis;
    render(250);                                   // +1 s
    expect(Math.abs(eng.stats.nmis - n0 - 1_024_000 / FRAME_CYCLES)).toBeLessThanOrEqual(1);
  });

  it('5 SFX no mesmo instante saem 1 por NMI, em ordem', () => {
    const { apu, eng, render } = setup();
    eng.post({ t: 'boot' });
    render(50);
    for (const id of [7, 8, 9, 10, 11]) eng.post({ t: 'sfx', id });
    const perNmi: number[] = [];
    let last = eng.stats.nmis;
    for (let i = 0; i < 200 && perNmi.length < 6; i++) {
      render(1);
      if (eng.stats.nmis !== last) { perNmi.push(apu.drv.cmds.length); last = eng.stats.nmis; }
    }
    expect(apu.drv.cmds).toEqual([0x39, 0x3a, 0x3b, 0x3c, 0x3d]);
    expect(perNmi.slice(0, 6)).toEqual([1, 2, 3, 4, 5, 5]);
  });

  it('fila de SFX limitada a 64', () => {
    const { eng, render } = setup();
    eng.post({ t: 'boot' });
    render(50);
    for (let i = 0; i < SFX_FIFO + 3; i++) eng.post({ t: 'sfx', id: 1 });
    expect(eng.stats.droppedSfx).toBe(3);
  });

  it('voz com outra em andamento é ignorada e contada', () => {
    const { apu, eng, render } = setup();
    eng.post({ t: 'boot' });
    render(50);
    eng.post({ t: 'voice', id: 0x10 });
    eng.post({ t: 'voice', id: 0x06 });
    render(200);
    expect(eng.stats.ignoredVoices).toBe(1);
    expect(apu.drv.cmds).toEqual([0x32, 0x73]);
  });

  it('host morto de vez: tenta religar MAX_RECOVERIES vezes e só então fica mudo, sem exceção para fora', () => {
    const ring = new SampleRing(4096);
    let acc = 0;
    const dead = { readPort: () => 0, writePort: () => {}, run: (c: number) => { acc += c; while (acc >= 32) { acc -= 32; ring.push(1, 1); } } };
    const eng = new AudioEngine(new AudioImage(synthImage().slices), dead, ring);
    eng.post({ t: 'boot' });
    const L = new Float32Array(128), R = new Float32Array(128);
    expect(() => { for (let i = 0; i < 20000 && !eng.broken; i++) eng.render(L, R, 128); }).not.toThrow();
    expect(eng.broken).toBe(true);
    expect(eng.stats.errors).toBe(MAX_RECOVERIES + 1);
    eng.render(L, R, 128);
    expect(L.every(v => v === 0)).toBe(true);
  });

  it('erro do host: religa o APU, refaz o boot e repete o último banco e a última música', () => {
    const { apu, eng, render } = setup();
    eng.post({ t: 'boot' }); eng.post({ t: 'bank', id: 0x30 });
    render(50);
    apu.deaf = true;                                   // o driver para de responder
    eng.post({ t: 'music', id: 0x14 });
    render(500);                                       // ≈ 2 s: estoura (~1 s) e recupera
    expect(eng.stats.errors).toBe(1);
    expect(eng.broken).toBe(false);
    expect(apu.powers).toBe(1);
    expect(apu.drv.uploads.some(u => u.dest === 0x3100 && u.len === 33)).toBe(true);   // banco $30 de novo
    expect(apu.drv.cmds).toEqual([0x01]);             // música $14 de novo
    eng.post({ t: 'sfx', id: 7 });
    render(20);
    expect(apu.drv.cmds).toEqual([0x01, 0x39]);
  });

  it('banco pedido durante o stream de uma voz espera o stream acabar (I1)', () => {
    const { apu, eng, render } = setup();
    eng.post({ t: 'boot' });
    render(50);
    eng.post({ t: 'voice', id: 0x10 });
    while (!eng.host.streaming) render(1);             // o stream sintético dura 2 frames: o banco chega no meio
    expect(eng.host.streaming).toBe(true);
    const n = apu.drv.port1.length;
    eng.post({ t: 'bank', id: 0x2f });
    let stopWhileStreaming = false;
    for (let i = 0; i < 400; i++) {
      render(1);
      if (eng.host.streaming && apu.drv.port1.slice(n).includes(0x13)) stopWhileStreaming = true;
    }
    expect(stopWhileStreaming).toBe(false);
    expect(apu.drv.port1.slice(n)).toContain(0x13);    // o STOP do banco saiu depois do stream
    expect(eng.stats.errors).toBe(0);
    expect(apu.drv.cmds).toEqual([0x32, 0x73]);        // o stream terminou e a voz tocou
    eng.post({ t: 'voice', id: 0x06 });                // a voz seguinte é aceita e toca
    render(200);
    expect(eng.stats.ignoredVoices).toBe(0);
    expect(apu.drv.cmds).toEqual([0x32, 0x73, 0x32, 0x69]);
  });
});
