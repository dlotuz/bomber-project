/**
 * Os 256 opcodes do SPC700. Código do Crown Blast, escrito a partir da documentação do hardware.
 * Cada instrução faz os acessos (s.read / s.write / s.idle / s.push / s.pop) exatamente na ordem medida
 * (fixture audio-smp-bus.json); `execute` é chamada com o opcode já buscado e o PC já incrementado.
 */
import type { Smp } from './smp';

// flags do PSW (iguais a FLAG em smp.ts; locais porque smp.ts importa este módulo — import circular)
const C = 0x01, Z = 0x02, I = 0x04, H = 0x08, B = 0x10, P = 0x20, V = 0x40, N = 0x80;

// ------------------------------------------------------------------ busca e endereços
function pcByte(s: Smp): number { const v = s.read(s.pc); s.pc = (s.pc + 1) & 0xffff; return v; }
function pcWord(s: Smp): number { const lo = pcByte(s); return lo | (pcByte(s) << 8); }
/** Endereço na página direta (0 ou 1, conforme P); o índice dá a volta dentro da página. */
function dpAddr(s: Smp, a: number): number { return (s.psw & P ? 0x100 : 0) | (a & 0xff); }
/** Lê o ponteiro de 16 bits em dp(d), dp(d+1). */
function dpPtr(s: Smp, d: number): number { const lo = s.read(dpAddr(s, d)); return lo | (s.read(dpAddr(s, d + 1)) << 8); }

// ------------------------------------------------------------------ flags
function nz8(s: Smp, v: number): void { s.psw = (s.psw & ~(N | Z)) | (v & 0x80) | ((v & 0xff) === 0 ? Z : 0); }
function nz16(s: Smp, v: number): void { s.psw = (s.psw & ~(N | Z)) | ((v >> 8) & 0x80) | ((v & 0xffff) === 0 ? Z : 0); }
function setFlag(s: Smp, f: number, on: boolean): void { s.psw = on ? s.psw | f : s.psw & ~f; }

function adc(s: Smp, a: number, b: number): number {
  const r = a + b + (s.psw & C);
  let p = s.psw & ~(N | V | H | Z | C);
  if (r > 0xff) p |= C;
  if ((a ^ b ^ r) & 0x10) p |= H;
  if (~(a ^ b) & (a ^ r) & 0x80) p |= V;
  s.psw = p;
  nz8(s, r);
  return r & 0xff;
}
function sbc(s: Smp, a: number, b: number): number { return adc(s, a, ~b & 0xff); }
function cmp(s: Smp, a: number, b: number): void { const r = a - b; setFlag(s, C, r >= 0); nz8(s, r); }

/** OR, AND, EOR, CMP, ADC, SBC (grupo = op >> 5). CMP devolve `a` sem mudança. */
function alu(s: Smp, g: number, a: number, b: number): number {
  switch (g) {
    case 0: a |= b; nz8(s, a); return a;
    case 1: a &= b; nz8(s, a); return a;
    case 2: a ^= b; nz8(s, a); return a;
    case 3: cmp(s, a, b); return a;
    case 4: return adc(s, a, b);
    default: return sbc(s, a, b);
  }
}
/** ASL, ROL, LSR, ROR, DEC, INC (grupo = op >> 5). */
function shift(s: Smp, g: number, v: number): number {
  let r: number;
  switch (g) {
    case 0: r = v << 1; setFlag(s, C, (v & 0x80) !== 0); break;
    case 1: r = (v << 1) | (s.psw & C); setFlag(s, C, (v & 0x80) !== 0); break;
    case 2: r = v >> 1; setFlag(s, C, (v & 1) !== 0); break;
    case 3: r = (v >> 1) | ((s.psw & C) << 7); setFlag(s, C, (v & 1) !== 0); break;
    case 4: r = v - 1; break;
    default: r = v + 1; break;
  }
  r &= 0xff;
  nz8(s, r);
  return r;
}

// ------------------------------------------------------------------ desvios
function jump(s: Smp, rel: number): void { s.idle(); s.idle(); s.pc = (s.pc + ((rel << 24) >> 24)) & 0xffff; }
function branch(s: Smp, cond: boolean): void { const r = pcByte(s); if (cond) jump(s, r); }

