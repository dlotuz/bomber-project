# Arena 7: bomba chutada PARA BAIXO pela coluna 4, entrando na seta (3,4) que aponta para a direita
from harness import *
e = fresh(7); e.run(1)
clear_cells(e, [(3, c) for c in range(2, 15) if c not in (4, 12)] + [(r, 4) for r in range(1, 12) if r not in (3, 9)])
for k in range(1, 5): setpos(e, k, 32 + 16 * k, 208)
e.w8(0x34A, 0xFF)
setpos(e, 0, 64, 64); e.run(4)          # (2,4)
e.run(3, p0=['A']); e.run(2)
for f in range(24): e.run(1, p0=['UP'])
print('P1', pos(e), 'bomba(2,4)=%04X' % logic(e, 2, 4))
last = None
for f in range(160):
    e.run(1, p0=['DOWN'] if f < 14 else [])
    ob = [('%06X' % p, x, y) for a, p, x, y in objects(e, base=0x800, hi=0x1400) if x > 20]
    s = [(r, c) for r in range(1, 12) for c in range(2, 15) if logic(e, r, c) == 0xC900]
    key = (tuple(ob), tuple(s))
    if key != last: print(f, ob, s); last = key
