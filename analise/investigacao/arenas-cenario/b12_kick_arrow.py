# Arena 7: bomba chutada passando pela seta (3,4)->direita; segue o objeto da bomba
import sys
from harness import *
start_c = int(sys.argv[1]) if len(sys.argv) > 1 else 3
e = fresh(7); e.run(1)
clear_cells(e, [(3, c) for c in range(2, 15) if c not in (4, 12)] + [(r, 12) for r in range(4, 12) if r != 9] + [(r, 4) for r in range(1, 3)])
for k in range(1, 5): setpos(e, k, 32 + 16 * k, 208)
e.w8(0x34A, 0xFF)
setpos(e, 0, 16 * start_c, 80); e.run(4)
e.run(3, p0=['A']); e.run(2)
for f in range(24): e.run(1, p0=['LEFT'])
objs0 = {a for a, p, x, y in objects(e)}
last = None
for f in range(140):
    e.run(1, p0=['RIGHT'] if f < 12 else [])
    ob = [(hex(a), '%06X' % p, x, y) for a, p, x, y in objects(e, base=0x800, hi=0x1400) if x > 20]
    s = [(r, c) for r in range(1, 12) for c in range(2, 15) if logic(e, r, c) == 0xC900]
    key = (tuple(o[2:] for o in ob), tuple(s))
    if key != last: print(f, ob, s, 'P1', pos(e)); last = key
