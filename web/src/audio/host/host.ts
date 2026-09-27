/**
 * Lado CPU do som (o 65816 do jogo), portado de `analise/investigacao/audio/spchost.cpp` [AUD §1.4–1.5],
 * com as 2 regras de robustez do plano 11 (iguais às do `spctrace`, a referência dos goldens):
 *  (a) com o driver no ar, antes de entrar no loader espera as portas 2 e 3 = $AA;
 *  (b) 64 ciclos de folga depois do eco do "kick" de cada bloco.
 * Cada operação é um gerador que devolve (yield) quantos ciclos o APU deve rodar antes de continuar.
 * `runSync` roda uma operação até o fim (goldens); o motor em tempo real a intercala com o áudio.
 */
import type { AudioImage } from './image';

export interface ApuBus {
  readPort(p: number): number;             // SPC→CPU ($2140–3 lidos pela CPU)
  writePort(p: number, v: number): void;   // CPU→SPC
  run(cycles: number): void;
}
export type HostOp = Generator<number, void, void>;

export const CPU_SLACK = 64;
export const POLL = 8;
export const FRAME_CYCLES = 17067;          // 1.024.000 / 60
/** Espera máxima de um handshake: 128.000 × 8 ciclos ≈ 1 s de APU (o maior medido com a ROM é ≈ 1.200). */
export const LIMIT = 128_000;

export class HostTimeout extends Error {}

export function runSync(bus: ApuBus, op: HostOp): void {
  for (const n of op) bus.run(n);
}

const BLOCKS = 0xc00190, MUSIC = 0xc00739, SFX = 0xc00787, VOICE = 0xc007b9;
const SETS = 0xda17d2, SMP_PTR = 0xda2118, SMP_LEN = 0xda2238;

export class SpcHost {
  private readonly img: AudioImage;
  private readonly bus: ApuBus;
  // variáveis de página direta do jogo ($D0–$F3)
  d3 = 0; e0 = 0; e1 = 0; e2 = 0; e3 = 0; e9 = 0; ea = 0;
  private p = 0;                           // ponteiro de leitura ($D0–$D2), endereço SNES
  driverUp = false;
  streaming = false;
  private strmLeft = 0;
  private e7 = 0;
  frameCount = 0;                          // conta as chamadas de nmi() (orçamento 4/1/1/1)

  constructor(img: AudioImage, bus: ApuBus) { this.img = img; this.bus = bus; }

  private nb(): number { return this.img.u8(this.p++); }
  private w(p: number, v: number): void { this.bus.writePort(p, v & 0xff); }
  private r(p: number): number { return this.bus.readPort(p); }

  private *wait(p: number, v: number): HostOp {
    for (let k = 0; this.r(p) !== v; k++) {
      yield POLL;
      if (k > LIMIT) throw new HostTimeout(`porta ${p} = $${v.toString(16)} (tem $${this.r(p).toString(16)})`);
    }
  }
  private *enterLoader(): HostOp {                       // $C0:029B
    if (this.driverUp) { yield* this.wait(2, 0xaa); yield* this.wait(3, 0xaa); }   // regra (a)
    for (let k = 0; ; k++) {
      this.w(1, 0x10); yield POLL;
      if (this.r(0) === 0xaa && this.r(1) === 0xbb) break;
      if (k > LIMIT) throw new HostTimeout('loader');
    }
    this.d3 = 0xcc;
  }
  private *xfer(dest: number, n: number): HostOp {       // $C0:0310–$C0:0360
    this.w(1, 0xff); this.w(2, dest & 0xff); this.w(3, dest >> 8); this.w(0, this.d3);
    yield* this.wait(0, this.d3);
    yield CPU_SLACK;                                       // regra (b)
    this.d3 = 0;
    for (let i = 0; i < n; i++) {
      this.w(1, this.nb()); this.w(0, this.d3);
      yield* this.wait(0, this.d3);
      this.d3 = (this.d3 + 1) & 0xff;
    }
    this.d3 = (this.d3 + 1) & 0xff;
    if (this.d3 === 0) this.d3 = 1;
  }
  private *uploadStream(): HostOp {                      // $C0:02F0: [len][dest][dados]… até len = 0
    for (;;) {
      const n = this.nb() | (this.nb() << 8);
      if (!n) return;
      const d = this.nb() | (this.nb() << 8);
      yield* this.xfer(d, n);
    }
  }
  private *endUpload(): HostOp {                         // $C0:02BD
    this.w(1, 0); this.w(2, this.nb()); this.w(3, this.nb());
    if (this.d3 === 0xaa) this.d3 = 0xab;
    this.w(0, this.d3);
    yield* this.wait(0, this.d3);
    this.e0 = (this.d3 & 0x80) ^ 0x80;
    yield CPU_SLACK;
  }
  private *uploadBlock(i: number): HostOp {              // $C0:0416
    this.p = this.img.u24(BLOCKS + 3 * i);
    yield* this.enterLoader(); yield* this.uploadStream(); yield* this.endUpload();
    this.driverUp = true;
  }
  private *sampleSet(k: number): HostOp {                // $C0:0226
    const desc = 0xda0000 | this.img.u16(SETS + 2 * k);
    this.p = 0xda0000 | this.img.u16(desc);
    yield* this.enterLoader(); yield* this.uploadStream();
    let ee = this.img.u16(desc + 2);
    for (let y = desc + 4; this.img.u8(y) !== 0xff; y++) {
      const s = this.img.u8(y);
      const len = this.img.u16(SMP_LEN + 2 * s);
      this.p = this.img.u24(SMP_PTR + 3 * s);
      yield* this.xfer(ee, len);
      ee = (ee + len) & 0xffff;
    }
    yield* this.endUpload();                              // lê os 2 bytes depois do último sample, como o jogo
  }
  private *sendCmd(c: number): HostOp {                  // $C0:071D
    const a = c | this.e0;
    for (let k = 0; ; k++) {
      this.w(0, a ^ 0x80); yield POLL;
      if (this.r(0) === a) { yield POLL; if (this.r(0) === a) break; }
      if (k > LIMIT) throw new HostTimeout(`comando $${c.toString(16)}`);
    }
    this.e0 ^= 0x80;
    yield CPU_SLACK;
  }
  private *stopAll(): HostOp {                           // $C0:046E
    yield* this.wait(2, 0xaa); this.w(1, 0x13); yield* this.wait(1, 0x93); yield* this.wait(2, 0xaa);
    this.w(1, 0x93); yield* this.wait(1, 0x13); yield* this.wait(2, 0xaa);
    this.e2 = this.e3 = this.e9 = this.ea = 0;
    this.streaming = false; this.strmLeft = 0;           // I1: um STOP cancela também o stream da voz
    yield CPU_SLACK;
  }

