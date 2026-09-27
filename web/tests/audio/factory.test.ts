import { createAudioFactory, type RomBytes } from '../../src/audio/factory';
import { RomAudioSink } from '../../src/audio/rom-sink';
import { NoopSink } from '../../src/audio/sink';
import type { AudioClientLike } from '../../src/audio/client';
import type { AudioCmd } from '../../src/audio/engine/commands';

function fakeRom(): RomBytes {
  const rom = new Uint8Array(0x400000);
  return { bytes: (a, n) => rom.subarray(a - 0xc00000, a - 0xc00000 + n) };
}

function setup() {
  let rom: RomBytes | null = null;
  const clients: { sent: AudioCmd[]; closed: boolean; c0: number; data: number; resumes: number }[] = [];
  const sinks: unknown[] = [];
  let ticks = 0;
  const factory = createAudioFactory({
    currentRom: () => rom,
    createClient: async s => {
      const c = { sent: [] as AudioCmd[], closed: false, c0: s.c0.length, data: s.data.length, resumes: 0 };
      clients.push(c);
      const api: AudioClientLike = { send: cmd => { c.sent.push(cmd); }, resume: () => { c.resumes++; }, close: async () => { c.closed = true; } };
      return api;
    },
    onTick: () => { ticks++; },
    onSink: sk => { sinks.push(sk); },
  });
  return { factory, clients, sinks, setRom: (r: RomBytes | null) => { rom = r; }, ticks: () => ticks };
}

describe('createAudioFactory (registerAudioFactory do plano 10)', () => {
  it('sem ROM devolve NoopSink e não cria cliente', async () => {
    const t = setup();
    expect(await t.factory()).toBeInstanceOf(NoopSink);
    expect(t.clients).toHaveLength(0);
  });
  it('com ROM: cliente com as fatias certas, boot primeiro, e o mesmo sink enquanto a ROM não muda', async () => {
    const t = setup();
    t.setRom(fakeRom());
    const a = await t.factory();
    expect(a).toBeInstanceOf(RomAudioSink);
    expect(t.clients).toHaveLength(1);
    expect([t.clients[0].c0, t.clients[0].data]).toEqual([1627, 367765]);
    expect(t.clients[0].sent).toEqual([{ t: 'boot' }]);
    expect(await t.factory()).toBe(a);
    a.tick();
    expect(t.ticks()).toBe(1);
  });
  it('ROM trocada ou esquecida fecha o cliente anterior', async () => {
    const t = setup();
    t.setRom(fakeRom()); await t.factory();
    t.setRom(fakeRom()); await t.factory();
    expect(t.clients.map(c => c.closed)).toEqual([true, false]);
    t.setRom(null);
    expect(await t.factory()).toBeInstanceOf(NoopSink);
    expect(t.clients[1].closed).toBe(true);
  });
  it('chamadas sobrepostas não criam dois clientes', async () => {
    const t = setup();
    t.setRom(fakeRom());
    const [a, b] = await Promise.all([t.factory(), t.factory()]);
    expect(a).toBe(b);
    expect(t.clients).toHaveLength(1);
  });
  it('resume() repassa ao cliente atual (gesto do usuário, I3); sem cliente não faz nada', async () => {
    const t = setup();
    t.factory.resume();
    t.setRom(fakeRom());
    await t.factory();
    t.factory.resume(); t.factory.resume();
    expect(t.clients[0].resumes).toBe(2);
  });
  it('onSink avisa cada sink real novo (o BattleAudio zera os atrasos, M2)', async () => {
    const t = setup();
    t.setRom(fakeRom());
    const a = await t.factory(); await t.factory();
    t.setRom(fakeRom());
    const b = await t.factory();
    expect(t.sinks).toEqual([a, b]);
  });
  it('erro ao criar o cliente: NoopSink e onError', async () => {
    const errs: unknown[] = [];
    const f = createAudioFactory({ currentRom: fakeRom, createClient: async () => { throw new Error('sem AudioWorklet'); }, onError: e => { errs.push(e); } });
    expect(await f()).toBeInstanceOf(NoopSink);
    expect(errs).toHaveLength(1);
  });
});

vi.mock('../../src/audio/client', () => ({ AudioClient: { create: vi.fn() } }));

describe('register.ts (registro no plano 10)', () => {
  function recorder() {
    const log: string[] = [];
    const sink = new NoopSink();
    for (const k of ['bank', 'music', 'sfx', 'voice', 'stop', 'fade'] as const) {
      (sink as unknown as Record<string, (id?: number) => void>)[k] = (id?: number) => { log.push(id === undefined ? k : `${k}:${id}`); };
    }
    return { sink, log };
  }
  it('eventos da partida tocam pelo BattleAudio; desmonte sem reserva por acerto fala a voz $04', async () => {
    const { AudioDirector } = await import('../../src/app/audio');
    await import('../../src/audio/register');
    const r = recorder();
    const d = new AudioDirector(r.sink);
    d.playEvents([
      { type: 'bomb_placed', slot: 0, cell: 20 },
      { type: 'stage', id: 'a2_warn' },
      { type: 'mount', id: 'mount_lost', slot: 0, reserve: false, cause: 'hit' } as never,
      { type: 'mount', id: 'mount_lost', slot: 1, reserve: false, cause: 'launch' } as never,
      { type: 'mount', id: 'mount_lost', slot: 2, reserve: true, cause: 'hit' } as never,
      { type: 'mount', id: 'mount_lost', slot: 3, reserve: false, cause: 'stun' } as never,
    ]);
    expect(r.log).toEqual(['sfx:12', 'sfx:38', 'voice:4']);
  });
  it('sem ROM a fábrica registrada devolve NoopSink', async () => {
    const { AudioDirector, startRealAudio } = await import('../../src/app/audio');
    await import('../../src/audio/register');
    const d = new AudioDirector();
    expect(await startRealAudio(d)).toBe(true);
    expect((d as unknown as { sink: unknown }).sink).toBeInstanceOf(NoopSink);
  });
});
