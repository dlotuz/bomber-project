import { AudioImage, C0_END, C0_START, DATA_END, DATA_START, slicesFromRom } from '../../src/audio/host/image';
import { SpcHost, runSync, CPU_SLACK, HostTimeout } from '../../src/audio/host/host';
import { FakeDriver } from './fake-driver';
import { synthImage } from './gen/synth-image';

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

function setup() {
  const si = synthImage();
  const drv = new FakeDriver();
  const host = new SpcHost(new AudioImage(si.slices), drv);
  return { si, drv, host };
}

describe('AudioImage', () => {
  it('lê as duas fatias por endereço SNES e recusa o resto', () => {
    const rom = new Uint8Array(0x400000);
    rom[0x0190] = 0x11; rom[0x07ea] = 0x22; rom[0x190000] = 0x33; rom[0x1e9c94] = 0x44;
    const img = new AudioImage(slicesFromRom(rom));
    expect(img.u8(C0_START)).toBe(0x11);
    expect(img.u8(0xc007ea)).toBe(0x22);
    expect(img.u8(DATA_START)).toBe(0x33);
    expect(img.u8(0xde9c94)).toBe(0x44);
    expect(() => img.u8(C0_END)).toThrow(RangeError);
    expect(() => img.u8(DATA_END)).toThrow(RangeError);
    expect(() => img.u8(0xc00000)).toThrow(RangeError);
    expect(img.slices.c0.length + img.slices.data.length).toBe(1627 + 367765);
  });
});

describe('SpcHost contra o driver falso', () => {
  it('boot sobe $31, $2E e $2F e deixa os bytes certos na RAM', () => {
    const { si, drv, host } = setup();
    runSync(drv, host.boot());
    for (const id of [0x31, 0x2e, 0x2f]) for (const [d, b] of si.blocks[id]) expect(same(drv.ram.subarray(d, d + b.length), b)).toBe(true);
    expect(drv.mode).toBe('driver');
    expect(host.driverUp).toBe(true);
  });

  it('música: STOP ($13, $93) antes do loader ($10), depois bloco, samples e comando', () => {
    const { si, drv, host } = setup();
    runSync(drv, host.boot());
    const n = drv.port1.length;
    runSync(drv, host.music(0x14));
    expect(drv.port1.slice(n, n + 3)).toEqual([0x13, 0x93, 0x10]);
    for (const [d, b] of si.blocks[0x14]) expect(same(drv.ram.subarray(d, d + b.length), b)).toBe(true);
    expect(same(drv.ram.subarray(0x5378, 0x5378 + 20), si.set13.list[0][1])).toBe(true);
    let a = 0x7c00;
    for (const s of si.set13.samples) { expect(same(drv.ram.subarray(a, a + s.length), s)).toBe(true); a += s.length; }
    expect(drv.cmds).toEqual([0x01]);
  });

  it('banco: STOP antes do bloco', () => {
    const { si, drv, host } = setup();
    runSync(drv, host.boot());
    const n = drv.port1.length;
    runSync(drv, host.bank(0x30));
    expect(drv.port1.slice(n, n + 3)).toEqual([0x13, 0x93, 0x10]);
    for (const [d, b] of si.blocks[0x30]) expect(same(drv.ram.subarray(d, d + b.length), b)).toBe(true);
  });

  it('SFX sai no NMI como $32 + id, um por NMI (o pendente é sobrescrito, como no spchost)', () => {
    const { drv, host } = setup();
    runSync(drv, host.boot());
    host.sfx(0x07); runSync(drv, host.nmi());
    host.sfx(0x0c); host.sfx(0x08); runSync(drv, host.nmi());
    runSync(drv, host.nmi());
    expect(drv.cmds).toEqual([0x39, 0x3a]);
  });

  it('voz: $32, pedaços no orçamento 4/1/1/1, comando $63 + id; outra voz é ignorada enquanto a 1ª não termina', () => {
    const { si, drv, host } = setup();
    runSync(drv, host.boot());
    expect(host.voice(0x10)).toBe(true);
    expect(host.voice(0x06)).toBe(false);
    const perFrame: number[] = [];
    for (let f = 0; f < 8; f++) { const c = drv.streamChunks; runSync(drv, host.nmi()); perFrame.push(drv.streamChunks - c); }
    // bloco $29: 4 + 4 + 301 bytes → pedaços de ≤ 64 bytes: 1 + 1 + 5 = 7
    expect(perFrame).toEqual([4, 1, 1, 1, 0, 0, 0, 0]);
    expect(drv.cmds).toEqual([0x32, 0x73]);
    for (const [d, b] of si.blocks[0x29]) expect(same(drv.ram.subarray(d, d + b.length), b)).toBe(true);
    expect(host.voice(0x06)).toBe(true);
  });

  it('STOP zera SFX e voz pendentes; FADE manda $18 com velocidade $7F', () => {
    const { drv, host } = setup();
    runSync(drv, host.boot());
    host.sfx(1); host.voice(0x10);
    runSync(drv, host.stop());
    expect([host.e2, host.e3, host.e9, host.ea]).toEqual([0, 0, 0, 0]);
    runSync(drv, host.fade());
    expect(drv.port1.at(-1)).toBe(0x18);
    expect(drv.cpuIn[2]).toBe(0x7f);
  });

  it('regras de robustez: espera $AA/$AA antes do loader e folga depois do kick', () => {
    const { drv, host } = setup();
    runSync(drv, host.boot());
    drv.out[2] = 0;                                     // driver "ocupado"
    const op = host.bank(0x2f);
    let steps = 0;
    for (const n of op) { drv.run(n); if (++steps === 50) { drv.out[2] = 0xaa; drv.out[3] = 0xaa; } }
    expect(steps).toBeGreaterThan(50);
    expect(CPU_SLACK).toBe(64);
  });

  it('driver mudo estoura o limite com HostTimeout', () => {
    const si = synthImage();
    const dead = { readPort: () => 0, writePort: () => {}, run: () => {} };
    const host = new SpcHost(new AudioImage(si.slices), dead);
    expect(() => runSync(dead, host.boot())).toThrow(HostTimeout);
  });
});
