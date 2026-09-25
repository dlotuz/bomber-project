# folha de metatiles 16x16 (entradas BG2) de uma arena a partir da ROM
import sys
from arena_rom import *
from ac import *
from PIL import Image
def meta(buf, pal, entry):
    im = Image.new('RGB', (16, 16)); px = im.load()
    t = entry & 0x3FF; p = (entry >> 10) & 7; hf = (entry >> 14) & 1; vf = (entry >> 15) & 1
    for sy in range(2):
        for sx in range(2):
            tile = decode_tile(buf, ((t + sx + 16 * sy) & 0x3FF) * 32, 4)
            for y in range(8):
                for x in range(8):
                    v = tile[y][x]; X = sx * 8 + x; Y = sy * 8 + y
                    if hf: X = 15 - X
                    if vf: Y = 15 - Y
                    px[X, Y] = snes_rgb(pal[p * 16 + v]) if v else (255, 0, 255)
    return im
if __name__ == '__main__':
    n = int(sys.argv[1]); entries = [int(a, 16) for a in sys.argv[2:]]
    buf, pal = arena_gfx(n - 1)
    M = Image.new('RGB', (18 * len(entries), 16), (40, 40, 40))
    for i, en in enumerate(entries): M.paste(meta(buf, pal, en), (18 * i, 0))
    M.resize((M.width * 4, 64), Image.NEAREST).save(OUT + '/render/tiles_a%02d.png' % n)
