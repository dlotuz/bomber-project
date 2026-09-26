/*
 * Porte para TypeScript do SPC_DSP (snes_spc 0.9.0, http://www.slack.net/~ant/), na versão
 * modificada pelo snes9x (apu/bapu/dsp). Copyright (C) 2007 Shay Green; modificações do snes9x;
 * porte (C) 2026 Crown Blast. Este módulo é software livre: você pode redistribuí-lo e/ou modificá-lo
 * sob os termos da GNU Lesser General Public License, versão 2.1 ou (a seu critério) posterior.
 * Distribuído SEM NENHUMA GARANTIA. Veja web/vendor/snes_spc/LICENSE e NOTICE.txt.
 */

/**
 * S-DSP: porte linha a linha de SPC_DSP.cpp/SPC_DSP.h (fonte correspondente em web/vendor/snes_spc/).
 * Configuração fixa (a da referência spctrace): interpolação gaussiana (InterpolationMethod = 2),
 * eco na RAM (SeparateEchoBuffer = false), stereo_switch = $FFFF, mute_mask = 0, sem MSU1, sem snapshot.
 * A saída de cada amostra (echo_27, SPC_DSP_OUT_HOOK) vai para `out.push(l, r)`.
 */
import type { DspBus } from '../smp';
import type { SampleSink } from '../../engine/ring';
import { COUNTER_OFFSETS, COUNTER_RATES, GAUSS, INITIAL_REGS, SIMPLE_COUNTER_RANGE } from './tables';

// Registradores globais
const R_MVOLL = 0x0c, R_EVOLL = 0x2c;
const R_KON = 0x4c, R_KOFF = 0x5c, R_FLG = 0x6c, R_ENDX = 0x7c;
const R_EFB = 0x0d, R_PMON = 0x2d, R_NON = 0x3d, R_EON = 0x4d;
const R_DIR = 0x5d, R_ESA = 0x6d, R_EDL = 0x7d, R_FIR = 0x0f;
// Registradores de voz
const V_VOLL = 0x00, V_PITCHL = 0x02, V_PITCHH = 0x03, V_SRCN = 0x04;
const V_ADSR0 = 0x05, V_ADSR1 = 0x06, V_GAIN = 0x07, V_ENVX = 0x08, V_OUTX = 0x09;

const REGISTER_COUNT = 128;
const VOICE_COUNT = 8;
const ECHO_HIST_SIZE = 8;
const BRR_BUF_SIZE = 12;
const BRR_BLOCK_SIZE = 9;

// env_mode_t
const ENV_RELEASE = 0, ENV_ATTACK = 1, ENV_DECAY = 2, ENV_SUSTAIN = 3;

const i8 = (x: number): number => (x << 24) >> 24;
const i16 = (x: number): number => (x << 16) >> 16;
/** CLAMP16: `if ((int16_t) io != io) io = (io >> 31) ^ 0x7FFF;` */
const clamp16 = (io: number): number => (i16(io) !== io ? (io >> 31) ^ 0x7fff : io);

/** voice_t */
class Voice {
  readonly buf = new Int32Array(BRR_BUF_SIZE * 2); // amostras decodificadas (tamanho dobrado para simplificar a volta)
  bufPos = 0;          // posição no buffer onde as próximas amostras serão decodificadas
  interpPos = 0;       // posição fracionária relativa na amostra (0x1000 = 1,0)
  brrAddr = 0;         // endereço do bloco BRR atual
  brrOffset = 0;       // deslocamento atual de decodificação no bloco BRR
  base = 0;            // índice dos registradores da voz em regs (v * 0x10)
  vbit = 0;            // máscara da voz: 0x01 para a voz 0, 0x02 para a voz 1 etc.
  konDelay = 0;        // atraso do KON / fase atual de preparação
  envMode = ENV_RELEASE;
  env = 0;             // nível atual do envelope
  hiddenEnv = 0;       // usado pelo modo 7 do GAIN, peculiaridade bem obscura
  tEnvxOut = 0;        // uint8_t
  voiceNumber = 0;

  /** Parte de `load()` que zera o estado (memset até `ram`). */
  clear(): void {
    this.buf.fill(0);
    this.bufPos = 0; this.interpPos = 0; this.brrAddr = 0; this.brrOffset = 0;
    this.base = 0; this.vbit = 0; this.konDelay = 0; this.envMode = ENV_RELEASE;
    this.env = 0; this.hiddenEnv = 0; this.tEnvxOut = 0; this.voiceNumber = 0;
  }
}

