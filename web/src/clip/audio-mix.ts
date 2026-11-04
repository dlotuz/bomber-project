// Som do CLIPE: o APU (o nó do AudioWorklet) e a MÚSICA PRÓPRIA (o <audio> de audio/own-music.ts) somados num
// destino de gravação, no mesmo AudioContext do APU. A saída normal não muda: o APU continua ligado ao alto-falante e
// o <audio> continua tocando sozinho — a gravação pega uma cópia dele por `captureStream()`. Essa cópia vem antes do
// volume do elemento (o ganho imita o volume e o mudo) e ganha uma faixa nova a cada música (troca a fonte).

type Capturable = HTMLMediaElement & { captureStream?(): MediaStream };

export class ClipAudioMix {
  private readonly dest: MediaStreamAudioDestinationNode;
  private readonly own: GainNode;
  private src: AudioNode | null = null;
  private srcTrack: unknown = null;
  private readonly attached = new WeakSet<HTMLMediaElement>();

  constructor(private readonly ctx: AudioContext, apu: AudioNode,
    private readonly stream: (tracks: MediaStreamTrack[]) => MediaStream = t => new MediaStream(t)) {
    this.dest = ctx.createMediaStreamDestination();
    apu.connect(this.dest);
    this.own = ctx.createGain();
    this.own.connect(this.dest);
  }

  /** Trilha de som da gravação. */
  get track(): MediaStreamTrack | null { return this.dest.stream.getAudioTracks()[0] ?? null; }
  /** Ganho atual da MÚSICA PRÓPRIA na gravação (o volume do <audio>, 0 se mudo). */
  get ownGain(): number { return this.own.gain.value; }

  /** Passa a gravar também o <audio> da MÚSICA PRÓPRIA. */
  attach(el: HTMLMediaElement): void {
    const c = el as Capturable;
    if (this.attached.has(el) || typeof c.captureStream !== 'function') return;
    this.attached.add(el);
    const s = c.captureStream();
    const pick = (): void => {
      const t = s.getAudioTracks().at(-1);
      if (!t || t === this.srcTrack) return;
      this.src?.disconnect();
      this.src = this.ctx.createMediaStreamSource(this.stream([t]));
      this.src.connect(this.own);
      this.srcTrack = t;
    };
    const vol = (): void => { this.own.gain.value = el.muted ? 0 : el.volume; };
    s.addEventListener('addtrack', pick);
    el.addEventListener('volumechange', vol);
    pick(); vol();
  }
}
