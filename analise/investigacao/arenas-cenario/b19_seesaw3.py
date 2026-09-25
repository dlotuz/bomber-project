# Arena 9: P2 na ponta (3,4) segurando uma direcao durante o pulo
import sys
from harness import *
d = sys.argv[1] if len(sys.argv) > 1 else 'LEFT'
e = fresh(9); e.run(1)
for k in range(2, 5): setpos(e, k, 32 + 16 * k, 208)
clear_cells(e, [(4, 6), (5, 6)])
setpos(e, 1, 64, 80); setpos(e, 0, 96, 112); e.run(2)
last = None
for f in range(260):
    e.run(1, p0=['UP'] if f < 30 else [], p1=[d] if 22 <= f < 60 else [])
    w = e.wram()
    s = tuple(('%06X' % (w[b] | w[b+1] << 8 | w[b+2] << 16), pos(e, k)) for k, b in ((1, 0x400),))
    if s != last: print(f, s, cell_of(e, 1))
    last = s
