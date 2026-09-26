import { inflateSync } from 'node:zlib';
import { encodePng } from './png';

describe('encodePng', () => {
  it('assinatura, IHDR, IDAT com filtro 0 e IEND', () => {
    const png = encodePng(2, 1, new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]));
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.toString('ascii', 12, 16)).toBe('IHDR');
    expect([png.readUInt32BE(16), png.readUInt32BE(20), png[24], png[25]]).toEqual([2, 1, 8, 6]);
    const len = png.readUInt32BE(33);
    expect(png.toString('ascii', 37, 41)).toBe('IDAT');
    expect([...inflateSync(png.subarray(41, 41 + len))]).toEqual([0, 255, 0, 0, 255, 0, 255, 0, 255]);
    expect(png.readUInt32BE(png.length - 4)).toBe(0xae426082);
  });
});
