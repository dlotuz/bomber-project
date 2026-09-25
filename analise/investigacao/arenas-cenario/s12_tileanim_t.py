# duracao em frames de cada quadro de animacao de tile (a partir dos logs tanimNN.log do s11)
import collections
from ac import *
for n in range(1, 11):
    seq = collections.defaultdict(list)
    for line in open(SCR + '/rom-arenas/tanim%02d.log' % n):
        p = line.split()
        if p[1] != 'DMA': continue
        d = dict(kv.split('=') for kv in p[2:] if '=' in kv)
        if d['pc'] != 'C40AB3' or d['A'] in ('C00B5E',): continue
        seq[int(d['vram'], 16)].append((int(p[0]), int(d['A'], 16)))
    if not seq: continue
    print('=== arena', n)
    for vr, lst in sorted(seq.items()):
        # quadro visivel = ultima fonte escrita; mede a duracao em frames entre trocas de fonte
        ch = [(f, s) for i, (f, s) in enumerate(lst) if i == 0 or s != lst[i-1][1]]
        durs = [b[0] - a[0] for a, b in zip(ch, ch[1:])]
        order = []
        for f, s in ch:
            t = (s - 0x7F8000) // 32
            if t not in order: order.append(t)
        upd = sorted(set(b[0] - a[0] for a, b in zip(lst, lst[1:])))
        print('  VRAM %04X (tile %03X): ciclo de tiles-fonte %s  duracoes %s  (DMA a cada %s frames)' % (vr, vr // 16, ['%03X' % t for t in order], sorted(set(durs))[:5], upd[:4]))
