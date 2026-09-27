import { createAudioStarter } from '../../src/audio/starter';

function setup(results: (boolean | Error)[] = [true]) {
  const pending: { resolve: () => void }[] = [];
  let starts = 0, resumes = 0;
  const warns: unknown[] = [];
  const s = createAudioStarter({
    start: () => new Promise<boolean>((res, rej) => {
      const r = results[Math.min(starts, results.length - 1)];
      starts++;
      pending.push({ resolve: () => (r instanceof Error ? rej(r) : res(r)) });
    }),
    resume: () => { resumes++; },
    warn: e => { warns.push(e); },
  });
  const settle = async () => { pending.shift()!.resolve(); for (let i = 0; i < 5; i++) await Promise.resolve(); };
  return { s, settle, starts: () => starts, resumes: () => resumes, warns };
}

describe('createAudioStarter (gesto e troca de ROM, M6/I3)', () => {
  it('1º gesto liga o som uma vez; gestos durante a criação não criam outro; depois só pedem resume', async () => {
    const t = setup();
    t.s.gesture(); t.s.gesture();
    expect(t.starts()).toBe(1);
    await t.settle();
    expect(t.s.on).toBe(true);
    t.s.gesture();
    expect(t.starts()).toBe(1);
    expect(t.resumes()).toBe(3);
  });
  it('ROM trocada durante a criação não se perde: cria de novo quando a 1ª termina', async () => {
    const t = setup();
    t.s.gesture();
    t.s.romChanged(); t.s.romChanged();
    await t.settle();
    expect(t.starts()).toBe(2);
    await t.settle();
    expect(t.starts()).toBe(2);
  });
  it('ROM trocada antes de qualquer gesto não liga o som', () => {
    const t = setup();
    t.s.romChanged();
    expect(t.starts()).toBe(0);
  });
  it('falha na criação: avisa e o próximo gesto tenta de novo', async () => {
    const t = setup([new Error('x'), true]);
    t.s.gesture();
    await t.settle();
    expect(t.warns).toHaveLength(1);
    expect(t.s.on).toBe(false);
    t.s.gesture();
    expect(t.starts()).toBe(2);
  });
});
