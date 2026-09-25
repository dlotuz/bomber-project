# por arena: BG1 (16x16, linhas 0-14), BG2 (linhas 0-14), BG3 (area visivel), lado a lado
from ac import *
from PIL import Image
for n in range(1, 11):
    st = open(EST + '/st_arena%02d.bin' % n, 'rb').read(); p = PPUState(st)
    ims = []
    for i, bpp in ((0, 4), (1, 4), (2, 2)):
        bg = dict(p.bg[i]); bg['BGSize'] = 1
        im = render_bg(p.vram, p.cg, bg, bpp, True, 16, 15 if i < 2 else 14)
        c = Image.new('RGBA', im.size, (255, 0, 255, 255)); c.alpha_composite(im); ims.append(c.convert('RGB'))
    M = Image.new('RGB', (256 * 3 + 20, 240), (30, 30, 30))
    for k, im in enumerate(ims): M.paste(im, (k * 266, 0))
    M.save(OUT + '/layers/a%02d_field.png' % n)
