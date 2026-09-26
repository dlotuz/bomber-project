import { fixture } from './node';
import { CASES_PER_OP, dspScenes, smpCases, PROG_STEPS } from './gen/inputs';
import { HOST_SCRIPTS } from './gen/host-scripts';
import { ROM_SHA1 } from './rom';

describe('fixtures de áudio (gerados pelo spctrace)', () => {
  it('padrões de barramento: 254 opcodes nos dois PSW', () => {
    const f = fixture<{ psw00: string[]; pswFF: string[] }>('audio-smp-bus.json');
    expect(f.psw00).toHaveLength(254);
    expect(f.pswFF).toHaveLength(254);
    expect(f.psw00[0]).toBe('00  2 r0400 i');
    expect(f.psw00[1]).toBe('01  8 r0400 rFFDE rFFDF i i i w01EF w01EE');
    expect(f.pswFF.find(l => l.startsWith('10 '))).toBe('10  2 r0400 r0401');   // BPL não tomado com N = 1
  });
  it('casos de 1 instrução: 1 hash por opcode', () => {
    const f = fixture<{ casesPerOp: number; total: number; perOp: Record<string, string> }>('audio-smp-cases.json');
    expect(f.casesPerOp).toBe(CASES_PER_OP);
    expect(f.total).toBe(smpCases().length);
    expect(Object.keys(f.perOp)).toHaveLength(254);
  });
  it('cenas do DSP: 8.000 quadros cada', () => {
    const f = fixture<{ scenes: Record<string, { frames: number; sha1: string }> }>('audio-dsp.json');
    expect(Object.keys(f.scenes).sort()).toEqual(dspScenes().map(s => s.name).sort());
    for (const s of Object.values(f.scenes)) expect(s.frames).toBe(8000);
  });
  it('programas sintéticos: 200 passos de 1.000 ciclos', () => {
    const f = fixture<{ steps: number; progs: Record<string, { regs: { cycles: number } }> }>('audio-prog.json');
    expect(f.steps).toBe(PROG_STEPS);
    expect(f.progs.timers.regs.cycles).toBe(200_000);
    expect(f.progs.dsp.regs.cycles).toBeGreaterThanOrEqual(200_000);
  });
  it('host com a ROM: mesma ROM e mesmos roteiros', () => {
    const f = fixture<{ romSha1: string; hosts: Record<string, { script: string; pcmFrames: number }> }>('audio-host.json');
    expect(f.romSha1).toBe(ROM_SHA1);
    for (const [k, s] of Object.entries(HOST_SCRIPTS)) expect(f.hosts[k].script).toBe(s);
    expect(f.hosts.batalha.pcmFrames).toBe(32001);
  });
});