// ------------------------------------------------------------------ famílias ALU ($x4–$x9, hi < $C)
function aluOp(s: Smp, op: number): void {
  const g = op >> 5;
  let v: number;
  switch (op & 0x1f) {
    case 0x04: v = s.read(dpAddr(s, pcByte(s))); break;                                   // dp
    case 0x14: { const d = pcByte(s); s.idle(); v = s.read(dpAddr(s, d + s.x)); break; }  // dp+X
    case 0x05: v = s.read(pcWord(s)); break;                                              // !abs
    case 0x15: { const a = pcWord(s); s.idle(); v = s.read((a + s.x) & 0xffff); break; }  // !abs+X
    case 0x06: s.idle(); v = s.read(dpAddr(s, s.x)); break;                               // (X)
    case 0x16: { const a = pcWord(s); s.idle(); v = s.read((a + s.y) & 0xffff); break; }  // !abs+Y
    case 0x07: { const d = pcByte(s); s.idle(); v = s.read(dpPtr(s, d + s.x)); break; }   // [dp+X]
    case 0x17: { const d = pcByte(s); s.idle(); v = s.read((dpPtr(s, d) + s.y) & 0xffff); break; } // [dp]+Y
    case 0x08: v = pcByte(s); break;                                                      // #imm
    case 0x18: {                                                                          // dp,#imm
      const i = pcByte(s); const a = dpAddr(s, pcByte(s));
      const r = alu(s, g, s.read(a), i);
      if (g === 3) s.idle(); else s.write(a, r);
      return;
    }
    case 0x09: {                                                                          // dp,dp
      const src = s.read(dpAddr(s, pcByte(s)));
      const a = dpAddr(s, pcByte(s));
      const r = alu(s, g, s.read(a), src);
      if (g === 3) s.idle(); else s.write(a, r);
      return;
    }
    default: {                                                                            // (X),(Y)
      s.idle();
      const src = s.read(dpAddr(s, s.y));
      const a = dpAddr(s, s.x);
      const r = alu(s, g, s.read(a), src);
      if (g === 3) s.idle(); else s.write(a, r);
      return;
    }
  }
  s.a = alu(s, g, s.a, v);
}

// ------------------------------------------------------------------ leitura-modificação-escrita ($xB/$xC, hi < $C)
function rmwOp(s: Smp, op: number): void {
  const g = op >> 5;
  switch (op & 0x1f) {
    case 0x0b: { const a = dpAddr(s, pcByte(s)); s.write(a, shift(s, g, s.read(a))); break; }
    case 0x1b: { const d = pcByte(s); s.idle(); const a = dpAddr(s, d + s.x); s.write(a, shift(s, g, s.read(a))); break; }
    case 0x0c: { const a = pcWord(s); s.write(a, shift(s, g, s.read(a))); break; }
    default: s.idle(); s.a = shift(s, g, s.a); break;                                    // registrador A
  }
}

// ------------------------------------------------------------------ bit de memória (m.b)
function memBit(s: Smp): [addr: number, bit: number] { const w = pcWord(s); return [w & 0x1fff, w >> 13]; }

// ------------------------------------------------------------------ escrita com leitura fantasma
function writeDummy(s: Smp, a: number, v: number): void { s.read(a); s.write(a, v); }

