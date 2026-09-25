# Arena 9: P2 parado na ponta (3,4); P1 sobe pela coluna 6 ate a outra ponta (3,6). Rastreia P1 e P2.
from harness import *
e = fresh(9); e.run(1)
for k in range(2, 5): setpos(e, k, 32 + 16 * k, 208)
clear_cells(e, [(4, 6), (5, 6)])
setpos(e, 1, 64, 80)          # P2 na ponta esquerda
setpos(e, 0, 96, 112); e.run(2)
last = None
for f in range(200):
    e.run(1, p0=['UP'] if f < 30 else [])
    w = e.wram()
    s = tuple(('%06X' % (w[b] | w[b+1] << 8 | w[b+2] << 16), pos(e, k)) for k, b in ((0, 0x300), (1, 0x400)))
    tiles = [('%04X' % bg2(e, 3, c))[1:] for c in (4, 5, 6)]
    if s != last: print(f, s, tiles)
    last = s
