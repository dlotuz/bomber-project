/**
 * Entradas sintéticas dos goldens de áudio (plano 11). Tudo aqui é nosso (nenhum byte da ROM).
 * Módulo FOLHA: sem imports, só sintaxe apagável — é lido pelos testes (Vitest) e pelo Node puro
 * (`node scripts/audio-golden/make-fixtures.ts`, com remoção de tipos do Node 24).
 */

export function xorshift32(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s;
  };
}

// ------------------------------------------------------------------ SMP: 1 instrução por caso
export const CASES_PER_OP = 16;
export interface SmpCase { pc: number; a: number; x: number; y: number; sp: number; psw: number; op: number; b1: number; b2: number }

/** RAM compartilhada pelos casos: bytes em $20..$DF (ponteiros lidos da RAM caem em $2020..$DFDF). */
export function smpCaseImage(): Uint8Array {
  const r = xorshift32(0x5eed);
  const ram = new Uint8Array(0x10000);
  for (let i = 0; i < 0x10000; i++) ram[i] = 0x20 + (r() % 0xc0);
  for (let i = 0xf0; i <= 0xff; i++) ram[i] = 0;
  return ram;
}

/** 254 opcodes (sem SLEEP $EF e STOP $FF) × CASES_PER_OP, na ordem dos opcodes. Nenhum caso toca $00F0–$00FF nem $FFC0+. */
export function smpCases(): SmpCase[] {
  const r = xorshift32(0xc0ffee);
  const out: SmpCase[] = [];
  for (let op = 0; op < 256; op++) {
    if (op === 0xef || op === 0xff) continue;
    for (let k = 0; k < CASES_PER_OP; k++) {
      out.push({
        pc: 0x0400 + (r() & 0xff) * 4,
        a: r() & 0xff, x: r() & 0x1f, y: r() & 0x1f,
        sp: r() & 0xff, psw: r() & 0xff, op,
        b1: 0x20 + (r() % 0xb0), b2: 0x20 + (r() % 0xb0),
      });
    }
  }
  return out;
}

/** casos.bin do spctrace: "SPCC" u32 n, imagem[65536], n × 12 bytes. */
export function encodeCases(img: Uint8Array, cases: SmpCase[]): Uint8Array {
  const b = new Uint8Array(8 + 65536 + cases.length * 12);
  b.set([0x53, 0x50, 0x43, 0x43], 0);
  new DataView(b.buffer).setUint32(4, cases.length, true);
  b.set(img, 8);
  let o = 8 + 65536;
  for (const c of cases) {
    b.set([c.pc & 0xff, c.pc >> 8, c.a, c.x, c.y, c.sp, c.psw, c.op, c.b1, c.b2, 0, 0], o);
    o += 12;
  }
  return b;
}

// ------------------------------------------------------------------ BRR sintético
/** `blocks` blocos BRR de 9 bytes com cabeçalhos variados (shift 0..12, filtros 0..3); o último tem END (+LOOP se `loop`). */
export function brrSample(seed: number, blocks: number, loop: boolean): Uint8Array {
  const r = xorshift32(seed);
  const b = new Uint8Array(blocks * 9);
  for (let i = 0; i < blocks; i++) {
    const shift = r() % 13, filter = r() & 3;
    const last = i === blocks - 1;
    b[i * 9] = (shift << 4) | (filter << 2) | (last && loop ? 2 : 0) | (last ? 1 : 0);
    for (let j = 1; j < 9; j++) b[i * 9 + j] = r() & 0xff;
  }
  return b;
}

// ------------------------------------------------------------------ DSP: cenas
export interface DspWrite { clock: number; reg: number; value: number }
export interface DspScene { name: string; ram: Uint8Array; writes: DspWrite[]; totalClocks: number }

const SAMPLE_CLOCKS = 32;
const SCENE_SAMPLES = 8000;          // 0,25 s a 32 kHz

