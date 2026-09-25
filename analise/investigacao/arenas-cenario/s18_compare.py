# compara render da ROM x screenshot do emulador (rodada 1 do boot). Gera lado a lado + mascara de diferenca
from ac import *
from PIL import Image, ImageChops
import sys
tot = []
for n in range(1, 11):
    a = Image.open(OUT + '/render/arena_%02d_rom.png' % n).convert('RGB')
    b = Image.open(OUT + '/render/arena_%02d_emu.png' % n).convert('RGB')
    pa, pb = a.load(), b.load()
    diff = Image.new('RGB', (256, 224)); pd = diff.load(); nd = 0; nd_field = 0; nd_hud = 0
    for y in range(224):
        for x in range(256):
            if tuple(v >> 3 for v in pa[x, y]) != tuple(v >> 3 for v in pb[x, y]):
                nd += 1; pd[x, y] = (255, 0, 255)
                if y < 24: nd_hud += 1
                else: nd_field += 1
            else:
                g = sum(pa[x, y]) // 6; pd[x, y] = (g, g, g)
    M = Image.new('RGB', (256 * 3 + 8, 224), (0, 0, 0)); M.paste(a, (0, 0)); M.paste(b, (260, 0)); M.paste(diff, (520, 0))
    M.save(OUT + '/render/cmp_%02d.png' % n)
    print('arena %2d: pixels diferentes %5d (%.1f%%)  HUD %d  campo %d' % (n, nd, 100 * nd / (256 * 224), nd_hud, nd_field))