export class SpcDsp implements DspBus {
  private readonly ram: Uint8Array;           // RAM de 64K compartilhada entre DSP e SMP
  private readonly out: SampleSink;

  readonly regs = new Uint8Array(REGISTER_COUNT);
  readonly externalRegs = new Uint8Array(REGISTER_COUNT);

  // Histórico do eco: as 8 amostras mais recentes (tamanho dobrado para simplificar a volta): [16][2]
  private readonly echoHist = new Int32Array(ECHO_HIST_SIZE * 2 * 2);
  private echoHistPos = 0;                    // &echo_hist [0 a 7]

  private everyOtherSample = 0;               // alterna a cada amostra
  private kon = 0;                            // valor do KON na última verificação
  private noise = 0;
  private counter = 0;
  private echoOffset = 0;                     // deslocamento a partir do ESA no buffer de eco
  private echoLength = 0;                     // número de bytes em que echo_offset para
  private phase = 0;                          // próximo ciclo a executar (0-31)
  private konCheck = false;                   // ligado quando ocorre um novo KON

  // Registradores ocultos, gravados também quando o registrador principal é gravado
  private newKon = 0;
  private endxBuf = 0;                        // uint8_t
  private envxBuf = 0;                        // uint8_t
  private outxBuf = 0;                        // uint8_t

  // Estado temporário entre ciclos
  // lidos uma vez por amostra
  private tPmon = 0;
  private tNon = 0;
  private tEon = 0;
  private tDir = 0;
  private tKoff = 0;

  // lidos alguns ciclos antes e usados depois
  private tBrrNextAddr = 0;
  private tAdsr0 = 0;
  private tBrrHeader = 0;
  private tBrrByte = 0;
  private tSrcn = 0;
  private tEsa = 0;
  private tEchoEnabled = 0;

  // estado interno recalculado a cada amostra
  private tDirAddr = 0;
  private tPitch = 0;
  private tOutput = 0;
  private tLooped = 0;
  private tEchoPtr = 0;

  // somas esquerda/direita
  private readonly tMainOut = new Int32Array(2);
  private readonly tEchoOut = new Int32Array(2);
  private readonly tEchoIn = new Int32Array(2);

  private readonly voices: Voice[] = [];

  // estado fora da emulação
  private muteMask = 0;
  private stereoSwitch = 0xffff;

  constructor(ram: Uint8Array, out: SampleSink) {
    this.ram = ram;
    this.out = out;
    for (let i = 0; i < VOICE_COUNT; i++) this.voices.push(new Voice());
  }

  // ------------------------------------------------------------------ Inicialização

  /** Estado de power-on: init(ram) + reset() (= load(initial_regs)). */
  reset(): void {
    // init()
    this.muteMask = 0;
    this.load(INITIAL_REGS);
    this.stereoSwitch = 0xffff;
  }

  private softResetCommon(): void {
    this.noise = 0x4000;
    this.echoHistPos = 0;
    this.everyOtherSample = 1;
    this.echoOffset = 0;
    this.phase = 0;
    // (memset separate_echo_buffer: não usado, SeparateEchoBuffer = false)
    this.counter = 0; // init_counter()
    for (let i = 0; i < VOICE_COUNT; i++) this.voices[i].voiceNumber = i;
  }

  private load(regs: Uint8Array): void {
    this.externalRegs.set(regs);
    this.regs.fill(0);
    this.regs[66] = 0x01;
    this.regs[82] = 0x01;
    this.regs[R_FLG] = 0xe0;
    // memset( &m.regs [register_count], 0, offsetof (state_t,ram) - register_count )
    this.echoHist.fill(0);
    this.echoHistPos = 0;
    this.everyOtherSample = 0; this.kon = 0; this.noise = 0; this.counter = 0;
    this.echoOffset = 0; this.echoLength = 0; this.phase = 0; this.konCheck = false;
    this.newKon = 0; this.endxBuf = 0; this.envxBuf = 0; this.outxBuf = 0;
    this.tPmon = 0; this.tNon = 0; this.tEon = 0; this.tDir = 0; this.tKoff = 0;
    this.tBrrNextAddr = 0; this.tAdsr0 = 0; this.tBrrHeader = 0; this.tBrrByte = 0;
    this.tSrcn = 0; this.tEsa = 0; this.tEchoEnabled = 0;
    this.tDirAddr = 0; this.tPitch = 0; this.tOutput = 0; this.tLooped = 0; this.tEchoPtr = 0;
    this.tMainOut.fill(0); this.tEchoOut.fill(0); this.tEchoIn.fill(0);
    for (const v of this.voices) v.clear();

    // Estado interno
    for (let i = VOICE_COUNT; --i >= 0;) {
      const v = this.voices[i];
      v.brrOffset = 1;
      v.vbit = 1 << i;
      v.base = i * 0x10;
    }
    this.newKon = this.regs[R_KON];
    this.tDir = this.regs[R_DIR];
    this.tEsa = this.regs[R_ESA];

    this.softResetCommon();
  }

