/**
 * Driver de som FALSO, só com o protocolo de portas do driver Hudson [AUD §1.4] (sem SPC700):
 * IPL/loader (kick, índice, fim), comandos da porta 0 (eco com bit 7 trocado), comandos da porta 1
 * ($10 loader, $13/$93 STOP, $18 fade, $31 stream) e "pronto" = $AA nas portas 2 e 3.
 * Serve para testar o host sem a ROM. Reage às escritas da CPU a cada run().
 */
export class FakeDriver {
  readonly ram = new Uint8Array(0x10000);
  readonly cpuIn = new Uint8Array(4);        // CPU→SPC
  readonly out = new Uint8Array(4);          // SPC→CPU
  mode: 'loader' | 'driver' = 'loader';
  /** comandos recebidos na porta 0 (id = valor & $7F) e na porta 1 (valor cru), em ordem */
  readonly cmds: number[] = [];
  readonly port1: number[] = [];
  readonly uploads: { dest: number; len: number }[] = [];
  streamChunks = 0;
  cycles = 0;
  private last = [0, 0, 0, 0];
  private loaderState: 'kick' | 'data' = 'kick';
  private dest = 0;
  private index = 0;
  private streamMode = false;
  private streamBase = 0;
  private readyIn = -1;

  constructor() { this.enterLoader(); }

  readPort(p: number): number { return this.out[p & 3]; }
  writePort(p: number, v: number): void { this.cpuIn[p & 3] = v & 0xff; }

  private enterLoader(): void {
    this.mode = 'loader'; this.loaderState = 'kick';
    this.out[0] = 0xaa; this.out[1] = 0xbb; this.out[2] = 0; this.out[3] = 0;
  }

  run(cycles: number): void {
    this.cycles += cycles;
    const [i0, i1, i2, i3] = this.cpuIn;
    const ch0 = i0 !== this.last[0], ch1 = i1 !== this.last[1];
    this.last = [i0, i1, i2, i3];
    if (this.readyIn >= 0 && --this.readyIn < 0) { this.out[2] = 0xaa; this.out[3] = 0xaa; }
    if (this.mode === 'loader') {
      if (this.loaderState === 'kick') { if (i0 !== 0xcc) return; }   // o 1º kick de cada entrada é sempre $CC
      else if (!ch0) return;
      if (this.loaderState === 'data' && i0 === (this.index & 0xff)) {
        this.ram[(this.dest + this.index) & 0xffff] = i1;
        this.index++;
        this.uploads[this.uploads.length - 1].len++;
        this.out[0] = i0;
        return;
      }
      this.out[0] = i0;                         // kick
      if (i1 !== 0) {
        this.loaderState = 'data'; this.dest = i2 | (i3 << 8); this.index = 0;
        this.uploads.push({ dest: this.dest, len: 0 });
      } else {
        this.mode = 'driver'; this.readyIn = 3;  // o driver (re)inicia e fica pronto depois
      }
      return;
    }
    if (ch0) { this.out[0] = i0 ^ 0x80; this.cmds.push(i0 & 0x7f); }
    if (!ch1) return;
    this.port1.push(i1);
    if (this.streamMode) {
      if (i1 === 0x7f) { this.streamMode = false; return; }
      if ((i1 & 1) === 0) { this.ram[(this.streamBase + i1) & 0xffff] = i2; this.ram[(this.streamBase + i1 + 1) & 0xffff] = i3; }
      this.out[1] = i1;
      return;
    }
    this.out[1] = i1 ^ 0x80;
    if (i1 === 0x10) { this.enterLoader(); return; }
    if ((i1 & 0x7f) === 0x31) { this.streamMode = true; this.streamBase = i2 | (i3 << 8); this.streamChunks++; }
  }
}
