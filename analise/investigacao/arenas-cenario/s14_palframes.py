# estados distintos da paleta animada (16 cores) e onde cada estado esta na ROM
from ac import *
def findall(b):
    out = []; i = ROM.find(b)
    while i >= 0: out.append('%06X' % (0xC00000 + i)); i = ROM.find(b, i + 1)
    return out
for n, pal in ((9, 5), (10, 5), (1, 4)):
    e = DEmu(); e.loadst('st_arena%02d' % n); e.run(1)
    seq = []
    for f in range(200):
        e.run(1); w = e.wram(); b = w[0x8E00 + 32*pal: 0x8E00 + 32*pal + 32]
        if not seq or seq[-1][0] != b: seq.append([b, 1])
        else: seq[-1][1] += 1
    print('=== arena', n, 'paleta', pal)
    for b, k in seq[:10]:
        print('  x%-3d' % k, findall(b)[:3] or ('parcial: cores1-15 ' + str(findall(b[2:])[:3])))
