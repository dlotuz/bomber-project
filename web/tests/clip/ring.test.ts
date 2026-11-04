// Leitores do clipe (src/clip): gravações curtas reais do Chrome (scripts/clip-fixtures.mjs: canvas desenhado por
// código + tom de 440 Hz, pedaços de 1 s, quadro-chave a cada 1 s), lidas em pedaços de vários tamanhos.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebmRing } from '../../src/clip/webm';
import { Mp4Ring } from '../../src/clip/mp4';
import type { ClipRing } from '../../src/clip/ring';

const FIX = fileURLToPath(new URL('../fixtures/clip/', import.meta.url));
const WEBM = new Uint8Array(readFileSync(`${FIX}chrome.webm`));
const MP4 = new Uint8Array(readFileSync(`${FIX}chrome.mp4`));
const join = (parts: readonly Uint8Array[]): Uint8Array => {
  const o = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let k = 0; for (const p of parts) { o.set(p, k); k += p.length; }
  return o;
};
const feed = <R extends ClipRing>(r: R, b: Uint8Array, size: number): R => {
  for (let p = 0; p < b.length; p += size) r.push(b.subarray(p, p + size));
  return r;
};
const SIZES = [1, 7, 333, 4096, 1 << 30];

describe.each([
  ['webm', WEBM, (keep: number): ClipRing => new WebmRing(keep)],
  ['mp4', MP4, (keep: number): ClipRing => new Mp4Ring(keep)],
] as const)('anel %s do Chrome', (_name, file, make) => {
  it('acha os segmentos e os quadros-chave (um por segundo) com qualquer corte dos pedaços', () => {
    const ref = feed(make(60_000), file, 1 << 30);
    expect(ref.broken).toBe(false);
    expect(ref.keySegments).toBeGreaterThanOrEqual(4);
    for (const size of SIZES) {
      const r = feed(make(60_000), file, size);
      expect([r.segments, r.keySegments, r.endMs]).toEqual([ref.segments, ref.keySegments, ref.endMs]);
    }
    expect(ref.endMs).toBeGreaterThan(3900);
  });
  it('o clipe de 2 s começa num quadro-chave entre 2 e 3 s antes do fim, com os tempos a partir de 0', () => {
    const r = feed(make(60_000), file, 333);
    const clip = r.build(2000)!;
    expect(clip.durMs).toBeGreaterThanOrEqual(2000);
    expect(clip.durMs).toBeLessThan(3200);
    // relido do zero: começa em 0, com um quadro-chave no começo, e termina na duração declarada
    const back = feed(make(60_000), join(clip.parts), 1 << 30);
    expect(back.broken).toBe(false);
    expect(back.startMs).toBe(0);
    expect(back.firstKey).toBe(true);
    expect(Math.abs(back.endMs - clip.durMs)).toBeLessThan(40);
  });
  it('pedido maior que a gravação: o clipe é tudo desde o 1º quadro-chave', () => {
    const r = feed(make(60_000), file, 4096);
    const clip = r.build(30_000)!;
    expect(Math.abs(clip.durMs - r.endMs)).toBeLessThan(40);
  });
  it('o anel só guarda a janela pedida (mais um segmento-chave antes dela)', () => {
    const all = feed(make(60_000), file, 4096);
    const r = feed(make(1500), file, 4096);
    expect(r.bytesHeld).toBeLessThan(all.bytesHeld * 0.75);
    expect(r.build(1000)!.durMs).toBeGreaterThanOrEqual(1000);
  });
  it('sem dados ainda: sem clipe', () => {
    expect(make(1000).build(1000)).toBeNull();
    expect(feed(make(1000), file.subarray(0, 40), 7).build(1000)).toBeNull();
  });
  it('lixo no lugar do contêiner: marca quebrado e não monta clipe', () => {
    const r = make(1000);
    r.push(Uint8Array.from({ length: 64 }, () => 0));
    expect(r.broken).toBe(true);
    expect(r.build(1000)).toBeNull();
  });
});

describe('webm: detalhes', () => {
  it('o clipe traz a duração no Info (sem ela o player não mostra o tempo)', () => {
    const clip = new WebmRing(60_000);
    feed(clip, WEBM, 4096);
    const out = clip.build(2000)!;
    const back = feed(new WebmRing(60_000), join(out.parts), 1 << 30);
    expect(back.declaredMs).toBeCloseTo(out.durMs, 0);
  });
});
