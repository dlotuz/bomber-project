import { Smp, type DspBus } from '../../src/audio/apu/smp';
import { IPL_ROM } from '../../src/audio/apu/ipl';
import { CASES_PER_OP, PROG_STEPS, progTimers, smpCaseImage, smpCases } from './gen/inputs';
import { fixture, sha1 } from './node';
import { runProg, type ProgResult } from './prog';

/** DSP de mentira: guarda registradores (o SMP só precisa de read/write/run nestes testes). */
function stubDsp(): DspBus {
  const regs = new Uint8Array(128);
  return { run() {}, read: a => regs[a & 0x7f], write: (a, v) => { regs[a & 0x7f] = v; } };
}
const makeSmp = () => new Smp(new Uint8Array(0x10000), stubDsp());
const hex = (n: number, w: number) => n.toString(16).toUpperCase().padStart(w, '0');

describe('SMP: estado do power-on e IPL', () => {
  it('registradores, IPL mapeado em $FFC0 e RAM zerada', () => {
    const s = makeSmp();
    s.ram.fill(0x77);
    s.power();
    expect([s.pc, s.a, s.x, s.y, s.sp, s.psw, s.iplEnabled, s.cycles]).toEqual([0xffc0, 0, 0, 0, 0xef, 0x02, true, 0]);
    expect(s.ram.every(v => v === 0)).toBe(true);
    expect(IPL_ROM).toHaveLength(64);
    expect(Array.from(IPL_ROM.subarray(0, 4))).toEqual([0xcd, 0xef, 0xbd, 0xe8]);
    expect(Array.from(IPL_ROM.subarray(60))).toEqual([0x00, 0x00, 0xc0, 0xff]);   // vetor de reset = $FFC0
  });
  it('o IPL sozinho escreve $AA/$BB nas portas e espera o $CC', () => {
    const s = makeSmp();
    s.power();
    s.run(3000);                     // zera a página 0 (≈ 2.390 ciclos) e publica $AA/$BB
    expect([s.readPort(0), s.readPort(1)]).toEqual([0xaa, 0xbb]);
    expect(s.pc).toBeGreaterThanOrEqual(0xffcf);
    expect(s.pc).toBeLessThanOrEqual(0xffd3);
  });
});

describe('SMP: padrão de barramento de cada opcode = referência', () => {
  const fx = fixture<{ psw00: string[]; pswFF: string[] }>('audio-smp-bus.json');
  for (const [psw, lines] of [[0x00, fx.psw00], [0xff, fx.pswFF]] as const) {
    it(`PSW $${hex(psw, 2)}`, () => {
      const got: string[] = [];
      const s = makeSmp();
      for (let op = 0; op < 256; op++) {
        if (op === 0xef || op === 0xff) continue;
        s.power(); s.iplEnabled = false;
        const R = s.ram;
        R.fill(0x55, 0x200);
        for (let i = 0; i < 0xf0; i++) R[i] = 0x30 + (i & 0x0f);
        R[0x40] = 0x34; R[0x41] = 0x12; R[0x50] = 0x78; R[0x51] = 0x56;
        R[0x400] = op; R[0x401] = 0x40; R[0x402] = 0x12;
        s.pc = 0x400; s.x = 0x10; s.y = 0x20; s.a = 0x05; s.sp = 0xef; s.psw = psw;
        let pat = '';
        s.onBus = (k, addr) => { pat += k === 3 ? ' i' : ` ${k === 1 ? 'r' : 'w'}${hex(addr, 4)}`; };
        const c0 = s.cycles;
        s.step();
        s.onBus = null;
        got.push(`${hex(op, 2)} ${String(s.cycles - c0).padStart(2)}${pat}`);
      }
      expect(got).toEqual(lines);
    });
  }
});

describe('SMP: 4.064 casos de 1 instrução = referência (registradores, flags, ciclos, barramento)', () => {
  it('todos os opcodes', () => {
    const fx = fixture<{ total: number; perOp: Record<string, string> }>('audio-smp-cases.json');
    const img = smpCaseImage();
    const cases = smpCases();
    expect(cases.length).toBe(fx.total);
    const s = makeSmp();
    const bad: string[] = [];
    for (let i = 0; i < cases.length; i += CASES_PER_OP) {
      const rec = new Uint8Array(12 * CASES_PER_OP);
      for (let k = 0; k < CASES_PER_OP; k++) {
        const c = cases[i + k];
        s.power(); s.iplEnabled = false; s.ram.set(img);
        s.ram[c.pc] = c.op; s.ram[(c.pc + 1) & 0xffff] = c.b1; s.ram[(c.pc + 2) & 0xffff] = c.b2;
        s.pc = c.pc; s.a = c.a; s.x = c.x; s.y = c.y; s.sp = c.sp; s.psw = c.psw;
        let h = 0x811c9dc5;
        const fnv = (b: number) => { h = Math.imul(h ^ b, 16777619) >>> 0; };
        s.onBus = (kind, addr, data) => { fnv(kind); fnv(addr & 0xff); fnv(addr >> 8); fnv(data); };
        const c0 = s.cycles;
        s.step();
        s.onBus = null;
        rec.set([s.pc & 0xff, s.pc >> 8, s.a, s.x, s.y, s.sp, s.psw, s.cycles - c0,
          h & 0xff, (h >>> 8) & 0xff, (h >>> 16) & 0xff, h >>> 24], k * 12);
      }
      const key = hex(cases[i].op, 2);
      if (sha1(rec) !== fx.perOp[key]) bad.push(key);
    }
    expect(bad).toEqual([]);
  });
});

describe('SMP: programa de timers, leituras fantasmas e portas (200.000 ciclos)', () => {
  it('log de MMIO, RAM e registradores = referência', () => {
    const fx = fixture<{ steps: number; progs: Record<string, ProgResult> }>('audio-prog.json');
    const got = runProg(makeSmp(), progTimers(), PROG_STEPS);
    const want = fx.progs.timers;
    expect(got.regs).toEqual(want.regs);
    expect(got.mmioCount).toBe(want.mmioCount);
    expect(got.mmioSha1).toBe(want.mmioSha1);
    expect(got.ramSha1).toBe(want.ramSha1);
  });
});