  // ------------------------------------------------------------------ Registradores (SPC_DSP.h)

  read(addr: number): number {
    return this.externalRegs[addr];
  }

  write(addr: number, data: number): void {
    data &= 0xff;
    this.regs[addr] = data;
    this.externalRegs[addr] = data;
    switch (addr & 0x0f) {
      case V_ENVX:
        this.envxBuf = data;
        break;
      case V_OUTX:
        this.outxBuf = data;
        break;
      case 0x0c:
        if (addr === R_KON) this.newKon = data;
        if (addr === R_ENDX) { // sempre zerado, qualquer que seja o valor escrito
          this.endxBuf = 0;
          this.regs[R_ENDX] = 0;
        }
        break;
    }
  }

  // ------------------------------------------------------------------ Interpolação gaussiana

  private interpolate(v: Voice): number {
    // Índices na tabela gaussiana a partir da posição fracionária entre amostras
    const offset = (v.interpPos >> 4) & 0xff;
    const fwd = 255 - offset;
    const rev = offset; // espelho da metade esquerda da gaussiana
    const buf = v.buf;
    const inp = (v.interpPos >> 12) + v.bufPos;

    let out = (GAUSS[fwd] * buf[inp]) >> 11;
    out += (GAUSS[fwd + 256] * buf[inp + 1]) >> 11;
    out += (GAUSS[rev + 256] * buf[inp + 2]) >> 11;
    out = i16(out);
    out += (GAUSS[rev] * buf[inp + 3]) >> 11;

    out = clamp16(out);
    out &= ~1;
    return out;
  }

  // ------------------------------------------------------------------ Contadores

  private runCounters(): void {
    if (--this.counter < 0) this.counter = SIMPLE_COUNTER_RANGE - 1;
  }

  private readCounter(rate: number): number {
    return ((this.counter >>> 0) + COUNTER_OFFSETS[rate]) % COUNTER_RATES[rate];
  }

  // ------------------------------------------------------------------ Envelope

  private runEnvelope(v: Voice): void {
    let env = v.env;
    if (v.envMode === ENV_RELEASE) { // 60%
      if ((env -= 0x8) < 0) env = 0;
      v.env = env;
    } else {
      let rate: number;
      let envData = this.regs[v.base + V_ADSR1];
      if (this.tAdsr0 & 0x80) { // 99%: ADSR
        if (v.envMode >= ENV_DECAY) { // 99%
          env--;
          env -= env >> 8;
          rate = envData & 0x1f;
          if (v.envMode === ENV_DECAY) // 1%
            rate = ((this.tAdsr0 >> 3) & 0x0e) + 0x10;
        } else { // env_attack (ataque)
          rate = (this.tAdsr0 & 0x0f) * 2 + 1;
          env += rate < 31 ? 0x20 : 0x400;
        }
      } else { // GAIN
        envData = this.regs[v.base + V_GAIN];
        const mode = envData >> 5;
        if (mode < 4) { // direto
          env = envData * 0x10;
          rate = 31;
        } else {
          rate = envData & 0x1f;
          if (mode === 4) { // 4: queda linear
            env -= 0x20;
          } else if (mode < 6) { // 5: queda exponencial
            env--;
            env -= env >> 8;
          } else { // 6,7: subida linear
            env += 0x20;
            if (mode > 6 && (v.hiddenEnv >>> 0) >= 0x600)
              env += 0x8 - 0x20; // 7: subida linear em duas inclinações
          }
        }
      }

      // Nível de sustentação
      if ((env >> 8) === (envData >> 5) && v.envMode === ENV_DECAY)
        v.envMode = ENV_SUSTAIN;

      v.hiddenEnv = env;

      // comparação sem sinal: a queda linear que fica negativa também cai aqui
      if ((env >>> 0) > 0x7ff) {
        env = env < 0 ? 0 : 0x7ff;
        if (v.envMode === ENV_ATTACK) v.envMode = ENV_DECAY;
      }

      if (!this.readCounter(rate)) v.env = env; // nada mais é controlado pelo contador
    }
  }

