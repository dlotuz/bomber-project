"""Bateria (port de montarias-e-telas/mount_battery.py) para os tipos da senha."""
import sys, json
from lib import *
types = [int(x, 16) for x in sys.argv[1].split(',')]
e = new(); out = {}
def objs_new(before): return [(hex(o['a']), hex(o['rt']), o['x'], o['y']) for o in objs(e) if (o['a'], o['rt']) not in before]
for t in types:
    r = {}; mount(e, t); base = e.save()
    xs = []
    for f in range(120): e.run(1, p0=['RIGHT']); xs.append(pl(e)['x'])
    r['vel'] = round((xs[119] - xs[39]) / 80, 3)
    e.load(base); e.w16(cell(64, 48), 0xCC80)
    for f in range(60): e.run(1, p0=['RIGHT'])
    r['T2_soft_x'] = pl(e)['x']; r['T2_cell'] = hex(e.r16(cell(64, 48)))
    e.load(base)
    for f in range(16): e.run(1, p0=['RIGHT'])
    for f in range(40): e.run(1, p0=['DOWN'])
    p = pl(e); r['T3_pilar_xy'] = (p['x'], p['y'])
    e.load(base); e.run(3, p0=['A']); e.run(2)
    for f in range(48): e.run(1, p0=['RIGHT'])
    tr = []
    for f in range(40): e.run(1, p0=['LEFT']); tr.append(pl(e)['x'])
    r['T4_bomba_x'] = tr[::4]; r['T4_g32'] = hex(e.r16(cell(32, 48))); r['T4_g16'] = hex(e.r16(cell(16, 48)))
    for b in ['B', 'Y', 'X', 'L', 'R']:
        e.load(base); before = [(o['a'], o['rt']) for o in objs(e)]; rts = []; pos = []
        for f in range(50):
            e.run(1, p0=(['RIGHT'] if f < 30 else []) + ([b] if f in (5, 6, 7) else []))
            p = pl(e); pos.append((p['x'], p['y']))
            if not rts or rts[-1] != hex(p['rt']): rts.append(hex(p['rt']))
        r['T5_' + b] = dict(rts=rts, pos10=pos[::10], novos=objs_new(before)[:4])
    e.load(base); e.run(3, p0=['A']); hist = []
    for f in range(400):
        e.run(1); p = pl(e); hist.append((f, hex(p['rt']), p['r5d'], p['t5c'], p['i96'], p['x'], p['y']))
    ch = []
    for h in hist:
        if not ch or ch[-1][1:5] != h[1:5]: ch.append(h)
    r['T6_hit'] = ch[:10]
    out[hex(t)] = r; print(hex(t), json.dumps(r)); sys.stdout.flush()
json.dump(out, open(OUT + 'battery_%s.json' % sys.argv[1].replace(',', ''), 'w'), indent=1)
