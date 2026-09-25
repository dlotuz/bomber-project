# animacao de tiles de BG (C40A6B: DMA por frame de 16x16 do buffer $7F8000 p/ VRAM): sequencia de quadros e duracao
import sys, collections
from ac import *
NF = int(sys.argv[1]) if len(sys.argv) > 1 else 600
for n in range(1, 11):
    e = DEmu(); e.loadst('st_arena%02d' % n); e.run(1)
    path = SCR + '/rom-arenas/tanim%02d.log' % n
    e.log(path); e.dma(1); e.run(NF); e.close()
    seq = collections.defaultdict(list)
    for line in open(path):
        p = line.split()
        if p[1] != 'DMA': continue
        d = dict(kv.split('=') for kv in p[2:] if '=' in kv)
        if d['pc'] not in ('C40AB3', 'C40B22', 'C40B4F', 'C40B7C', 'C40BA9') or d['A'] in ('C00B5E', 'C00D5E'): continue
        vr = int(d['vram'], 16); src = int(d['A'], 16)
        tile16 = vr // 16   # numero do tile 8x8
        seq[(d['pc'], vr)].append((int(p[0]), src))
    print('=== arena', n)
    for (pc, vr), lst in sorted(seq.items()):
        runs = []
        for f, s in lst:
            if runs and runs[-1][0] == s: runs[-1][1] += 1
            else: runs.append([s, 1])
        frames = [(('%06X' % s)[2:], (s - 0x7F8000) // 32 if s >= 0x7F8000 else -1, c) for s, c in runs]
        print('  pc=%s VRAM=%04X (tile %03X)  quadros(src, tile, dur):' % (pc, vr, vr // 16), frames[:14])