function sceneBase(): { ram: Uint8Array; w: (reg: number, value: number) => void; at: (clock: number) => void; writes: DspWrite[] } {
  const ram = new Uint8Array(0x10000);
  // DIR em $0200: 4 samples em $1000, $2000, $3000, $4000 (loop no início)
  const addrs = [0x1000, 0x2000, 0x3000, 0x4000];
  addrs.forEach((a, i) => {
    ram[0x200 + i * 4] = a & 0xff; ram[0x201 + i * 4] = a >> 8;
    ram[0x202 + i * 4] = a & 0xff; ram[0x203 + i * 4] = a >> 8;
    ram.set(brrSample(100 + i, 40 + i * 16, i !== 3), a);
  });
  const writes: DspWrite[] = [];
  let t = 0;
  const w = (reg: number, value: number) => { writes.push({ clock: t, reg, value: value & 0xff }); t += 3; };
  const at = (clock: number) => { if (clock < t) throw new Error('cena fora de ordem'); t = clock; };
  w(0x6c, 0x20); w(0x5d, 0x02); w(0x0c, 0x7f); w(0x1c, 0x7f); w(0x5c, 0x00); w(0x2d, 0); w(0x3d, 0); w(0x4d, 0);
  return { ram, w, at, writes };
}
function voice(w: (r: number, v: number) => void, v: number, srcn: number, pitch: number, adsr1: number, adsr2: number, gain: number, vl = 0x60, vr = 0x50): void {
  const b = v << 4;
  w(b + 0, vl); w(b + 1, vr); w(b + 2, pitch & 0xff); w(b + 3, pitch >> 8);
  w(b + 4, srcn); w(b + 5, adsr1); w(b + 6, adsr2); w(b + 7, gain);
}

export function dspScenes(): DspScene[] {
  const scenes: DspScene[] = [];
  const total = SCENE_SAMPLES * SAMPLE_CLOCKS;
  { // 1: uma voz com ADSR, em loop
    const s = sceneBase();
    voice(s.w, 0, 0, 0x1000, 0x8f, 0xe0, 0);
    s.at(1000); s.w(0x4c, 0x01);
    scenes.push({ name: 'adsr', ram: s.ram, writes: s.writes, totalClocks: total });
  }
  { // 2: modos de GAIN nas vozes 0–4 e KOFF no meio
    const s = sceneBase();
    const gains = [0x7f, 0xc0 | 0x1a, 0xe0 | 0x18, 0xa0 | 0x10, 0x80 | 0x14];
    gains.forEach((g, v) => voice(s.w, v, v & 3, 0x0800 + v * 0x333, 0x00, 0x00, g, 0x40 + v * 8, 0x70 - v * 8));
    s.at(640); s.w(0x4c, 0x1f);
    s.at(total / 2 + 17); s.w(0x5c, 0x05);
    s.at(total / 2 + 1000); s.w(0x5c, 0x00);
    scenes.push({ name: 'gain', ram: s.ram, writes: s.writes, totalClocks: total });
  }
  { // 3: eco com FIR e realimentação
    const s = sceneBase();
    voice(s.w, 0, 1, 0x1200, 0xff, 0xf0, 0);
    voice(s.w, 1, 2, 0x0e00, 0x9f, 0x31, 0, 0x30, 0x7f);
    s.w(0x6d, 0x80); s.w(0x7d, 0x03); s.w(0x0d, 0x50); s.w(0x2c, 0x40); s.w(0x3c, 0xc0);
    [0x7f, 0x00, 0xf0, 0x10, 0x00, 0x20, 0xe0, 0x08].forEach((c, i) => s.w((i << 4) | 0x0f, c));
    s.w(0x4d, 0x03); s.w(0x6c, 0x00);
    s.at(2048); s.w(0x4c, 0x03);
    scenes.push({ name: 'eco', ram: s.ram, writes: s.writes, totalClocks: total });
  }
  { // 4: ruído e modulação de pitch
    const s = sceneBase();
    voice(s.w, 0, 0, 0x0400, 0xff, 0xe0, 0);
    voice(s.w, 1, 1, 0x1000, 0xff, 0xe0, 0);
    voice(s.w, 2, 2, 0x1000, 0xcf, 0xb5, 0);
    s.w(0x2d, 0x02); s.w(0x3d, 0x04); s.w(0x6c, 0x3a);
    s.at(3000); s.w(0x4c, 0x07);
    scenes.push({ name: 'ruido-pmod', ram: s.ram, writes: s.writes, totalClocks: total });
  }
  { // 5: KON/KOFF em ciclos ímpares (meio de amostra) e sample sem loop (END)
    const s = sceneBase();
    voice(s.w, 3, 3, 0x2000, 0xfe, 0x2f, 0);
    voice(s.w, 4, 0, 0x0fff, 0x8a, 0x6c, 0);
    for (let k = 0; k < 40; k++) {
      s.at(5000 + k * 6000 + (k * 7) % 31);
      s.w(0x4c, k & 1 ? 0x10 : 0x08);
      s.w(0x5c, k % 3 === 0 ? 0x10 : 0x00);
    }
    scenes.push({ name: 'kon-koff', ram: s.ram, writes: s.writes, totalClocks: total });
  }
  { // 6: FLG (reset, mudo) e mudança de pitch durante a nota
    const s = sceneBase();
    voice(s.w, 0, 1, 0x1000, 0xff, 0xe0, 0);
    s.at(500); s.w(0x4c, 0x01);
    for (let k = 1; k < 10; k++) { s.at(500 + k * 8000 + k); s.w(0x02, (k * 37) & 0xff); s.w(0x03, 0x08 + (k & 7)); }
    s.at(total / 3); s.w(0x6c, 0x60);
    s.at(total / 3 + 4000); s.w(0x6c, 0x80);
    s.at(total / 3 + 9000); s.w(0x6c, 0x20); s.w(0x4c, 0x01);
    scenes.push({ name: 'flg-pitch', ram: s.ram, writes: s.writes, totalClocks: total });
  }
  return scenes;
}

