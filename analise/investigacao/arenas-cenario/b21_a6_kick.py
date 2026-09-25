# Arena 6: bomba chutada passando por piso 1C08 (caveirinhas) e por 1C0A (listras) e 1C0C
import sys
from harness import *
tile = int(sys.argv[1], 16)
e = fresh(6); e.run(1); clear_row(e, 5)
for k in range(1, 5): setpos(e, k, 32 + 16 * k, 208)
a = cell_addr(5, 6); e.w16(0x2000 + a, tile); e.w16(0x3800 + a, tile)
e.w8(0x34A, 0xFF)
setpos(e, 0, 64, 112); e.run(4); e.run(3, p0=['A']); e.run(2)   # bomba em (5,4)
for f in range(24): e.run(1, p0=['LEFT'])
last = None
for f in range(150):
    e.run(1, p0=['RIGHT'] if f < 14 else [])
    ob = [('%06X' % p, x, y) for a_, p, x, y in objects(e, base=0x800, hi=0x1400) if x > 20]
    s = [(r, c) for r in range(1, 12) for c in range(2, 15) if logic(e, r, c) == 0xC900]
    key = (tuple(ob), tuple(s))
    if key != last and (f % 3 == 0 or len(ob) == 0 or (ob and ob[0][0] != 'C135E1')): print(f, ob, s)
    last = key
