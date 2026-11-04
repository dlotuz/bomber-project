import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ClipRecorder, type MediaRecorderLike } from '../../src/clip/recorder';
import { WebmRing } from '../../src/clip/webm';
import { Mp4Ring } from '../../src/clip/mp4';

const FIX = fileURLToPath(new URL('../fixtures/clip/', import.meta.url));
const file = (ext: string) => new Uint8Array(readFileSync(`${FIX}chrome.${ext}`));

/** MediaRecorder falso: cada `requestData()` (ou `tick()`) entrega o próximo pedaço da gravação real. */
class FakeRec implements MediaRecorderLike {
  static last: FakeRec;
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  chunks: Uint8Array[] = [];
  timeslice = 0;
  constructor(readonly stream: unknown, readonly opts: MediaRecorderOptions) { FakeRec.last = this; }
  start(t: number): void { this.state = 'recording'; this.timeslice = t; }
  pause(): void { this.state = 'paused'; }
  resume(): void { this.state = 'recording'; }
  tick(): void { const c = this.chunks.shift(); if (c) this.ondataavailable?.({ data: new Blob([c as BlobPart]) }); }
  requestData(): void { setTimeout(() => this.tick(), 0); }
  stop(): void { setTimeout(() => { while (this.chunks.length) this.tick(); this.state = 'inactive'; this.onstop?.(); }, 0); }
}
const split = (b: Uint8Array, n: number): Uint8Array[] => Array.from({ length: Math.ceil(b.length / n) }, (_, i) => b.subarray(i * n, (i + 1) * n));
const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

describe('ClipRecorder', () => {
  it('grava com quadro-chave a cada 1 s, pedaços de 1 s e o formato pedido', () => {
    const r = new ClipRecorder('video/mp4;codecs=avc1,mp4a.40.2', 18_000, () => [], { MediaRecorder: FakeRec, stream: t => t as unknown as MediaStream });
    r.start();
    const o = FakeRec.last.opts as MediaRecorderOptions & { videoKeyFrameIntervalDuration?: number };
    expect([FakeRec.last.timeslice, o.mimeType, o.videoKeyFrameIntervalDuration, r.state]).toEqual([1000, 'video/mp4;codecs=avc1,mp4a.40.2', 1000, 'recording']);
    r.pause(); expect(r.state).toBe('paused');
    r.resume(); expect(r.state).toBe('recording');
  });
  it.each([['webm', 'video/webm;codecs=vp8,opus'], ['mp4', 'video/mp4;codecs=avc1,mp4a.40.2']])('take (%s): pede os dados pendentes e monta o arquivo dos últimos N s', async (ext, mime) => {
    const r = new ClipRecorder(mime, 60_000, () => [], { MediaRecorder: FakeRec, stream: t => t as unknown as MediaStream });
    r.start();
    const fake = FakeRec.last;
    fake.chunks = split(file(ext), 4000);
    while (fake.chunks.length > 1) fake.tick();
    const clip = (await r.take(2000))!;
    expect(clip.blob.type).toBe(ext === 'mp4' ? 'video/mp4' : 'video/webm');
    expect(fake.chunks).toHaveLength(0);           // o pedaço que faltava veio pelo requestData
    const back = ext === 'mp4' ? new Mp4Ring(60_000) : new WebmRing(60_000);
    back.push(await bytes(clip.blob));
    expect([back.broken, back.startMs, back.firstKey]).toEqual([false, 0, true]);
    expect(clip.durMs).toBeGreaterThanOrEqual(2000);
  });
  it('depois de parado, o anel continua disponível; sem quadro-chave ainda, take dá null', async () => {
    const r = new ClipRecorder('video/webm;codecs=vp8,opus', 60_000, () => [], { MediaRecorder: FakeRec, stream: t => t as unknown as MediaStream });
    r.start();
    expect(await r.take(1000)).toBeNull();
    FakeRec.last.chunks = split(file('webm'), 10_000);
    await r.stop();
    expect(r.state).toBe('inactive');
    expect((await r.take(1000))!.durMs).toBeGreaterThanOrEqual(1000);
  });
  it('requestData que não responde não prende o take (espera no máximo um pouco)', async () => {
    const r = new ClipRecorder('video/webm;codecs=vp8,opus', 60_000, () => [], { MediaRecorder: FakeRec, stream: t => t as unknown as MediaStream, flushMs: 20 });
    r.start();
    const fake = FakeRec.last;
    fake.chunks = split(file('webm'), 4000);
    while (fake.chunks.length) fake.tick();
    fake.requestData = () => {};
    expect(await r.take(1000)).not.toBeNull();
  });
});
