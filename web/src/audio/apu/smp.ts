/**
 * SPC700 do SNES (S-SMP): CPU, timers, portas e IPL. Código do Crown Blast, escrito a partir da
 * documentação do hardware e validado ciclo a ciclo contra a referência (tests/audio/smp.test.ts).
 * Modelo de tempo: cada acesso ao barramento (leitura, escrita ou ciclo interno) é 1 ciclo; o ciclo
 * "anda" (timers, contador, DSP pendente) ANTES do acesso. Instruções são atômicas.
 */
import { IPL_ROM } from './ipl';
import { execute } from './smp-ops';

export interface DspBus { run(clocks: number): void; read(addr: number): number; write(addr: number, v: number): void }
export type BusKind = 1 | 2 | 3;

export const FLAG = { C: 0x01, Z: 0x02, I: 0x04, H: 0x08, B: 0x10, P: 0x20, V: 0x40, N: 0x80 } as const;
const TIMER_FREQ = [128, 128, 16];

export class Smp {
  readonly ram: Uint8Array;
  readonly cpuIn = new Uint8Array(4);          // CPU→SPC (escritas da CPU em $2140–3)
  private readonly dsp: DspBus;
  pc = 0xffc0; a = 0; x = 0; y = 0; sp = 0xef; psw = 0x02;
  iplEnabled = true;
  dspAddr = 0; f8 = 0; f9 = 0;
  private readonly tEnable = [false, false, false];
  private readonly tTarget = [0, 0, 0];
  private readonly tStage1 = [0, 0, 0];
  private readonly tStage2 = [0, 0, 0];
  private readonly tStage3 = [0, 0, 0];
  clock = 0;                                   // saldo: negativo = ciclos ainda a executar
  cycles = 0;                                  // ciclos desde o power()
  private dspPending = 0;
  onBus: ((kind: BusKind, addr: number, data: number, cycle: number) => void) | null = null;

  constructor(ram: Uint8Array, dsp: DspBus) { this.ram = ram; this.dsp = dsp; }

  power(): void {
    this.ram.fill(0); this.cpuIn.fill(0);
    this.pc = 0xffc0; this.a = 0; this.x = 0; this.y = 0; this.sp = 0xef; this.psw = 0x02;
    this.iplEnabled = true; this.dspAddr = 0; this.f8 = 0; this.f9 = 0;
    for (let t = 0; t < 3; t++) { this.tEnable[t] = false; this.tTarget[t] = 0; this.tStage1[t] = 0; this.tStage2[t] = 0; this.tStage3[t] = 0; }
    this.clock = 0; this.cycles = 0; this.dspPending = 0;
  }

  // ---- portas vistas pela CPU
  readPort(p: number): number { return this.ram[0xf4 + (p & 3)]; }
  writePort(p: number, v: number): void { this.cpuIn[p & 3] = v & 0xff; }

  // ---- execução
  run(cycles: number): void {
    this.clock -= cycles;
    while (this.clock < 0) { const c0 = this.cycles; this.step(); this.clock += this.cycles - c0; }
    this.syncDsp();
  }
  /** Executa exatamente uma instrução. */
  step(): void {
    const op = this.read(this.pc);
    this.pc = (this.pc + 1) & 0xffff;
    execute(this, op);
  }
  syncDsp(): void { if (this.dspPending) { this.dsp.run(this.dspPending); this.dspPending = 0; } }

  // ---- barramento (usado por smp-ops.ts)
  private tick(): void {
    for (let t = 0; t < 3; t++) {
      if (++this.tStage1[t] < TIMER_FREQ[t]) continue;
      this.tStage1[t] = 0;
      if (!this.tEnable[t]) continue;
      this.tStage2[t] = (this.tStage2[t] + 1) & 0xff;
      if (this.tStage2[t] !== this.tTarget[t]) continue;     // alvo 0 = 256
      this.tStage2[t] = 0;
      this.tStage3[t] = (this.tStage3[t] + 1) & 15;
    }
    this.cycles++;
    this.dspPending++;
  }
  idle(): void { this.tick(); this.onBus?.(3, 0, 0, this.cycles); }
  read(addr: number): number {
    this.tick();
    let v: number;
    if ((addr & 0xfff0) === 0x00f0) v = this.mmioRead(addr);
    else if (addr >= 0xffc0 && this.iplEnabled) v = IPL_ROM[addr & 0x3f];
    else v = this.ram[addr];
    this.onBus?.(1, addr, v, this.cycles);
    return v;
  }
  write(addr: number, v: number): void {
    this.tick();
    this.onBus?.(2, addr, v, this.cycles);
    if ((addr & 0xfff0) === 0x00f0) this.mmioWrite(addr, v);
    this.ram[addr] = v;                          // toda escrita vai para a RAM, inclusive MMIO
  }
  push(v: number): void {
    this.tick();
    const addr = 0x100 | this.sp;
    this.onBus?.(2, addr, v, this.cycles);
    this.ram[addr] = v; this.sp = (this.sp - 1) & 0xff;
  }
  pop(): number {
    this.tick();
    this.sp = (this.sp + 1) & 0xff;
    const addr = 0x100 | this.sp, v = this.ram[addr];
    this.onBus?.(1, addr, v, this.cycles);
    return v;
  }

  private mmioRead(addr: number): number {
    switch (addr) {
      case 0xf2: return this.dspAddr;
      case 0xf3: this.syncDsp(); return this.dsp.read(this.dspAddr & 0x7f);
      case 0xf4: case 0xf5: case 0xf6: case 0xf7: return this.cpuIn[addr & 3];
      case 0xf8: return this.f8;
      case 0xf9: return this.f9;
      case 0xfd: case 0xfe: case 0xff: {
        const t = addr - 0xfd, v = this.tStage3[t] & 15;
        this.tStage3[t] = 0;
        return v;
      }
      default: return 0;                         // $F0, $F1, $FA–$FC
    }
  }
  private mmioWrite(addr: number, v: number): void {
    switch (addr) {
      case 0xf1:
        this.iplEnabled = (v & 0x80) !== 0;
        if (v & 0x20) { this.cpuIn[2] = 0; this.cpuIn[3] = 0; }
        if (v & 0x10) { this.cpuIn[0] = 0; this.cpuIn[1] = 0; }
        for (let t = 2; t >= 0; t--) {
          const on = (v & (1 << t)) !== 0;
          if (!this.tEnable[t] && on) { this.tStage2[t] = 0; this.tStage3[t] = 0; }
          this.tEnable[t] = on;
        }
        break;
      case 0xf2: this.dspAddr = v; break;
      case 0xf3: if (!(this.dspAddr & 0x80)) { this.syncDsp(); this.dsp.write(this.dspAddr, v); } break;
      case 0xf8: this.f8 = v; break;
      case 0xf9: this.f9 = v; break;
      case 0xfa: case 0xfb: case 0xfc: this.tTarget[addr - 0xfa] = v; break;
      default: break;                            // $F0 (TEST) ignorado; $F4–$F7 já vão para a RAM
    }
  }
}
