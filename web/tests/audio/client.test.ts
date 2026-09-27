import { AudioClient, type AudioEnv } from '../../src/audio/client';
import type { WorkletIn } from '../../src/audio/engine/commands';

/** AudioContext/AudioWorkletNode falsos: `addModule` pode falhar e `resume()` pode nunca resolver. */
function fakeEnv(opts: { failAddModule?: boolean; failNode?: boolean; resume?: 'never' | 'ok' | 'reject' } = {}) {
  const contexts: FakeCtx[] = [];
  const posted: unknown[] = [];
  class FakeCtx {
    state: 'suspended' | 'running' | 'closed' = 'suspended';
    closed = 0;
    resumes = 0;
    readonly destination = {};
    readonly audioWorklet = { addModule: async () => { if (opts.failAddModule) throw new Error('sem AudioWorklet'); } };
    constructor() { contexts.push(this); }
    resume(): Promise<void> {
      this.resumes++;
      if (opts.resume === 'never') return new Promise(() => {});
      if (opts.resume === 'reject') return Promise.reject(new Error('negado'));
      this.state = 'running';
      return Promise.resolve();
    }
    close(): Promise<void> { this.closed++; this.state = 'closed'; return Promise.resolve(); }
  }
  class FakeNode {
    readonly port = { onmessage: null as unknown, postMessage: (m: WorkletIn) => { posted.push(m); } };
    constructor() { if (opts.failNode) throw new Error('nó recusado'); }
    connect<T>(d: T): T { return d; }
    disconnect(): void {}
  }
  const env = { AudioContext: FakeCtx, AudioWorkletNode: FakeNode } as unknown as AudioEnv;
  return { env, contexts, posted };
}
const slices = () => ({ c0: new Uint8Array(4), data: new Uint8Array(8) });

describe('AudioClient.create (I3)', () => {
  it('falha no addModule ou no nó: fecha o AudioContext e relança', async () => {
    for (const o of [{ failAddModule: true }, { failNode: true }]) {
      const f = fakeEnv(o);
      await expect(AudioClient.create(slices(), undefined, f.env)).rejects.toThrow();
      expect(f.contexts).toHaveLength(1);
      expect(f.contexts[0].closed).toBe(1);
    }
  });

  it('resume() que nunca resolve não prende a criação; cada gesto tenta de novo enquanto suspenso', async () => {
    const f = fakeEnv({ resume: 'never' });
    const c = await AudioClient.create(slices(), undefined, f.env);
    expect(f.contexts[0].resumes).toBe(1);
    expect(f.posted[0]).toMatchObject({ t: 'image' });
    c.resume(); c.resume();
    expect(f.contexts[0].resumes).toBe(3);
  });

  it('resume() recusado não vira exceção; depois de rodando, o gesto não chama resume de novo', async () => {
    const f = fakeEnv({ resume: 'reject' });
    const c = await AudioClient.create(slices(), undefined, f.env);
    await Promise.resolve();
    f.contexts[0].state = 'running';
    c.resume();
    expect(f.contexts[0].resumes).toBe(1);
  });

  it('volume vai ao worklet como comando (música e efeitos separados, M5)', async () => {
    const f = fakeEnv({ resume: 'ok' });
    const c = await AudioClient.create(slices(), undefined, f.env);
    c.send({ t: 'volume', music: 0, sfx: 0.5 });
    expect(f.posted.at(-1)).toEqual({ t: 'volume', music: 0, sfx: 0.5 });
  });
});
