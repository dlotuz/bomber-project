import { RomView } from '../../src/rom/view';
import { decodeMapCodes, codesToEntries, logicOf, LOGIC_TABLE } from '../../src/rom/decode/tilemap';
import { decodeAnim, decodeMetasprite, animKey } from '../../src/rom/decode/anim';
import { decodeBombScript } from '../../src/rom/decode/bombscript';
import { decodeTileAnim, tileAnimKey, applyTileDma } from '../../src/rom/decode/tileanim';

/** ROM sintética de 4 MiB (endereços $C0–$FF válidos) com bytes escritos por endereço SNES. */
function rom(parts: Record<number, number[]>): RomView {
  const b = new Uint8Array(0x400000);
  for (const [a, bytes] of Object.entries(parts)) b.set(bytes, Number(a) - 0xc00000);
  return new RomView(b);
}
const le = (...w: number[]) => w.flatMap(v => [v & 0xff, (v >> 8) & 0xff]);

describe('mapa das arenas [ARN §2.3]', () => {
  it('1 byte ignorado; token = código | repetições extras << 10', () => {
    const r = rom({ 0xd00000: [0xee, ...le(5 | (2 << 10), 7, 0x3ff | (63 << 10))] });
    const m = decodeMapCodes(r, 0xd00000, 6);
    expect([...m.codes]).toEqual([5, 5, 5, 7, 0x3ff, 0x3ff]);
    expect(m.used).toBe(1 + 6);                   // o último token é consumido inteiro
  });
  it('código → entrada pela tabela; código → lógico por $C4:0892 (≥16 = $EC40)', () => {
    const r = rom({ 0xd10000: le(0x1c08, 0x1c02, 0x1404), [LOGIC_TABLE]: le(0x0000, 0xcc80, 0xec40) });
    expect([...codesToEntries(r, Uint16Array.from([2, 0, 1]), 0xd10000)]).toEqual([0x1404, 0x1c08, 0x1c02]);
    expect([logicOf(r, 0), logicOf(r, 1), logicOf(r, 2), logicOf(r, 16), logicOf(r, 0x3ff)]).toEqual([0, 0xcc80, 0xec40, 0xec40, 0xec40]);
  });
});

describe('animação e metasprite [ANI §2.1–2.2]', () => {
  const r = rom({
    0xd80000: [2, ...[0x00, 0x10, 0xd8], 12, 0xfe, 0x03, ...[0x00, 0x10, 0xd8], 255, 0, 0],
    0xd81000: [2, ...le(0xfff0, 0xffe8, 0x1004), ...le(8, 0, 0xc000 | (5 << 9) | 0x1ff)],
  });
  it('peças com sinal, flips, tamanho e soma de paleta', () => {
    expect(decodeMetasprite(r, 0xd81000)).toEqual([
      { dx: -16, dy: -24, tile: 4, hflip: false, vflip: false, big: true, palAdd: 0 },
      { dx: 8, dy: 0, tile: 0x1ff, hflip: true, vflip: true, big: false, palAdd: 5 },
    ]);
  });
  it('quadros: ponteiro, duração e deslocamento s8', () => {
    const a = decodeAnim(r, 0xd80000);
    expect(a.map(f => [f.dur, f.mx, f.my, f.pieces.length])).toEqual([[12, -2, 3, 2], [255, 0, 0, 2]]);
    expect(animKey(a)).toBe('12,-2,3:-16,-24,4,0,0,1,0;8,0,511,1,1,0,5|255,0,0:-16,-24,4,0,0,1,0;8,0,511,1,1,0,5');
  });
});

describe('script da bomba [ANI §5.1]', () => {
  it('FFFF = loop, FFFE = fim', () => {
    const r = rom({ 0xc15000: [...le(0x0b00), 20, ...le(0x0b02), 12, ...le(0xffff)], 0xc15100: [...le(0x0b08), 16, ...le(0xfffe)] });
    expect(decodeBombScript(r, 0xc15000)).toEqual({ loop: true, frames: [{ word: 0x0b00, dur: 20 }, { word: 0x0b02, dur: 12 }] });
    expect(decodeBombScript(r, 0xc15100)).toEqual({ loop: false, frames: [{ word: 0x0b08, dur: 16 }] });
  });
});

describe('script de tiles [ARN §3.1]', () => {
  it('$A0 espera, $80 loop, $90 fim, senão DMA [src:3]', () => {
    const r = rom({ 0xc36000: [...le(0x0e00), 0x00, 0x00, 0x9f, 0x7f, ...le(22), 0xa0, ...le(0), 0x80],
      0xc36100: [...le(0x20), 0x01, 0x00, 0x90, 0x7f, ...le(0), 0x90] });
    const a = decodeTileAnim(r, 0xc36000);
    expect(a).toEqual([{ kind: 'dma', vram: 0x0e00, src: 0x7f9f00 }, { kind: 'wait', frames: 22 }, { kind: 'loop' }]);
    expect(tileAnimKey(a)).toBe('d3584,8363776 w22 L');
    expect(tileAnimKey(decodeTileAnim(r, 0xc36100))).toBe('d32,8359936 E');
  });
  it('DMA: 64 bytes para a palavra dst e 64 de src+$200 para dst+$100', () => {
    const src = new Uint8Array(0x8000); src.fill(1, 0x1f00, 0x1f40); src.fill(2, 0x2100, 0x2140);
    const vram = new Uint8Array(0x8000);
    applyTileDma(vram, src, { vram: 0x0e00, src: 0x7f9f00 });
    expect([vram[0x1c00], vram[0x1c3f], vram[0x1c40], vram[0x1e00], vram[0x1e3f]]).toEqual([1, 1, 0, 2, 2]);
  });
});
