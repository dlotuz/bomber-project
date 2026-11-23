import { ClipAudioMix } from '../../src/clip/audio-mix';

/** WebAudio falso: registra as ligações. */
function fakeCtx() {
  const log: string[] = [];
  let n = 0;
  const node = (name: string) => ({
    name, gain: { value: 1 },
    connect(to: { name: string }) { log.push(`${name}->${to.name}`); return to; },
    disconnect() { log.push(`${name} x`); },
  });
  const dest = { ...node('dest'), stream: { getAudioTracks: () => ['trilha'] } };
  const ctx = {
    sampleRate: 48000,
    createMediaStreamDestination: () => dest,
    createGain: () => node('gain'),
    createMediaStreamSource: (s: { tracks: string[] }) => node(`src(${s.tracks.join()})#${++n}`),
  };
  return { ctx: ctx as unknown as AudioContext, log, apu: node('apu') as unknown as AudioNode };
}
function fakeEl() {
  const tracks: string[] = [];
  const on = new Map<string, () => void>();
  const stream = { getAudioTracks: () => [...tracks], addEventListener: (t: string, f: () => void) => on.set(t, f) };
  const el = {
    volume: 1, muted: false, captureStream: () => stream,
    addEventListener: (t: string, f: () => void) => on.set(`el:${t}`, f),
  };
  return { el: el as unknown as HTMLMediaElement, tracks, fire: (t: string) => on.get(t)?.() };
}

describe('som do clipe (APU + MÚSICA PRÓPRIA)', () => {
  it('o APU vai para o destino da gravação, sem mexer na saída normal', () => {
    const { ctx, log, apu } = fakeCtx();
    const m = new ClipAudioMix(ctx, apu, t => ({ tracks: t }) as unknown as MediaStream);
    expect(m.track).toBe('trilha');
    expect(log).toEqual(['apu->dest', 'gain->dest']);
  });
  it('APU a 32 kHz: a soma passa por um contexto a 48 kHz (o AAC do MP4 recusa 32 kHz) e a trilha sai dele', () => {
    const { ctx, log, apu } = fakeCtx();
    (ctx as { sampleRate: number }).sampleRate = 32000;
    const rlog: string[] = [];
    let resumed = false;
    const rnode = (name: string) => ({ name, connect(to: { name: string }) { rlog.push(`${name}->${to.name}`); return to; } });
    const rc = {
      state: 'suspended', resume: () => { resumed = true; return Promise.resolve(); },
      createMediaStreamDestination: () => ({ ...rnode('dest48'), stream: { getAudioTracks: () => ['trilha48'] } }),
      createMediaStreamSource: (s: { getAudioTracks(): string[] }) => rnode(`src(${s.getAudioTracks().join()})`),
    };
    const m = new ClipAudioMix(ctx, apu, t => ({ tracks: t }) as unknown as MediaStream, () => rc as unknown as AudioContext);
    expect(log).toEqual(['apu->dest', 'gain->dest']);
    expect(rlog).toEqual(['src(trilha)->dest48']);
    expect([m.track, resumed]).toEqual(['trilha48', true]);
  });
  it('o <audio> entra pela captura (antes do volume): o ganho copia o volume; faixa nova troca a fonte; uma vez por elemento', () => {
    const { ctx, log, apu } = fakeCtx();
    const m = new ClipAudioMix(ctx, apu, t => ({ tracks: t }) as unknown as MediaStream);
    const e = fakeEl();
    m.attach(e.el);
    m.attach(e.el);
    expect(log.filter(l => l.startsWith('src'))).toEqual([]);   // ainda sem faixa tocando
    e.tracks.push('a'); e.fire('addtrack');
    e.tracks.push('b'); e.fire('addtrack');
    expect(log.filter(l => l.startsWith('src'))).toEqual(['src(a)#1->gain', 'src(a)#1 x', 'src(b)#2->gain']);
    (e.el as { volume: number }).volume = 0.3; e.fire('el:volumechange');
    expect(m.ownGain).toBeCloseTo(0.3);
    (e.el as { muted: boolean }).muted = true; e.fire('el:volumechange');
    expect(m.ownGain).toBe(0);
  });
});
