# sequencia de valores das cores animadas (buffer $7E8E00) por arena
from ac import *
for n, cols in ((1, [79]), (9, [92, 93, 94, 95]), (10, [84, 85, 86, 87, 88]), (2, [79])):
    e = DEmu(); e.loadst('st_arena%02d' % n); e.run(1)
    hist = {c: [] for c in cols}
    for f in range(240):
        e.run(1); w = e.wram()
        for c in cols: hist[c].append(w[0x8E00 + 2*c] | w[0x8E01 + 2*c] << 8)
    print('=== arena', n)
    for c in cols:
        runs = []
        for v in hist[c]:
            if runs and runs[-1][0] == v: runs[-1][1] += 1
            else: runs.append([v, 1])
        print('  cor %d:' % c, ' '.join('%04X x%d' % (v, k) for v, k in runs[:20]))