  // ------------------------------------------------------------------ Decodificação BRR

  private decodeBrr(v: Voice): void {
    // Arruma os quatro nibbles de entrada na ordem 0xABCD para facilitar a decodificação
    let nybbles = this.tBrrByte * 0x100 + this.ram[(v.brrAddr + v.brrOffset + 1) & 0xffff];

    const header = this.tBrrHeader;
    const buf = v.buf;

    // Grava as próximas quatro amostras no buffer circular
    let pos = v.bufPos;
    if ((v.bufPos += 4) >= BRR_BUF_SIZE) v.bufPos = 0;

    // Decodifica quatro amostras
    for (const end = pos + 4; pos < end; pos++, nybbles <<= 4) {
      // Extrai o nibble e estende o sinal
      let s = i16(nybbles) >> 12;

      // Desloca a amostra conforme o cabeçalho
      const shift = header >> 4;
      if (shift <= 12) s = (s << shift) >> 1;
      else s &= ~0x7ff;

      // Aplica o filtro IIR (o 8 é o mais usado)
      const filter = header & 0x0c;
      const p1 = buf[pos + BRR_BUF_SIZE - 1];
      const p2 = buf[pos + BRR_BUF_SIZE - 2] >> 1;
      if (filter >= 8) {
        s += p1;
        s -= p2;
        if (filter === 8) { // s += p1 * 0.953125 - p2 * 0.46875
          s += p2 >> 4;
          s += (p1 * -3) >> 6;
        } else { // s += p1 * 0.8984375 - p2 * 0.40625
          s += (p1 * -13) >> 7;
          s += (p2 * 3) >> 4;
        }
      } else if (filter) { // s += p1 * 0.46875
        s += p1 >> 1;
        s += (-p1) >> 5;
      }

      // Ajusta e grava a amostra
      s = clamp16(s);
      s = i16(s * 2);
      buf[pos + BRR_BUF_SIZE] = buf[pos] = s; // a segunda cópia simplifica a volta
    }
  }

  // ------------------------------------------------------------------ Diversos

  private misc27(): void {
    this.tPmon = this.regs[R_PMON] & 0xfe; // a voz 0 não suporta PMON
  }
  private misc28(): void {
    this.tNon = this.regs[R_NON];
    this.tEon = this.regs[R_EON];
    this.tDir = this.regs[R_DIR];
  }
  private misc29(): void {
    if ((this.everyOtherSample ^= 1) !== 0)
      this.newKon &= ~this.kon; // limpa o KON 63 ciclos depois da última leitura
  }
  private misc30(): void {
    if (this.everyOtherSample) {
      this.kon = this.newKon;
      this.tKoff = this.regs[R_KOFF] | this.muteMask;
    }

    this.runCounters();

    // Ruído
    if (!this.readCounter(this.regs[R_FLG] & 0x1f)) {
      const feedback = (this.noise << 13) ^ (this.noise << 14);
      this.noise = (feedback & 0x4000) ^ (this.noise >> 1);
    }
  }

  // ------------------------------------------------------------------ Vozes

