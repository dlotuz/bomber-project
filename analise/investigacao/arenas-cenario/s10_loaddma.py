# lista DMAs para VRAM < $4000 (tiles de BG) durante o carregamento de cada arena, ate 400 frames
from ac import *
import sys
arenas = [int(a) for a in sys.argv[1:]] or range(1, 11)
for n in arenas:
    e = DEmu(); e.load(open(SCR + '/rom-arenas/pre_load%02d.bin' % n, 'rb').read())
    p = SCR + '/rom-arenas/ldma%02d.log' % n; e.log(p); e.dma(1); e.run(400); e.close()
    seen = []
    for line in open(p):
        q = line.split(); d = dict(kv.split('=') for kv in q[2:] if '=' in kv)
        if d['B'] in ('2118', '2119') and int(d['vram'], 16) < 0x4000 and d['A'] not in ('C00B5E', 'C00D5E'):
            s = '%s pc=%s A=%s n=%s vram=%s' % (q[0], d['pc'], d['A'], d['n'], d['vram'])
            seen.append(s)
    print('== arena', n); print('\n'.join('  ' + s for s in seen[:40]))
