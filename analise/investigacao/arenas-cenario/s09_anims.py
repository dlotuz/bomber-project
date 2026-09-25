# mede animacoes de cenario: DMAs de VRAM por frame (fora os fixos) e cores do buffer de paleta $7E8E00 que mudam
import sys, collections
from ac import *
NF = int(sys.argv[1]) if len(sys.argv) > 1 else 480
FIXED_PCS = {'C40AB3', 'C40AE3', 'C40C90', 'C40DB2', 'C419DE', 'C18BF6', 'C188E2'}
for n in range(1, 11):
    e = DEmu(); e.loadst('st_arena%02d' % n); e.run(1)
    path = SCR + '/rom-arenas/anim%02d.log' % n
    e.log(path); e.dma(1)
    pals = []; bg1h = []
    f0 = None
    for i in range(NF):
        e.run(1); w = e.wram(); pals.append(w[0x8E00:0x9000]); bg1h.append(w[0x9EDF] | w[0x9EE0] << 8)
    e.close()
    # DMA
    ev = collections.defaultdict(list)
    for line in open(path):
        p = line.split()
        if p[1] != 'DMA': continue
        d = dict(kv.split('=') for kv in p[2:] if '=' in kv)
        if d['pc'] in FIXED_PCS or d['B'] != '2118': continue
        ev[(d['pc'], d['vram'], d['n'])].append((int(p[0]), d['A']))
    print('=== arena', n)
    for k, lst in sorted(ev.items(), key=lambda kv: kv[0][1]):
        frs = [f for f, _ in lst]; srcs = []
        for _, a in lst:
            if a not in srcs: srcs.append(a)
        dif = sorted(set(b - a for a, b in zip(frs, frs[1:])))
        print('  VRAM pc=%s dst=%s n=%s  vezes=%d  intervalos=%s  fontes(%d)=%s' % (k[0], k[1], k[2], len(frs), dif[:6], len(srcs), srcs[:8]))
    # paleta
    ch = collections.defaultdict(list)
    for i in range(1, NF):
        for c in range(256):
            if pals[i][2*c:2*c+2] != pals[i-1][2*c:2*c+2]: ch[c].append(i)
    groups = collections.defaultdict(list)
    for c, frs in ch.items():
        dif = sorted(set(b - a for a, b in zip(frs, frs[1:])))
        groups[(tuple(dif[:4]), len(frs))].append(c)
    for (dif, cnt), cols in sorted(groups.items(), key=lambda kv: kv[1][0]):
        print('  PAL cores %s  mudancas=%d intervalos=%s' % (cols, cnt, list(dif)))
    hs = sorted(set(bg1h))
    if len(hs) > 1: print('  BG1 HOFS varia', hs[:10], '...', len(hs), 'valores')