export function execute(s: Smp, op: number): void {
  const lo = op & 0x0f;
  if (op < 0xc0) {
    if (lo >= 4 && lo <= 9) { aluOp(s, op); return; }
    if (lo === 0x0b || lo === 0x0c) { rmwOp(s, op); return; }
  }
  if (lo === 0x01) {                                                                      // TCALL n
    const va = 0xffde - 2 * (op >> 4);
    const t = s.read(va) | (s.read(va + 1) << 8);
    s.idle(); s.idle(); s.idle();
    s.push(s.pc >> 8); s.push(s.pc & 0xff);
    s.pc = t;
    return;
  }
  if (lo === 0x02) {                                                                      // SET1/CLR1 dp.b
    const a = dpAddr(s, pcByte(s)); const m = s.read(a); const bit = 1 << (op >> 5);
    s.write(a, op & 0x10 ? m & ~bit : m | bit);
    return;
  }
  if (lo === 0x03) {                                                                      // BBS/BBC dp.b,rel
    const m = s.read(dpAddr(s, pcByte(s))); const r = pcByte(s); s.idle();
    const set = (m & (1 << (op >> 5))) !== 0;
    if (set === !(op & 0x10)) jump(s, r);
    return;
  }
  switch (op) {
    // ---------------------------------------------------------------- $x0: desvios e flags
    case 0x00: s.idle(); break;                                                           // NOP
    case 0x10: branch(s, !(s.psw & N)); break;
    case 0x30: branch(s, (s.psw & N) !== 0); break;
    case 0x50: branch(s, !(s.psw & V)); break;
    case 0x70: branch(s, (s.psw & V) !== 0); break;
    case 0x90: branch(s, !(s.psw & C)); break;
    case 0xb0: branch(s, (s.psw & C) !== 0); break;
    case 0xd0: branch(s, !(s.psw & Z)); break;
    case 0xf0: branch(s, (s.psw & Z) !== 0); break;
    case 0x2f: branch(s, true); break;                                                    // BRA
    case 0x20: s.idle(); s.psw &= ~P; break;                                              // CLRP
    case 0x40: s.idle(); s.psw |= P; break;                                               // SETP
    case 0x60: s.idle(); s.psw &= ~C; break;                                              // CLRC
    case 0x80: s.idle(); s.psw |= C; break;                                               // SETC
    case 0xa0: s.idle(); s.idle(); s.psw |= I; break;                                     // EI
    case 0xc0: s.idle(); s.idle(); s.psw &= ~I; break;                                    // DI
    case 0xe0: s.idle(); s.psw &= ~(V | H); break;                                        // CLRV
    case 0xed: s.idle(); s.idle(); s.psw ^= C; break;                                     // NOTC

    // ---------------------------------------------------------------- MOV para A/X/Y (N, Z)
    case 0xe4: s.a = s.read(dpAddr(s, pcByte(s))); nz8(s, s.a); break;
    case 0xf4: { const d = pcByte(s); s.idle(); s.a = s.read(dpAddr(s, d + s.x)); nz8(s, s.a); break; }
    case 0xe5: s.a = s.read(pcWord(s)); nz8(s, s.a); break;
    case 0xf5: { const a = pcWord(s); s.idle(); s.a = s.read((a + s.x) & 0xffff); nz8(s, s.a); break; }
    case 0xe6: s.idle(); s.a = s.read(dpAddr(s, s.x)); nz8(s, s.a); break;
    case 0xf6: { const a = pcWord(s); s.idle(); s.a = s.read((a + s.y) & 0xffff); nz8(s, s.a); break; }
    case 0xe7: { const d = pcByte(s); s.idle(); s.a = s.read(dpPtr(s, d + s.x)); nz8(s, s.a); break; }
    case 0xf7: { const d = pcByte(s); s.idle(); s.a = s.read((dpPtr(s, d) + s.y) & 0xffff); nz8(s, s.a); break; }
    case 0xe8: s.a = pcByte(s); nz8(s, s.a); break;
    case 0xbf: s.idle(); s.a = s.read(dpAddr(s, s.x)); s.idle(); s.x = (s.x + 1) & 0xff; nz8(s, s.a); break; // MOV A,(X)+
    case 0xcd: s.x = pcByte(s); nz8(s, s.x); break;
    case 0xf8: s.x = s.read(dpAddr(s, pcByte(s))); nz8(s, s.x); break;
    case 0xf9: { const d = pcByte(s); s.idle(); s.x = s.read(dpAddr(s, d + s.y)); nz8(s, s.x); break; }
    case 0xe9: s.x = s.read(pcWord(s)); nz8(s, s.x); break;
    case 0x8d: s.y = pcByte(s); nz8(s, s.y); break;
    case 0xeb: s.y = s.read(dpAddr(s, pcByte(s))); nz8(s, s.y); break;
    case 0xfb: { const d = pcByte(s); s.idle(); s.y = s.read(dpAddr(s, d + s.x)); nz8(s, s.y); break; }
    case 0xec: s.y = s.read(pcWord(s)); nz8(s, s.y); break;

    // ---------------------------------------------------------------- MOV entre registradores
    case 0x7d: s.idle(); s.a = s.x; nz8(s, s.a); break;                                   // MOV A,X
    case 0xdd: s.idle(); s.a = s.y; nz8(s, s.a); break;                                   // MOV A,Y
    case 0x5d: s.idle(); s.x = s.a; nz8(s, s.x); break;                                   // MOV X,A
    case 0xfd: s.idle(); s.y = s.a; nz8(s, s.y); break;                                   // MOV Y,A
    case 0x9d: s.idle(); s.x = s.sp; nz8(s, s.x); break;                                  // MOV X,SP
    case 0xbd: s.idle(); s.sp = s.x; break;                                               // MOV SP,X

    // ---------------------------------------------------------------- MOV para a memória (sem flags)
    case 0xc4: writeDummy(s, dpAddr(s, pcByte(s)), s.a); break;
    case 0xd8: writeDummy(s, dpAddr(s, pcByte(s)), s.x); break;
    case 0xcb: writeDummy(s, dpAddr(s, pcByte(s)), s.y); break;
    case 0xd4: { const d = pcByte(s); s.idle(); writeDummy(s, dpAddr(s, d + s.x), s.a); break; }
    case 0xdb: { const d = pcByte(s); s.idle(); writeDummy(s, dpAddr(s, d + s.x), s.y); break; }
    case 0xd9: { const d = pcByte(s); s.idle(); writeDummy(s, dpAddr(s, d + s.y), s.x); break; }
    case 0xc5: writeDummy(s, pcWord(s), s.a); break;
    case 0xc9: writeDummy(s, pcWord(s), s.x); break;
    case 0xcc: writeDummy(s, pcWord(s), s.y); break;
    case 0xd5: { const a = pcWord(s); s.idle(); writeDummy(s, (a + s.x) & 0xffff, s.a); break; }
    case 0xd6: { const a = pcWord(s); s.idle(); writeDummy(s, (a + s.y) & 0xffff, s.a); break; }
    case 0xc6: s.idle(); writeDummy(s, dpAddr(s, s.x), s.a); break;                       // MOV (X),A
    case 0xaf: s.idle(); s.idle(); s.write(dpAddr(s, s.x), s.a); s.x = (s.x + 1) & 0xff; break; // MOV (X)+,A
    case 0xc7: { const d = pcByte(s); s.idle(); writeDummy(s, dpPtr(s, d + s.x), s.a); break; }  // MOV [dp+X],A
    case 0xd7: { const d = pcByte(s); const p = dpPtr(s, d); s.idle(); writeDummy(s, (p + s.y) & 0xffff, s.a); break; } // MOV [dp]+Y,A
    case 0xfa: { const v = s.read(dpAddr(s, pcByte(s))); s.write(dpAddr(s, pcByte(s)), v); break; } // MOV dp,dp
    case 0x8f: { const i = pcByte(s); writeDummy(s, dpAddr(s, pcByte(s)), i); break; }           // MOV dp,#imm

    // ---------------------------------------------------------------- comparações com X/Y
    case 0xc8: cmp(s, s.x, pcByte(s)); break;
    case 0x3e: cmp(s, s.x, s.read(dpAddr(s, pcByte(s)))); break;
    case 0x1e: cmp(s, s.x, s.read(pcWord(s))); break;
    case 0xad: cmp(s, s.y, pcByte(s)); break;
    case 0x7e: cmp(s, s.y, s.read(dpAddr(s, pcByte(s)))); break;
    case 0x5e: cmp(s, s.y, s.read(pcWord(s))); break;

    // ---------------------------------------------------------------- INC/DEC de X/Y
    case 0x1d: s.idle(); s.x = (s.x - 1) & 0xff; nz8(s, s.x); break;
    case 0x3d: s.idle(); s.x = (s.x + 1) & 0xff; nz8(s, s.x); break;
    case 0xdc: s.idle(); s.y = (s.y - 1) & 0xff; nz8(s, s.y); break;
    case 0xfc: s.idle(); s.y = (s.y + 1) & 0xff; nz8(s, s.y); break;

    // ---------------------------------------------------------------- 16 bits
    case 0x1a: case 0x3a: {                                                              // DECW/INCW dp
      const d = pcByte(s);
      const al = dpAddr(s, d), ah = dpAddr(s, d + 1);
      const l = s.read(al);
      const delta = op === 0x3a ? 1 : -1;
      const lr = (l + delta) & 0xff;
      s.write(al, lr);
      const h = s.read(ah);
      const r = (((h << 8) | l) + delta) & 0xffff;
      s.write(ah, r >> 8);
      nz16(s, r);
      break;
    }
    case 0xba: {                                                                          // MOVW YA,dp
      const d = pcByte(s);
      s.a = s.read(dpAddr(s, d)); s.idle(); s.y = s.read(dpAddr(s, d + 1));
      nz16(s, (s.y << 8) | s.a);
      break;
    }
    case 0xda: {                                                                          // MOVW dp,YA
      const d = pcByte(s);
      s.read(dpAddr(s, d)); s.write(dpAddr(s, d), s.a); s.write(dpAddr(s, d + 1), s.y);
      break;
    }
    case 0x7a: case 0x9a: {                                                               // ADDW/SUBW YA,dp
      const d = pcByte(s);
      const ml = s.read(dpAddr(s, d)); s.idle(); const mh = s.read(dpAddr(s, d + 1));
      if (op === 0x7a) { s.psw &= ~C; s.a = adc(s, s.a, ml); s.y = adc(s, s.y, mh); }
      else { s.psw |= C; s.a = sbc(s, s.a, ml); s.y = sbc(s, s.y, mh); }
      setFlag(s, Z, ((s.y << 8) | s.a) === 0);
      break;
    }
    case 0x5a: {                                                                          // CMPW YA,dp
      const d = pcByte(s);
      const w = s.read(dpAddr(s, d)) | (s.read(dpAddr(s, d + 1)) << 8);
      const r = ((s.y << 8) | s.a) - w;
      setFlag(s, C, r >= 0);
      nz16(s, r & 0xffff);
      break;
    }

    // ---------------------------------------------------------------- bit de memória
    case 0x0a: case 0x2a: {                                                               // OR1 C,(/)m.b
      const [a, b] = memBit(s); const bit = (s.read(a) >> b) & 1; s.idle();
      if (bit ^ (op === 0x2a ? 1 : 0)) s.psw |= C;
      break;
    }
    case 0x4a: case 0x6a: {                                                               // AND1 C,(/)m.b
      const [a, b] = memBit(s); const bit = (s.read(a) >> b) & 1;
      if (!(bit ^ (op === 0x6a ? 1 : 0))) s.psw &= ~C;
      break;
    }
    case 0x8a: { const [a, b] = memBit(s); const bit = (s.read(a) >> b) & 1; s.idle(); s.psw ^= bit; break; } // EOR1
    case 0xaa: { const [a, b] = memBit(s); setFlag(s, C, ((s.read(a) >> b) & 1) !== 0); break; }       // MOV1 C,m.b
    case 0xca: {                                                                          // MOV1 m.b,C
      const [a, b] = memBit(s); const m = s.read(a); s.idle();
      s.write(a, s.psw & C ? m | (1 << b) : m & ~(1 << b));
      break;
    }
    case 0xea: { const [a, b] = memBit(s); s.write(a, s.read(a) ^ (1 << b)); break; }     // NOT1 m.b
    case 0x0e: case 0x4e: {                                                               // TSET1/TCLR1 !abs
      const a = pcWord(s); const m = s.read(a);
      nz8(s, (s.a - m) & 0xff);
      s.read(a);
      s.write(a, op === 0x0e ? m | s.a : m & ~s.a & 0xff);
      break;
    }

    // ---------------------------------------------------------------- desvios compostos
    case 0x2e: {                                                                          // CBNE dp,rel
      const m = s.read(dpAddr(s, pcByte(s))); const r = pcByte(s); s.idle();
      if (s.a !== m) jump(s, r);
      break;
    }
    case 0xde: {                                                                          // CBNE dp+X,rel
      const d = pcByte(s); s.idle(); const m = s.read(dpAddr(s, d + s.x)); const r = pcByte(s); s.idle();
      if (s.a !== m) jump(s, r);
      break;
    }
    case 0x6e: {                                                                          // DBNZ dp,rel
      const a = dpAddr(s, pcByte(s)); const m = (s.read(a) - 1) & 0xff; s.write(a, m);
      const r = pcByte(s);
      if (m !== 0) jump(s, r);
      break;
    }
    case 0xfe: {                                                                          // DBNZ Y,rel
      const r = pcByte(s); s.idle(); s.idle();
      s.y = (s.y - 1) & 0xff;
      if (s.y !== 0) jump(s, r);
      break;
    }

    // ---------------------------------------------------------------- saltos, chamadas e pilha
    case 0x5f: s.pc = pcWord(s); break;                                                   // JMP !abs
    case 0x1f: {                                                                          // JMP [!abs+X]
      const a = (pcWord(s) + s.x) & 0xffff; s.idle();
      s.pc = s.read(a) | (s.read((a + 1) & 0xffff) << 8);
      break;
    }
    case 0x3f: {                                                                          // CALL !abs
      const t = pcWord(s); s.idle(); s.idle(); s.idle();
      s.push(s.pc >> 8); s.push(s.pc & 0xff); s.pc = t;
      break;
    }
    case 0x4f: {                                                                          // PCALL u
      const u = pcByte(s); s.idle(); s.idle();
      s.push(s.pc >> 8); s.push(s.pc & 0xff); s.pc = 0xff00 | u;
      break;
    }
    case 0x0f: {                                                                          // BRK
      const t = s.read(0xffde) | (s.read(0xffdf) << 8); s.idle(); s.idle();
      s.push(s.pc >> 8); s.push(s.pc & 0xff); s.push(s.psw);
      s.psw = (s.psw | B) & ~I; s.pc = t;
      break;
    }
    case 0x6f: { const l = s.pop(); const h = s.pop(); s.idle(); s.idle(); s.pc = l | (h << 8); break; } // RET
    case 0x7f: { s.psw = s.pop(); const l = s.pop(); const h = s.pop(); s.idle(); s.idle(); s.pc = l | (h << 8); break; } // RETI
    case 0x0d: s.idle(); s.idle(); s.push(s.psw); break;                                  // PUSH PSW
    case 0x2d: s.idle(); s.idle(); s.push(s.a); break;
    case 0x4d: s.idle(); s.idle(); s.push(s.x); break;
    case 0x6d: s.idle(); s.idle(); s.push(s.y); break;
    case 0x8e: s.idle(); s.idle(); s.psw = s.pop(); break;                                // POP PSW
    case 0xae: s.idle(); s.idle(); s.a = s.pop(); break;
    case 0xce: s.idle(); s.idle(); s.x = s.pop(); break;
    case 0xee: s.idle(); s.idle(); s.y = s.pop(); break;

    // ---------------------------------------------------------------- aritmética especial
    case 0xcf: {                                                                          // MUL YA
      for (let k = 0; k < 8; k++) s.idle();
      const r = s.y * s.a; s.a = r & 0xff; s.y = r >> 8; nz8(s, s.y);
      break;
    }
    case 0x9e: {                                                                          // DIV YA,X
      for (let k = 0; k < 11; k++) s.idle();
      const ya = (s.y << 8) | s.a, x = s.x, y = s.y;
      setFlag(s, H, (y & 15) >= (x & 15));
      setFlag(s, V, y >= x);
      if (y < 2 * x) { s.a = Math.floor(ya / x) & 0xff; s.y = ya % x; }
      else {
        const t = ya - (x << 9), dv = 256 - x;
        s.a = (255 - Math.floor(t / dv)) & 0xff; s.y = (x + (t % dv)) & 0xff;
      }
      nz8(s, s.a);
      break;
    }
    case 0xdf: {                                                                          // DAA
      s.idle(); s.idle();
      if ((s.psw & C) || s.a > 0x99) { s.a += 0x60; s.psw |= C; }
      if ((s.psw & H) || (s.a & 15) > 9) s.a += 6;
      s.a &= 0xff; nz8(s, s.a);
      break;
    }
    case 0xbe: {                                                                          // DAS
      s.idle(); s.idle();
      if (!(s.psw & C) || s.a > 0x99) { s.a -= 0x60; s.psw &= ~C; }
      if (!(s.psw & H) || (s.a & 15) > 9) s.a -= 6;
      s.a &= 0xff; nz8(s, s.a);
      break;
    }
    case 0x9f: s.idle(); s.idle(); s.idle(); s.idle(); s.a = ((s.a >> 4) | (s.a << 4)) & 0xff; nz8(s, s.a); break; // XCN

    // ---------------------------------------------------------------- espera
    case 0xef: case 0xff: s.idle(); s.idle(); s.pc = (s.pc - 1) & 0xffff; break;         // SLEEP/STOP
    default: throw new Error(`SMP: opcode $${op.toString(16)} sem implementação`);
  }
}
