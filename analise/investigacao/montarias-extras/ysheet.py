"""uso: ysheet.py <tipo> <tag> <roteiro>  roteiro: 'RIGHT:20,A:3,_:5,Y:3,_:60' ; quadros a cada 4 f."""
import sys
from lib import *
from PIL import Image, ImageDraw
t = int(sys.argv[1], 16); tag = sys.argv[2]
e = new(); mount(e, t, clear=len(sys.argv) < 5)
shots = []; log = []
f = 0
for step in sys.argv[3].split(','):
    b, n = step.split(':')
    for i in range(int(n)):
        e.run(1, p0=[] if b == '_' else b.split('+')); f += 1
        p = pl(e); log.append((f, hex(p['rt']), p['x'], p['y'], p['r5d'], p['t5c']))
        if f % 4 == 0:
            e.shot(OUT + '_t.png'); im = Image.open(OUT + '_t.png').copy()
            ImageDraw.Draw(im).text((2, 2), str(f), fill=(255, 255, 0)); shots.append(im)
cols = 8; w, h = shots[0].size; rows = (len(shots) + cols - 1) // cols
m = Image.new('RGB', (w * cols, h * rows))
for i, im in enumerate(shots): m.paste(im, ((i % cols) * w, (i // cols) * h))
m.save(OUT + f'y_{tag}.png')
ch = []
for l in log:
    if not ch or ch[-1][1:] != l[1:]: ch.append(l)
print(ch); print('objs', [(hex(o['a']), hex(o['rt']), o['x'], o['y']) for o in objs(e)])