  private V1(v: Voice): void {
    this.tDirAddr = (this.tDir * 0x100 + this.tSrcn * 4) & 0xffff;
    this.tSrcn = this.regs[v.base + V_SRCN];
  }
  private V2(v: Voice): void {
    // Lê o ponteiro do sample (ignorado se não for preciso)
    let entry = this.tDirAddr;
    if (!v.konDelay) entry += 2;
    this.tBrrNextAddr = this.ram[entry & 0xffff] | (this.ram[(entry + 1) & 0xffff] << 8);

    this.tAdsr0 = this.regs[v.base + V_ADSR0];

    // Lê o pitch, espalhado em dois ciclos
    this.tPitch = this.regs[v.base + V_PITCHL];
  }
  private V3a(v: Voice): void {
    this.tPitch += (this.regs[v.base + V_PITCHH] & 0x3f) << 8;
  }
  private V3b(v: Voice): void {
    // Lê o cabeçalho e o byte BRR
    this.tBrrByte = this.ram[(v.brrAddr + v.brrOffset) & 0xffff];
    this.tBrrHeader = this.ram[v.brrAddr]; // brr_addr não precisa de máscara
  }
  private V3c(v: Voice): void {
    // Modulação de pitch pela saída da voz anterior
    if (this.tPmon & v.vbit)
      this.tPitch += ((this.tOutput >> 5) * this.tPitch) >> 10;

    if (v.konDelay) {
      // Prepara o início da decodificação BRR na próxima amostra
      if (v.konDelay === 5) {
        v.brrAddr = this.tBrrNextAddr;
        v.brrOffset = 1;
        v.bufPos = 0;
        this.tBrrHeader = 0; // o cabeçalho é ignorado nesta amostra
        this.konCheck = true;
        // (take_spc_snapshot: sem snapshot)
      }

      // O envelope nunca roda durante o KON
      v.env = 0;
      v.hiddenEnv = 0;

      // Desliga a decodificação BRR até as três últimas amostras
      v.interpPos = 0;
      if (--v.konDelay & 3) v.interpPos = 0x4000;

      // O pitch nunca é somado durante o KON
      this.tPitch = 0;
    }

    // Interpolação gaussiana
    {
      let output = this.interpolate(v);

      // Ruído
      if (this.tNon & v.vbit) output = i16(this.noise * 2);

      // Aplica o envelope
      this.tOutput = ((output * v.env) >> 11) & ~1;
      v.tEnvxOut = (v.env >> 4) & 0xff;
    }

    // Silêncio imediato por fim de sample ou soft reset
    if (this.regs[R_FLG] & 0x80 || (this.tBrrHeader & 3) === 1) {
      v.envMode = ENV_RELEASE;
      v.env = 0;
    }

    if (this.everyOtherSample) {
      // KOFF
      if (this.tKoff & v.vbit) v.envMode = ENV_RELEASE;

      // KON
      if (this.kon & v.vbit) {
        v.konDelay = 5;
        v.envMode = ENV_ATTACK;
      }
    }

    // Roda o envelope para a próxima amostra
    if (!v.konDelay) this.runEnvelope(v);
  }

  private voiceOutput(v: Voice, ch: number): void {
    // Aplica o volume esquerdo/direito
    let amp = (this.tOutput * i8(this.regs[v.base + V_VOLL + ch])) >> 7;
    amp *= (this.stereoSwitch & (1 << (v.voiceNumber + ch * VOICE_COUNT))) ? 1 : 0;

    // Soma ao total de saída
    this.tMainOut[ch] = clamp16(this.tMainOut[ch] + amp);

    // Soma ao total do eco, se ligado
    if (this.tEon & v.vbit)
      this.tEchoOut[ch] = clamp16(this.tEchoOut[ch] + amp);
  }

  private V4(v: Voice): void {
    // Decodifica BRR
    this.tLooped = 0;
    if (v.interpPos >= 0x4000) {
      this.decodeBrr(v);

      if ((v.brrOffset += 2) >= BRR_BLOCK_SIZE) {
        // Começa a decodificar o próximo bloco BRR
        v.brrAddr = (v.brrAddr + BRR_BLOCK_SIZE) & 0xffff;
        if (this.tBrrHeader & 1) {
          v.brrAddr = this.tBrrNextAddr;
          this.tLooped = v.vbit;
        }
        v.brrOffset = 1;
      }
    }

    // Aplica o pitch
    v.interpPos = (v.interpPos & 0x3fff) + this.tPitch;

    // Evita avançar demais (com modulação de pitch)
    if (v.interpPos > 0x7fff) v.interpPos = 0x7fff;

    // Saída esquerda
    this.voiceOutput(v, 0);
  }
  private V5(v: Voice): void {
    // Saída direita
    this.voiceOutput(v, 1);

    // ENDX, OUTX e ENVX não atualizam se foram escritos 1-2 ciclos antes
    let endxBuf = this.regs[R_ENDX] | this.tLooped;

    // Limpa o bit no ENDX se o KON acabou de começar
    if (v.konDelay === 5) endxBuf &= ~v.vbit;
    this.endxBuf = endxBuf & 0xff;
  }
  private V6(): void {
    this.outxBuf = (this.tOutput >> 8) & 0xff;
  }
  private V7(v: Voice): void {
    // Atualiza ENDX
    this.regs[R_ENDX] = this.endxBuf;
    this.externalRegs[R_ENDX] = this.endxBuf;

    this.envxBuf = v.tEnvxOut;
  }
  private V8(v: Voice): void {
    // Atualiza OUTX
    this.regs[v.base + V_OUTX] = this.outxBuf;
    this.externalRegs[v.base + V_OUTX] = this.outxBuf;
  }
  private V9(v: Voice): void {
    // Atualiza ENVX
    this.regs[v.base + V_ENVX] = this.envxBuf;
    this.externalRegs[v.base + V_ENVX] = this.envxBuf;
  }