  /** $C0:0376: driver ($31), SFX/instrumentos ($2E) e banco da partida ($2F). */
  *boot(): HostOp { this.e0 = 0; yield* this.uploadBlock(0x31); yield* this.uploadBlock(0x2e); yield* this.uploadBlock(0x2f); }
  /** $C3:4A16: STOP + bloco (banco de SFX $2F/$30). */
  *bank(id: number): HostOp { yield* this.stopAll(); yield* this.uploadBlock(id); }
  /** $C3:4A44: STOP + música (bloco, set de samples e comando da tabela $C0:0739). */
  *music(id: number): HostOp {
    yield* this.stopAll();
    const m = MUSIC + 3 * (id & 0x7f);
    const b0 = this.img.u8(m), b1 = this.img.u8(m + 1), b2 = this.img.u8(m + 2);
    yield* this.uploadBlock(b0); yield* this.sampleSet(b1); yield* this.sendCmd(b2);
  }
  *stop(): HostOp { yield* this.stopAll(); }
  /** $C0:0445. */
  *fade(): HostOp { this.w(2, 0x7f); this.w(1, 0x18); yield* this.wait(1, 0x98); yield* this.wait(2, 0xaa); }
  /** SFX pendente ($E2); sai no próximo nmi(). Sobrescreve um pendente não enviado (como o spchost). */
  sfx(id: number): void { this.e2 = this.img.u8(SFX + id); }
  /** $C0:03E1. Devolve false quando a voz é ignorada porque já há outra em andamento. */
  voice(id: number): boolean {
    if (this.e9) return false;
    this.ea = this.img.u8(VOICE + 2 * id); this.e9 = this.img.u8(VOICE + 2 * id + 1);
    return true;
  }
  /** $C0:0573 + $C0:05F3 + $C0:0704, 1× por frame: stream (4 pedaços no 1º de cada 4 frames, 1 nos outros), depois SFX e comando da voz. */
  *nmi(): HostOp {
    if (this.ea && !this.streaming) {
      yield* this.sendCmd(0x32);
      this.p = this.img.u24(BLOCKS + 3 * this.ea); this.ea = 0;
      this.streaming = true;
      const n = this.nb() | (this.nb() << 8);
      this.strmLeft = (n + 1) & 0xfffe;
      this.e7 = this.nb() | (this.nb() << 8);
    }
    let chunks = (this.frameCount++ & 3) === 0 ? 4 : 1;
    while (this.streaming && chunks-- > 0) {
      const n = Math.min(this.strmLeft, 0x40);
      this.w(2, this.e7 & 0xff); this.w(3, this.e7 >> 8);
      const a = 0x31 | this.e1;
      this.w(1, a); yield* this.wait(1, a ^ 0x80);
      this.d3 = 0; this.strmLeft -= n; this.e7 = (this.e7 + n) & 0xffff;
      for (let i = 0; i < n; i += 2) {
        this.w(2, this.nb()); this.w(3, this.nb()); this.w(1, this.d3);
        const d = this.d3; this.d3 = (this.d3 + 2) & 0xff;
        yield* this.wait(1, d);
      }
      let done = false;
      if (!this.strmLeft) {
        const m = this.nb() | (this.nb() << 8);
        if (!m) done = true;
        else { this.strmLeft = (m + 1) & 0xfffe; this.e7 = this.nb() | (this.nb() << 8); }
      }
      this.w(1, this.d3 + 1); yield* this.wait(2, 0xaa); this.w(1, 0x7f);
      this.e1 ^= 0x80;
      yield CPU_SLACK;
      if (done) { this.streaming = false; this.e3 = this.e9; this.e9 = 0; }
    }
    if (this.e2) yield* this.sendCmd(this.e2);
    if (this.e3) yield* this.sendCmd(this.e3);
    this.e2 = this.e3 = 0;
  }
}
