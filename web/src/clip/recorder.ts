// Gravador do CLIPE: um MediaRecorder com quadro-chave a cada 1 s (só o Chrome tem a opção; support.ts), entregando
// pedaços de 1 s que vão para o anel (webm.ts ou mp4.ts). `take` pede os dados ainda no codificador
// (`requestData`) e monta o arquivo dos últimos N s; depois do `stop`, o anel continua lá para clipar o fim da rodada.
import type { RecorderLike } from './controller';
import type { ClipRing } from './ring';
import { Mp4Ring } from './mp4';
import { WebmRing } from './webm';

/** O que o gravador usa do MediaRecorder (injetável nos testes). */
export interface MediaRecorderLike {
  readonly state: 'inactive' | 'recording' | 'paused';
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
  start(timeslice: number): void;
  stop(): void;
  pause(): void;
  resume(): void;
  requestData(): void;
}
export interface RecorderEnv {
  MediaRecorder: new (s: MediaStream, o: MediaRecorderOptions) => MediaRecorderLike;
  stream(tracks: MediaStreamTrack[]): MediaStream;
  /** Quanto esperar a resposta do `requestData` (ms). */
  flushMs?: number;
}
const browserEnv = (): RecorderEnv => ({
  MediaRecorder: MediaRecorder as unknown as RecorderEnv['MediaRecorder'],
  stream: t => new MediaStream(t),
});

/** Alvo de 2,5 Mbit/s: o H.264 de hardware do Chrome entrega ~5 Mbit/s em 1280×720 (≈ 10 MB por 15 s), nítido para pixel art. */
export const VIDEO_BPS = 2_500_000;
export const AUDIO_BPS = 128_000;
export const SLICE_MS = 1000;
export const KEYFRAME_MS = 1000;

export class ClipRecorder implements RecorderLike {
  private rec: MediaRecorderLike | null = null;
  private readonly ring: ClipRing;
  private chain: Promise<void> = Promise.resolve();
  /** `take` esperando o pedaço pedido: só um evento que chegou depois do `requestData` serve. */
  private waiters: { after: number; done(): void }[] = [];
  private events = 0;
  private stopped: Promise<void> | null = null;
  private failed = false;
  private readonly env: RecorderEnv;
  private readonly type: string;

  /** `tracks()`: a trilha do canvas do clipe e, se houver, a do som (lidas no `start`). */
  constructor(private readonly mime: string, keepMs: number, private readonly tracks: () => MediaStreamTrack[], env?: RecorderEnv) {
    this.env = env ?? browserEnv();
    this.type = mime.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
    this.ring = this.type === 'video/mp4' ? new Mp4Ring(keepMs) : new WebmRing(keepMs);
  }

  get state(): 'recording' | 'paused' | 'inactive' {
    if (!this.rec || this.failed || this.stopped) return 'inactive';
    return this.rec.state;
  }

  start(): void {
    const opts = { mimeType: this.mime, videoBitsPerSecond: VIDEO_BPS, audioBitsPerSecond: AUDIO_BPS,
      videoKeyFrameIntervalDuration: KEYFRAME_MS } as MediaRecorderOptions;
    const rec = new this.env.MediaRecorder(this.env.stream(this.tracks()), opts);
    rec.ondataavailable = e => {
      const blob = e.data, seq = ++this.events;
      this.chain = this.chain.then(async () => {
        if (blob.size) this.ring.push(new Uint8Array(await blob.arrayBuffer()));
        if (this.ring.broken) this.failed = true;
        this.waiters = this.waiters.filter(w => (w.after < seq ? (w.done(), false) : true));
      });
    };
    rec.onerror = () => { this.failed = true; };
    rec.start(SLICE_MS);
    this.rec = rec;
  }

  pause(): void { if (this.rec?.state === 'recording') this.rec.pause(); }
  resume(): void { if (this.rec?.state === 'paused') this.rec.resume(); }

  stop(): Promise<void> {
    if (this.stopped) return this.stopped;
    const rec = this.rec;
    if (!rec || rec.state === 'inactive') { this.stopped = Promise.resolve(); return this.stopped; }
    this.stopped = new Promise<void>(res => {
      rec.onstop = () => { void this.chain.then(res); };
      rec.stop();
    });
    return this.stopped;
  }

  async take(ms: number, title?: string): Promise<{ blob: Blob; durMs: number } | null> {
    const rec = this.rec;
    if (rec && !this.stopped && !this.failed && rec.state !== 'inactive') {
      // os dados ainda no codificador: o `requestData` entrega o que houver (sem esperar para sempre)
      await new Promise<void>(res => {
        this.waiters.push({ after: this.events, done: res });
        setTimeout(res, this.env.flushMs ?? 1500);
        rec.requestData();
      });
    }
    if (this.stopped) await this.stopped;
    await this.chain;
    const f = this.ring.build(ms, title);
    return f ? { blob: new Blob(f.parts as BlobPart[], { type: this.type }), durMs: f.durMs } : null;
  }
}
