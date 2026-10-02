import { loadHdPack, manifestProblem } from '../../src/render/hdart/load';
import { hdArtName, hdPackUrl, startHdArt, hdPack, setHdPack } from '../../src/render/hdart/mode';
import { frameAt } from '../../src/render/hdart/types';
import { anim, manifest, still } from './helpers';

/** fetch falso: `files` = caminho → JSON (ou status de erro). */
function fakeFetch(files: Record<string, unknown>) {
  const seen: string[] = [];
  const f = async (url: string) => {
    seen.push(url);
    if (!(url in files)) return { ok: false, status: 404, json: async () => null };
    return { ok: true, status: 200, json: async () => files[url] };
  };
  return { f, seen };
}
const okImage = async (url: string) => ({ url }) as unknown as CanvasImageSource;

describe('loadHdPack', () => {
  it('lê pacote.json da pasta, carrega as imagens e resolve as chaves', async () => {
    const m = manifest({ 'item/01': still(0, 'a'), 'bomb/0': anim(3, 4, true, 'b') });
    const { f, seen } = fakeFetch({ '/arte-hd/x/pacote.json': m });
    const loaded: string[] = [];
    const pack = await loadHdPack('/arte-hd/x', { fetch: f, loadImage: async u => { loaded.push(u); return okImage(u); }, warn: () => {} });
    expect(seen).toEqual(['/arte-hd/x/pacote.json']);
    expect(loaded.sort()).toEqual(['/arte-hd/x/a.png', '/arte-hd/x/b.png']);
    expect(pack!.manifest.name).toBe('teste');
    expect(pack!.anim('item/01')).toBe(m.anims['item/01']);
    expect(pack!.anim('item/02')).toBeNull();
    expect(pack!.images.get('a')).toEqual({ url: '/arte-hd/x/a.png' });
  });

  it('sem o pacote (404) ou com JSON quebrado: avisa e devolve null', async () => {
    const warn = vi.fn();
    expect(await loadHdPack('/nada/', { fetch: fakeFetch({}).f, loadImage: okImage, warn })).toBeNull();
    const bad = async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } });
    expect(await loadHdPack('/q/', { fetch: bad, loadImage: okImage, warn })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('formato inválido: avisa com o motivo e devolve null', async () => {
    const warn = vi.fn();
    const m = { ...manifest({ 'item/01': still() }), format: 2 };
    expect(await loadHdPack('/p/', { fetch: fakeFetch({ '/p/pacote.json': m }).f, loadImage: okImage, warn })).toBeNull();
    expect(String(warn.mock.calls[0][0])).toMatch(/formato 2/);
  });

  it('imagem que não carrega tira só as animações dela', async () => {
    const m = manifest({ 'item/01': still(0, 'a'), 'bomb/0': still(0, 'b') });
    const warn = vi.fn();
    const pack = await loadHdPack('/p/', {
      fetch: fakeFetch({ '/p/pacote.json': m }).f, warn,
      loadImage: async u => { if (u.endsWith('b.png')) throw new Error('404'); return okImage(u); },
    });
    expect(pack!.anim('item/01')).not.toBeNull();
    expect(pack!.anim('bomb/0')).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('manifestProblem', () => {
  const base = () => manifest({ 'item/01': still() }) as unknown as Record<string, unknown>;
  it('aceita o manifesto mínimo', () => expect(manifestProblem(base())).toBeNull());
  it.each([
    ['sem créditos', (m: Record<string, unknown>) => { m.credits = ''; }, /credits/],
    ['cell zero', (m: Record<string, unknown>) => { m.cell = 0; }, /cell/],
    ['imagem desconhecida', (m: Record<string, unknown>) => { m.anims = { k: still(0, 'zz') }; }, /imagem desconhecida/],
    ['ticks ≠ quadros', (m: Record<string, unknown>) => { m.anims = { k: { ...anim(2, 4, true), ticks: [4] } }; }, /ticks/],
    ['rect com largura 0', (m: Record<string, unknown>) => { m.anims = { k: still(0, 'a', [0, 0], [0, 0, 0, 8]) }; }, /rect/],
    ['sem loop', (m: Record<string, unknown>) => { m.anims = { k: { frames: still().frames, ticks: [1] } }; }, /loop/],
  ])('%s', (_n, mut, re) => {
    const m = base();
    mut(m);
    expect(manifestProblem(m)).toMatch(re);
  });
});

describe('frameAt (quadros por tick)', () => {
  it('em loop volta ao início; sem loop para no último', () => {
    const a = anim(3, 4, true);
    expect([0, 3, 4, 8, 11, 12, 13].map(t => frameAt(a, t).rect[0])).toEqual([0, 0, 64, 128, 128, 0, 0]);
    const b = anim(3, 4, false);
    expect([0, 11, 12, 99].map(t => frameAt(b, t).rect[0])).toEqual([0, 128, 128, 128]);
  });
});

describe('modo HD pela URL', () => {
  it('?arte=hd → provisorio; ?arte=<nome>; sem parâmetro → desligado', () => {
    expect(hdArtName('')).toBeNull();
    expect(hdArtName('?quick&stage=1')).toBeNull();
    expect(hdArtName('?arte=hd')).toBe('provisorio');
    expect(hdArtName('?arte=meu-pacote_2')).toBe('meu-pacote_2');
    expect(hdArtName('?arte=../x')).toBeNull();
    expect(hdArtName('?arte=rom')).toBeNull();
    expect(hdPackUrl('provisorio', './')).toBe('./arte-hd/provisorio/');
  });
  it('startHdArt sem ?arte não busca nada', async () => {
    const { f, seen } = fakeFetch({});
    setHdPack(null);
    expect(await startHdArt('?quick', './', { fetch: f })).toBeNull();
    expect(seen).toEqual([]);
    expect(hdPack()).toBeNull();
  });
  it('startHdArt com ?arte=hd carrega o provisório', async () => {
    const { f, seen } = fakeFetch({ './arte-hd/provisorio/pacote.json': manifest({ 'item/01': still() }) });
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const p = await startHdArt('?arte=hd', './', { fetch: f, loadImage: okImage });
    expect(seen).toEqual(['./arte-hd/provisorio/pacote.json']);
    expect(hdPack()).toBe(p);
    setHdPack(null);
    info.mockRestore();
  });
});
