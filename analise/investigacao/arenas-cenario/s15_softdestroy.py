# sequencia de entradas do tilemap BG2 ($2000) e do grid logico ($2800) quando um soft block explode (arena N)
import sys
from ac import *
n = int(sys.argv[1]) if len(sys.argv) > 1 else 1
e = DEmu(); e.loadst('st_arena%02d' % n); e.run(2)
cells = [(1, 2), (1, 3), (1, 4), (2, 2), (3, 2), (1, 5)]
e.run(1, p0=['A']); e.run(1)
hist = {c: [] for c in cells}
for f in range(220):
    w = e.wram()
    for (r, c) in cells:
        a = r * 0x40 + c * 2
        hist[(r, c)].append((w[0x2000 + a] | w[0x2001 + a] << 8, w[0x2800 + a] | w[0x2801 + a] << 8))
    e.run(1)
for c in cells:
    runs = []
    for i, v in enumerate(hist[c]):
        if runs and runs[-1][0] == v: runs[-1][2] += 1
        else: runs.append([v, i, 1])
    print(c, ' | '.join('f%d: bg2=%04X log=%04X x%d' % (i, v[0], v[1], k) for v, i, k in runs))
