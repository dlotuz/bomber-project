import sys
from lib import *
from PIL import Image, ImageDraw
types = [int(x, 16) for x in sys.argv[1].split(',')]
e = new(); rows = []
for t in types:
    nf = mount(e, t); print('tipo %X montou em %s f' % (t, nf))
    for f in range(32): e.run(1, p0=['DOWN'])
    crops = []
    for d in [None, 'RIGHT', 'UP', 'LEFT', 'DOWN']:
        if d:
            for f in range(10): e.run(1, p0=[d])
            e.run(1)
        e.shot(OUT + '_tmp.png'); im = Image.open(OUT + '_tmp.png'); q = pl(e)
        crops.append(im.crop((q['x'] - 20, q['y'] - 34, q['x'] + 20, q['y'] + 10)).resize((120, 132), Image.NEAREST))
    rows.append(crops)
m = Image.new('RGB', (40 + 120 * 5, 132 * len(types)), (20, 20, 20)); d = ImageDraw.Draw(m)
for i, r in enumerate(rows):
    d.text((4, i * 132 + 60), 'tipo %X' % types[i], fill=(255, 255, 0))
    for j, c in enumerate(r): m.paste(c, (40 + j * 120, i * 132))
m.save(OUT + 'g_gallery_%s.png' % sys.argv[1].replace(',', ''))
