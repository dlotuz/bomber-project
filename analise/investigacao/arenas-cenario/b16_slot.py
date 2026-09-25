# Arena 8: bomba no pad (7,4); acompanha o objeto do caca-niquel ($14C0) e os itens que aparecem
import sys
from harness import *
pad_c = int(sys.argv[1]) if len(sys.argv) > 1 else 4
e = fresh(8); e.run(1)
for k in range(1, 5): setpos(e, k, 32 + 16 * k, 208)
print('pads', ['%04X/%04X' % (logic(e, 7, c), bg2(e, 7, c)) for c in (4, 8, 12)])
setpos(e, 0, 16 * pad_c, 16 * 7 + 32 - 16); e.run(3)     # (6,pad_c)
e.run(3, p0=['A']); e.run(1); setpos(e, 0, 224, 48)
O = 0x14C0; last = None; t0 = None
items_seen = {}
for f in range(1500):
    e.run(1); w = e.wram()
    p = w[O] | w[O+1] << 8 | w[O+2] << 16
    st = ('%06X' % p, w[O+0x26], w[O+0x36], w[O+0x46], w[O+0x22], w[O+0x32], w[O+0x42], w[O+0x18] & 7)
    if st[0] != (last[0] if last else None): print(f, st, 'pads', ['%04X' % logic(e, 7, c) for c in (4, 8, 12)])
    last = st
    for r in range(1, 12):
        for c in range(2, 15):
            L = logic(e, r, c)
            if (L & 0xFF00) == 0x0900 and (r, c) not in items_seen:
                items_seen[(r, c)] = (f, '%04X' % L)
print('itens:', sorted(items_seen.items(), key=lambda kv: kv[1][0]))
