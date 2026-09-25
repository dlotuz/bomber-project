# renderiza BG1/BG2/BG3 de cada savestate de arena, separadamente (mapa inteiro)
from ac import *
from PIL import Image
import os
os.makedirs(OUT + '/layers', exist_ok=True)
for n in range(1, 11):
    st = open(EST + '/st_arena%02d.bin' % n, 'rb').read(); p = PPUState(st)
    for i, bpp in ((0, 4), (1, 4), (2, 2)):
        bg = p.bg[i]
        cols = 64 if bg['SCSize'] in (1, 3) else 32; rows = 64 if bg['SCSize'] in (2, 3) else 32
        im = render_bg(p.vram, p.cg, bg, bpp, bg['BGSize'], cols, rows)
        bgc = Image.new('RGBA', im.size, (255, 0, 255, 255)); bgc.alpha_composite(im)
        bgc.convert('RGB').save(OUT + '/layers/a%02d_bg%d.png' % (n, i + 1))
    print(n, 'BG3 SC', hex(p.bg[2]['SCBase']), p.bg[2]['SCSize'], 'HDMAEN', hex(p.reg(0x420C)), 'col0', hex(p.cg[0]))