  // A maioria das vozes faz tudo isso num ciclo: composto prático
  private V3(v: Voice): void {
    this.V3a(v);
    this.V3b(v);
    this.V3c(v);
  }

  // Combinações comuns de etapas de vozes diferentes.
  private V7_V4_V1(n: number): void { const vs = this.voices; this.V7(vs[n]); this.V1(vs[n + 3]); this.V4(vs[n + 1]); }
  private V8_V5_V2(n: number): void { const vs = this.voices; this.V8(vs[n]); this.V5(vs[n + 1]); this.V2(vs[n + 2]); }
  private V9_V6_V3(n: number): void { const vs = this.voices; this.V9(vs[n]); this.V6(); this.V3(vs[n + 2]); }

  // ------------------------------------------------------------------ Eco

  /** ECHO_FIR(i)[ch] */
  private echoFir(i: number, ch: number): number {
    return this.echoHist[(this.echoHistPos + i) * 2 + ch];
  }

  /** CALC_FIR(i, ch) */
  private calcFir(i: number, ch: number): number {
    return (this.echoFir(i + 1, ch) * i8(this.regs[R_FIR + i * 0x10])) >> 6;
  }

  private echoRead(ch: number): void {
    const p = this.tEchoPtr + ch * 2;
    const s = i16(this.ram[p & 0xffff] | (this.ram[(p + 1) & 0xffff] << 8));
    // a segunda cópia simplifica o tratamento da volta
    const v = s >> 1;
    this.echoHist[this.echoHistPos * 2 + ch] = v;
    this.echoHist[(this.echoHistPos + 8) * 2 + ch] = v;
  }

  private echo22(): void {
    // Histórico
    if (++this.echoHistPos >= ECHO_HIST_SIZE) this.echoHistPos = 0;

    this.tEchoPtr = (this.tEsa * 0x100 + this.echoOffset) & 0xffff;
    this.echoRead(0);

    // FIR
    const l = this.calcFir(0, 0);
    const r = this.calcFir(0, 1);

    this.tEchoIn[0] = l;
    this.tEchoIn[1] = r;
  }
  private echo23(): void {
    const l = this.calcFir(1, 0) + this.calcFir(2, 0);
    const r = this.calcFir(1, 1) + this.calcFir(2, 1);

    this.tEchoIn[0] += l;
    this.tEchoIn[1] += r;

    this.echoRead(1);
  }
  private echo24(): void {
    const l = this.calcFir(3, 0) + this.calcFir(4, 0) + this.calcFir(5, 0);
    const r = this.calcFir(3, 1) + this.calcFir(4, 1) + this.calcFir(5, 1);

    this.tEchoIn[0] += l;
    this.tEchoIn[1] += r;
  }
  private echo25(): void {
    let l = this.tEchoIn[0] + this.calcFir(6, 0);
    let r = this.tEchoIn[1] + this.calcFir(6, 1);

    l = i16(l);
    r = i16(r);

    l += i16(this.calcFir(7, 0));
    r += i16(this.calcFir(7, 1));

    l = clamp16(l);
    r = clamp16(r);

    this.tEchoIn[0] = l & ~1;
    this.tEchoIn[1] = r & ~1;
  }
  private echoOutput(ch: number): number {
    const out = i16((this.tMainOut[ch] * i8(this.regs[R_MVOLL + ch * 0x10])) >> 7) +
      i16((this.tEchoIn[ch] * i8(this.regs[R_EVOLL + ch * 0x10])) >> 7);
    return clamp16(out);
  }
  private echo26(): void {
    // Volumes da saída esquerda
    // (guarda a amostra para o próximo ciclo, para sair junto com a direita)
    this.tMainOut[0] = this.echoOutput(0);

    // Realimentação do eco
    const efb = i8(this.regs[R_EFB]);
    let l = this.tEchoOut[0] + i16((this.tEchoIn[0] * efb) >> 7);
    let r = this.tEchoOut[1] + i16((this.tEchoIn[1] * efb) >> 7);

    l = clamp16(l);
    r = clamp16(r);

    this.tEchoOut[0] = l & ~1;
    this.tEchoOut[1] = r & ~1;
  }
  private echo27(): void {
    // Saída
    let l = this.tMainOut[0];
    let r = this.echoOutput(1);
    this.tMainOut[0] = 0;
    this.tMainOut[1] = 0;

    // TODO (original): o mudo global não é tão simples
    if (this.regs[R_FLG] & 0x40) {
      l = 0;
      r = 0;
    }

    // Amostra para o DAC (SPC_DSP_OUT_HOOK)
    this.out.push(l, r);
  }
  private echo28(): void {
    this.tEchoEnabled = this.regs[R_FLG];
  }
  private echoWrite(ch: number): void {
    if (!(this.tEchoEnabled & 0x20)) {
      const p = this.tEchoPtr + ch * 2;
      const s = this.tEchoOut[ch];
      this.ram[p & 0xffff] = s & 0xff;
      this.ram[(p + 1) & 0xffff] = (s >> 8) & 0xff;
    }

    this.tEchoOut[ch] = 0;
  }
  private echo29(): void {
    this.tEsa = this.regs[R_ESA];

    if (!this.echoOffset) this.echoLength = (this.regs[R_EDL] & 0x0f) * 0x800;

    this.echoOffset += 4;
    if (this.echoOffset >= this.echoLength) this.echoOffset = 0;

    // Grava o eco esquerdo
    this.echoWrite(0);

    this.tEchoEnabled = this.regs[R_FLG];
  }
  private echo30(): void {
    // Grava o eco direito
    this.echoWrite(1);
  }