/** cena.bin do spctrace: "SPCD" u32 n, u32 total, ram[65536], n × {u32 ciclo, u8 reg, u8 valor, u16 0}. */
export function encodeScene(s: DspScene): Uint8Array {
  const b = new Uint8Array(12 + 65536 + s.writes.length * 8);
  const dv = new DataView(b.buffer);
  b.set([0x53, 0x50, 0x43, 0x44], 0);
  dv.setUint32(4, s.writes.length, true);
  dv.setUint32(8, s.totalClocks, true);
  b.set(s.ram, 12);
  let o = 12 + 65536;
  for (const w of s.writes) { dv.setUint32(o, w.clock, true); b[o + 4] = w.reg; b[o + 5] = w.value; o += 8; }
  return b;
}

// ------------------------------------------------------------------ programas SPC sintéticos (modo prog)
export const PROG_STEPS = 200;       // a cada passo k: portas CPU 0/1/2 = k, 7k, k>>1 (& $FF); run(1000)

/** Programa A: timers, leituras fantasmas ($FD/$FE), portas e $F1. Não toca o DSP. */
export function progTimers(): Uint8Array {
  const ram = new Uint8Array(0x10000);
  ram.set([
    0xcd, 0xef, 0xbd, 0x8f, 0x30, 0xf1, 0x8f, 0x20, 0xfa, 0x8f, 0x03, 0xfb, 0x8f, 0x00, 0xfc, 0x8f, 0x07, 0xf1, 0xe8, 0x00, 0xc4, 0x10,
    // $0216: laço
    0xe4, 0xfd, 0x60, 0x84, 0x11, 0xc4, 0x11, 0xeb, 0xfe, 0xcb, 0x12, 0xf8, 0xff, 0xd8, 0x13, 0xe4, 0xf4, 0xc4, 0xf5, 0xe4, 0xf5, 0xc4, 0xf4,
    0x8f, 0x00, 0xfd, 0xc4, 0xfe, 0xab, 0x10, 0xe4, 0x10, 0x28, 0x3f, 0xd0, 0xdc,
    // $023A
    0x8f, 0x05, 0xf1, 0x8f, 0x07, 0xf1, 0x8f, 0x37, 0xf1, 0x2f, 0xd1,
  ], 0x0200);
  return ram;
}

/** Programa B: liga uma voz pelo $F2/$F3 e lê ENVX/OUTX/ENDX em laço (precisa do DSP). */
export function progDsp(): Uint8Array {
  const ram = new Uint8Array(0x10000);
  // DIR em $0400: sample 0 em $0500 (loop no início)
  ram.set([0x00, 0x05, 0x00, 0x05], 0x0400);
  ram.set(brrSample(7, 32, true), 0x0500);
  const setup: [number, number][] = [
    [0x6c, 0x20], [0x5d, 0x04], [0x0c, 0x7f], [0x1c, 0x7f], [0x00, 0x7f], [0x01, 0x7f],
    [0x02, 0x00], [0x03, 0x10], [0x04, 0x00], [0x05, 0x8f], [0x06, 0xe0], [0x4c, 0x01],
  ];
  const code: number[] = [0xcd, 0xef, 0xbd, 0x8f, 0x30, 0xf1];
  for (const [r, v] of setup) code.push(0x8f, r, 0xf2, 0x8f, v, 0xf3);   // MOV $F2,#r ; MOV $F3,#v
  const loop = 0x0200 + code.length;
  code.push(
    0x8f, 0x08, 0xf2, 0xe4, 0xf3, 0xc4, 0x20,   // ENVX → $20
    0x8f, 0x09, 0xf2, 0xe4, 0xf3, 0xc4, 0x21,   // OUTX → $21
    0x8f, 0x7c, 0xf2, 0xe4, 0xf3, 0xc4, 0x22,   // ENDX → $22
    0xc4, 0xf3,                                 // escreve em ENDX (zera)
    0xe4, 0x20, 0xc4, 0xf4,                     // ENVX na porta 0
    0xab, 0x23,                                 // INC $23
  );
  const rel = loop - (0x0200 + code.length + 2);
  code.push(0x2f, rel & 0xff);                  // BRA laço
  ram.set(code, 0x0200);
  return ram;
}
