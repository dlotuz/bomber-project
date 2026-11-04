import { detectClipSupport, CLIP_TYPES, type ClipEnv } from '../../src/clip/support';

/** Navegador falso: `reads` = o construtor do MediaRecorder lê a opção de quadro-chave (como o Chrome). */
function env(o: { reads: boolean; types: readonly string[]; capture?: boolean; throws?: boolean }): ClipEnv {
  class Rec {
    static isTypeSupported(t: string): boolean { return o.types.includes(t); }
    constructor(_s: unknown, opts: Record<string, unknown> = {}) {
      if (o.throws) throw new Error('sem gravador');
      if (o.reads) void opts.videoKeyFrameIntervalDuration;
    }
  }
  return {
    MediaRecorder: Rec as unknown as ClipEnv['MediaRecorder'],
    MediaStream: class {} as unknown as ClipEnv['MediaStream'],
    canvasCapture: o.capture ?? true,
  };
}

describe('suporte ao CLIPE (pela capacidade, não pelo navegador)', () => {
  it('Chrome: lê a opção de quadro-chave e grava MP4 H.264+AAC (o primeiro da lista)', () => {
    expect(detectClipSupport(env({ reads: true, types: CLIP_TYPES }))).toEqual({ ok: true, mime: CLIP_TYPES[0] });
  });
  it('sem MP4: cai no webm', () => {
    const webm = CLIP_TYPES.find(t => t.startsWith('video/webm'))!;
    expect(detectClipSupport(env({ reads: true, types: [webm] }))).toEqual({ ok: true, mime: webm });
  });
  it('gravador que ignora a opção de quadro-chave (Firefox, Safari): sem suporte', () => {
    expect(detectClipSupport(env({ reads: false, types: CLIP_TYPES })).ok).toBe(false);
  });
  it('sem formato, sem captureStream, sem MediaRecorder ou construtor que falha: sem suporte', () => {
    expect(detectClipSupport(env({ reads: true, types: [] })).ok).toBe(false);
    expect(detectClipSupport(env({ reads: true, types: CLIP_TYPES, capture: false })).ok).toBe(false);
    expect(detectClipSupport(env({ reads: true, types: CLIP_TYPES, throws: true })).ok).toBe(false);
    expect(detectClipSupport({ MediaRecorder: undefined, MediaStream: undefined, canvasCapture: false }).ok).toBe(false);
  });
});