  // ------------------------------------------------------------------ Temporização (GEN_DSP_TIMING)

  /** Roda `clocks` ciclos do DSP (~1024000 por segundo); a cada 32 ciclos sai um par de amostras. */
  run(clocks: number): void {
    const vs = this.voices;
    let phase = this.phase;
    for (let n = clocks; n > 0; n--) {
      switch (phase) {
        case 0: this.V5(vs[0]); this.V2(vs[1]); break;
        case 1: this.V6(); this.V3(vs[1]); break;
        case 2: this.V7_V4_V1(0); break;
        case 3: this.V8_V5_V2(0); break;
        case 4: this.V9_V6_V3(0); break;
        case 5: this.V7_V4_V1(1); break;
        case 6: this.V8_V5_V2(1); break;
        case 7: this.V9_V6_V3(1); break;
        case 8: this.V7_V4_V1(2); break;
        case 9: this.V8_V5_V2(2); break;
        case 10: this.V9_V6_V3(2); break;
        case 11: this.V7_V4_V1(3); break;
        case 12: this.V8_V5_V2(3); break;
        case 13: this.V9_V6_V3(3); break;
        case 14: this.V7_V4_V1(4); break;
        case 15: this.V8_V5_V2(4); break;
        case 16: this.V9_V6_V3(4); break;
        case 17: this.V1(vs[0]); this.V7(vs[5]); this.V4(vs[6]); break;
        case 18: this.V8_V5_V2(5); break;
        case 19: this.V9_V6_V3(5); break;
        case 20: this.V1(vs[1]); this.V7(vs[6]); this.V4(vs[7]); break;
        case 21: this.V8(vs[6]); this.V5(vs[7]); this.V2(vs[0]); break; // dependência de ordem do t_brr_next_addr
        case 22: this.V3a(vs[0]); this.V9(vs[6]); this.V6(); this.echo22(); break;
        case 23: this.V7(vs[7]); this.echo23(); break;
        case 24: this.V8(vs[7]); this.echo24(); break;
        case 25: this.V3b(vs[0]); this.V9(vs[7]); this.echo25(); break;
        case 26: this.echo26(); break;
        case 27: this.misc27(); this.echo27(); break;
        case 28: this.misc28(); this.echo28(); break;
        case 29: this.misc29(); this.echo29(); break;
        case 30: this.misc30(); this.V3c(vs[0]); this.echo30(); break;
        case 31: this.V4(vs[0]); this.V1(vs[2]); break;
      }
      phase = (phase + 1) & 31;
    }
    this.phase = phase;
  }
}
