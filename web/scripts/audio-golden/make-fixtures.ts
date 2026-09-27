// Gera os fixtures de áudio do plano 11 rodando o spctrace (referência nativa, fora do repositório).
// Uso (em web/):  SPCTRACE=/caminho/spctrace [SB4_ROM=/caminho/rom.sfc] node scripts/audio-golden/make-fixtures.ts
// Só grava números e hashes em tests/fixtures/rom/audio-*.json. Nada de bytes da ROM.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CASES_PER_OP, smpCaseImage, smpCases, encodeCases, dspScenes, encodeScene, progTimers, progDsp, PROG_STEPS,
} from '../../tests/audio/gen/inputs.ts';
import { HOST_SCRIPTS } from '../../tests/audio/gen/host-scripts.ts';

const TOOL = process.env.SPCTRACE;
if (!TOOL || !existsSync(TOOL)) throw new Error('defina SPCTRACE com o binário do spctrace (analise/investigacao/audio/build_spctrace.sh)');
const OUT = new URL('../../tests/fixtures/rom/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'audio-golden-'));
const sha1 = (b: Uint8Array) => createHash('sha1').update(b).digest('hex');
const run = (...args: string[]) => execFileSync(TOOL, args, { maxBuffer: 1 << 26 }).toString();
const save = (name: string, obj: unknown) => { writeFileSync(new URL(name, OUT), JSON.stringify(obj, null, 1) + '\n'); console.log('gravado', name); };
const gen = { script: 'web/scripts/audio-golden/make-fixtures.ts', tool: 'analise/investigacao/audio/spctrace.cpp' };

// 1. padrões de barramento
const bus = (psw: number) => run('bus', String(psw)).trim().split('\n');
save('audio-smp-bus.json', { ...gen, psw00: bus(0), pswFF: bus(255) });

// 2. casos de 1 instrução
const cases = smpCases();
writeFileSync(join(tmp, 'cases.bin'), encodeCases(smpCaseImage(), cases));
run('cases', join(tmp, 'cases.bin'), join(tmp, 'cases.out'));
const res = new Uint8Array(readFileSync(join(tmp, 'cases.out')));
const perOp: Record<string, string> = {};
for (let i = 0; i < cases.length; i += CASES_PER_OP) {
  perOp[cases[i].op.toString(16).padStart(2, '0').toUpperCase()] = sha1(res.subarray(i * 12, (i + CASES_PER_OP) * 12));
}
save('audio-smp-cases.json', { ...gen, casesPerOp: CASES_PER_OP, total: cases.length, perOp });

// 3. cenas do DSP
const scenes: Record<string, { frames: number; sha1: string; first: number[] }> = {};
for (const s of dspScenes()) {
  const f = join(tmp, s.name + '.bin'), o = join(tmp, s.name + '.pcm');
  writeFileSync(f, encodeScene(s));
  run('dsp', f, o);
  const pcm = new Uint8Array(readFileSync(o));
  const i16 = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength >> 1);
  const nz = i16.findIndex(v => v !== 0);
  scenes[s.name] = { frames: i16.length / 2, sha1: sha1(pcm), first: Array.from(i16.subarray(Math.max(0, nz), Math.max(0, nz) + 8)) };
}
save('audio-dsp.json', { ...gen, scenes });

// 4. programas sintéticos
const progs: Record<string, unknown> = {};
for (const [name, img] of [['timers', progTimers()], ['dsp', progDsp()]] as const) {
  const d = join(tmp, 'prog-' + name); mkdirSync(d);
  writeFileSync(join(d, 'img.bin'), img);
  run('prog', join(d, 'img.bin'), String(PROG_STEPS), d);
  const mmio = new Uint8Array(readFileSync(join(d, 'mmio.bin')));
  const regs = readFileSync(join(d, 'regs.txt'), 'utf8').trim().split(' ').map(Number);
  progs[name] = {
    mmioCount: mmio.length / 8, mmioSha1: sha1(mmio),
    ramSha1: sha1(new Uint8Array(readFileSync(join(d, 'apuram.bin')))),
    pcmSha1: sha1(new Uint8Array(readFileSync(join(d, 'pcm.raw')))),
    regs: { pc: regs[0], a: regs[1], x: regs[2], y: regs[3], sp: regs[4], psw: regs[5], cycles: regs[6] },
  };
}
save('audio-prog.json', { ...gen, steps: PROG_STEPS, progs });

// 5. host completo (precisa da ROM)
const ROM = process.env.SB4_ROM;
if (ROM && existsSync(ROM)) {
  let rom = new Uint8Array(readFileSync(ROM));
  if (rom.length % 0x8000 === 512) rom = rom.subarray(512);
  const hosts: Record<string, unknown> = {};
  for (const [name, script] of Object.entries(HOST_SCRIPTS)) {
    const d = join(tmp, 'host-' + name); mkdirSync(d);
    run('host', ROM, script, d);
    const pcm = new Uint8Array(readFileSync(join(d, 'pcm.raw')));
    const mmio = new Uint8Array(readFileSync(join(d, 'mmio.bin')));
    const perSecond: string[] = [];
    for (let o = 0; o < pcm.length; o += 32000 * 4) perSecond.push(sha1(pcm.subarray(o, Math.min(pcm.length, o + 32000 * 4))));
    const win: string[] = [];              // mmio em janelas de 65.536 registros (para achar a 1ª divergência)
    for (let o = 0; o < mmio.length; o += 65536 * 8) win.push(sha1(mmio.subarray(o, Math.min(mmio.length, o + 65536 * 8))));
    hosts[name] = {
      script,
      ops: readFileSync(join(d, 'ops.txt'), 'utf8').trim().split('\n').map(l => { const [op, arg, cyc] = l.split(' '); return [op, parseInt(arg, 16), Number(cyc)]; }),
      pcmFrames: pcm.length / 4, pcmSha1PerSecond: perSecond,
      apuramSha1: sha1(new Uint8Array(readFileSync(join(d, 'apuram.bin')))),
      mmioCount: mmio.length / 8, mmioSha1: sha1(mmio), mmioWindows: win,
    };
  }
  save('audio-host.json', { ...gen, romSha1: sha1(rom), hosts });
} else console.log('SB4_ROM ausente: audio-host.json não foi gerado');
