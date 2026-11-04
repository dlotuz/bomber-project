import { deliverClip, type DeliverEnv } from '../../src/clip/deliver';

function env(o: { touch: boolean; canShare?: boolean; share?: 'ok' | 'abort' | 'fail' }) {
  const log: string[] = [];
  const e: DeliverEnv = {
    touch: o.touch,
    canShare: o.canShare === undefined ? undefined : () => o.canShare!,
    share: async () => {
      log.push('share');
      if (o.share === 'abort') throw Object.assign(new Error('cancelou'), { name: 'AbortError' });
      if (o.share === 'fail') throw Object.assign(new Error('sem gesto'), { name: 'NotAllowedError' });
    },
    download: (_b, name) => { log.push(`download ${name}`); },
  };
  return { e, log };
}
const blob = new Blob(['x'], { type: 'video/mp4' });

describe('entrega do clipe', () => {
  it('desktop (sem toque): baixa, mesmo com Web Share', async () => {
    const { e, log } = env({ touch: false, canShare: true, share: 'ok' });
    expect(await deliverClip(blob, 'c.mp4', e)).toBe('downloaded');
    expect(log).toEqual(['download c.mp4']);
  });
  it('celular com Web Share de arquivo: abre o compartilhar', async () => {
    const { e, log } = env({ touch: true, canShare: true, share: 'ok' });
    expect(await deliverClip(blob, 'c.mp4', e)).toBe('shared');
    expect(log).toEqual(['share']);
  });
  it('celular: cancelar o compartilhar não baixa; erro (ex.: sem gesto, controle físico) cai no download', async () => {
    const a = env({ touch: true, canShare: true, share: 'abort' });
    expect(await deliverClip(blob, 'c.mp4', a.e)).toBe('cancelled');
    expect(a.log).toEqual(['share']);
    const f = env({ touch: true, canShare: true, share: 'fail' });
    expect(await deliverClip(blob, 'c.mp4', f.e)).toBe('downloaded');
    expect(f.log).toEqual(['share', 'download c.mp4']);
  });
  it('celular sem compartilhar arquivos: baixa', async () => {
    for (const canShare of [false, undefined]) {
      const { e, log } = env({ touch: true, canShare });
      expect(await deliverClip(blob, 'c.mp4', e)).toBe('downloaded');
      expect(log).toEqual(['download c.mp4']);
    }
  });
});
