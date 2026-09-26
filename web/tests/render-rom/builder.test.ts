import { FrameBuilder, ORDER_OBJ, ORDER_PLAYER } from '../../src/render/rom/builder';
import type { ObjEntry } from '../../src/render/ppu';

const obj = (x: number): ObjEntry => ({ x, y: 0, size: 16, pal: 0, prio: 2, hflip: false, vflip: false, src: { tile: 0 } });
const blank = () => new FrameBuilder(new Uint16Array(1024), new Uint16Array(1024), new Uint16Array(256));

describe('FrameBuilder', () => {
  it('copia as bases e grava palavras por (col, lin) do mapa 32×32', () => {
    const bg2 = new Uint16Array(1024).fill(7);
    const b = new FrameBuilder(new Uint16Array(1024), bg2, new Uint16Array(256));
    b.setBg2(2, 1, 0x0b00);
    b.setBg1(31, 31, 0x1234);
    expect(b.bg2[34]).toBe(0x0b00);
    expect(b.bg1[1023]).toBe(0x1234);
    expect(bg2[34]).toBe(7);
    b.setBg2(32, 0, 1); b.setBg2(-1, 0, 1); b.setBg1(0, 32, 1);
    expect(Array.from(b.bg2).filter(w => w === 1)).toHaveLength(0);
    expect(Array.from(b.bg1).filter(w => w === 1)).toHaveLength(0);
  });
  it('cgram em 15 bits, só 0..255', () => {
    const b = blank();
    b.cgram(79, 0xffff);
    b.cgram(256, 5);
    expect(b.cg[79]).toBe(0x7fff);
    expect(b.cg.length).toBe(256);
  });
  it('bg1Scroll guarda o HOFS do campo (padrão 8)', () => {
    const b = blank();
    expect(b.hofs1).toBe(8);
    b.bg1Scroll(0x18);
    expect(b.hofs1).toBe(0x18);
  });
  it('OAM medida em st_arena01 [ANI §1.4]: P2 (207), P4 (207), P5 (128), P3 (48), P1 (47)', () => {
    const b = blank();
    b.sprite(obj(1), 47, ORDER_PLAYER + 0);
    b.sprite(obj(2), 207, ORDER_PLAYER + 1);
    b.sprite(obj(3), 48, ORDER_PLAYER + 2);
    b.sprite(obj(4), 207, ORDER_PLAYER + 3);
    b.sprite(obj(5), 128, ORDER_PLAYER + 4);
    expect(b.oam().map(e => e.x)).toEqual([2, 4, 5, 3, 1]);
  });
  it('mesmo Y: jogador antes de objeto; objetos na ordem de chegada', () => {
    const b = blank();
    b.sprite(obj(10), 100, ORDER_OBJ);
    b.sprite(obj(11), 100, ORDER_OBJ);
    b.sprite(obj(12), 100, ORDER_PLAYER + 4);
    expect(b.oam().map(e => e.x)).toEqual([12, 10, 11]);
  });
});
