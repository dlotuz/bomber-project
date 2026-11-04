// CLIPE: decide quando o gravador roda e o que acontece ao apertar o botão. Grava só na batalha, com a opção ligada
// e o navegador com suporte (support.ts); pausa com a aba escondida; ao sair da batalha para o gravador mas guarda o
// anel (dá para clipar o fim da rodada já no placar), solto quando a próxima batalha começa ou a opção é desligada.
// O botão é lido no próprio aparelho (InputManager.takeClip), fora do lockstep: no online, só quem apertou grava.
import { S } from '../render/text/strings';

/** O gravador (recorder.ts), do jeito que o controlador usa. */
export interface RecorderLike {
  readonly state: 'recording' | 'paused' | 'inactive';
  start(): void;
  pause(): void;
  resume(): void;
  /** Para de gravar; o que já foi gravado continua disponível para `take`. */
  stop(): Promise<void>;
  /** Os últimos `ms` como arquivo; null = ainda não há quadro-chave gravado. */
  take(ms: number): Promise<{ blob: Blob; durMs: number } | null>;
}

export interface ClipControllerDeps {
  supported: boolean;
  options(): { clipOn: boolean; clipSec: number };
  /** A partida em andamento (null = fora da batalha). */
  battle(): { paused: boolean; stage: number } | null;
  hidden(): boolean;
  /** Identidade da saída de som atual: mudou (outro AudioContext), o gravador recomeça com a trilha nova. */
  audioKey(): unknown;
  now(): number;
  newRecorder(keepMs: number): RecorderLike;
  /** Baixa ou compartilha o arquivo (deliver.ts). */
  deliver(blob: Blob, name: string): Promise<'shared' | 'downloaded' | 'cancelled'>;
  fileName(stage: number): string;
}

/** Folga do anel além da duração do clipe: o clipe começa no quadro-chave de até 1 s antes. */
export const CLIP_SLACK_MS = 3000;
export const TOAST_MS = 2500;

export class ClipController {
  private rec: RecorderLike | null = null;
  private keep = 0;
  private audio: unknown = undefined;
  private stage = 1;
  private busy: Promise<void> | null = null;
  private note: { text: string; until: number } | null = null;

  constructor(private readonly d: ClipControllerDeps) {}

  /** Chamado a cada quadro: liga, pausa, retoma ou para o gravador conforme a partida, a aba e as Opções. */
  update(): void {
    const o = this.d.options(), b = this.d.battle();
    if (!this.d.supported || !o.clipOn) { this.drop(); return; }
    if (!b) {
      if (this.rec && this.rec.state !== 'inactive') void this.rec.stop();
      return;
    }
    const keep = o.clipSec * 1000 + CLIP_SLACK_MS, audio = this.d.audioKey();
    if (!this.rec || this.rec.state === 'inactive' || keep !== this.keep || audio !== this.audio) {
      if (this.rec && this.rec.state !== 'inactive') void this.rec.stop();
      this.rec = this.d.newRecorder(keep);
      this.keep = keep; this.audio = audio; this.stage = b.stage;
      this.rec.start();
    }
    const hidden = this.d.hidden();
    if (hidden && this.rec.state === 'recording') this.rec.pause();
    else if (!hidden && this.rec.state === 'paused') this.rec.resume();
  }

  private drop(): void {
    if (this.rec && this.rec.state !== 'inactive') void this.rec.stop();
    this.rec = null;
  }

  /** Gravando agora (o canvas do clipe precisa do quadro). */
  get recording(): boolean { return this.rec?.state === 'recording'; }
  /** Há o que clipar (gravando, pausado ou o anel da rodada que acabou). */
  get available(): boolean { return !!this.rec; }

  /** Botão do clipe: os últimos N s viram arquivo e vão para o download ou o compartilhar. */
  press(): Promise<void> {
    if (this.busy) return this.busy;
    const rec = this.rec;
    if (!rec || this.d.battle()?.paused) return Promise.resolve();
    const run = async (): Promise<void> => {
      try {
        const r = await rec.take(this.d.options().clipSec * 1000);
        if (!r) { this.say(S.clip.empty); return; }
        const how = await this.d.deliver(r.blob, this.d.fileName(this.d.battle()?.stage ?? this.stage));
        this.say(how === 'cancelled' ? S.clip.cancelled : S.clip.saved);
      } catch {
        this.say(S.clip.failed);
      } finally {
        this.busy = null;
      }
    };
    this.busy = run();
    return this.busy;
  }

  private say(text: string): void { this.note = { text, until: this.d.now() + TOAST_MS }; }

  /** Aviso a mostrar agora (null = nenhum). */
  toast(): string | null {
    if (!this.note || this.d.now() >= this.note.until) return null;
    return this.note.text;
  }
}

const two = (n: number): string => String(n).padStart(2, '0');
/** crown-blast-fase3-2026-11-04-14h05m09.mp4 (hora local; a extensão vem do formato gravado). */
export function clipFileName(d: Date, stage: number, mime: string): string {
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  return `crown-blast-fase${stage}-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}h${two(d.getMinutes())}m${two(d.getSeconds())}.${ext}`;
}
