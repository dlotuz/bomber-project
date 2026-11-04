// O CLIPE precisa de quadro-chave periódico (o anel só começa um clipe num quadro-chave), e isso só o Chrome dá: a
// opção `videoKeyFrameIntervalDuration` do MediaRecorder. A detecção é pela capacidade: o construtor do MediaRecorder
// lê as opções que conhece (dicionário do WebIDL), então um getter nessa opção só é chamado onde ela existe.

/** Formatos na ordem de preferência: MP4 (H.264 de hardware, abre em qualquer lugar), depois webm. */
export const CLIP_TYPES: readonly string[] = [
  'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/webm;codecs=vp8,opus',
];

export interface ClipSupport { ok: boolean; mime: string | null }

/** O que a detecção usa do navegador (injetável nos testes). */
export interface ClipEnv {
  MediaRecorder: (new (s: MediaStream, o?: MediaRecorderOptions) => unknown) & { isTypeSupported(t: string): boolean } | undefined;
  MediaStream: (new () => MediaStream) | undefined;
  canvasCapture: boolean;
}

export function browserClipEnv(): ClipEnv {
  const g = globalThis as unknown as Partial<{ MediaRecorder: ClipEnv['MediaRecorder']; MediaStream: ClipEnv['MediaStream']; HTMLCanvasElement: typeof HTMLCanvasElement }>;
  return {
    MediaRecorder: g.MediaRecorder, MediaStream: g.MediaStream,
    canvasCapture: typeof g.HTMLCanvasElement?.prototype.captureStream === 'function',
  };
}

export function detectClipSupport(env: ClipEnv = browserClipEnv()): ClipSupport {
  const none = { ok: false, mime: null };
  const Rec = env.MediaRecorder;
  if (!Rec || !env.MediaStream || !env.canvasCapture) return none;
  let keyframes = false;
  try {
    const probe = { get videoKeyFrameIntervalDuration(): number { keyframes = true; return 1000; } };
    new Rec(new env.MediaStream(), probe as MediaRecorderOptions);
  } catch { return none; }
  if (!keyframes) return none;
  const mime = CLIP_TYPES.find(t => { try { return Rec.isTypeSupported(t); } catch { return false; } }) ?? null;
  return mime ? { ok: true, mime } : none;
}
