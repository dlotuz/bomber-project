# Arena 3: rastreia os 2 objetos "orb" ($1520, $1580): posicao, rotina e mudancas
from harness import *
e = fresh(3); last = {}
for f in range(3000):
    e.run(1); w = e.wram()
    for a in (0x1520, 0x1580):
        p = w[a] | w[a+1] << 8 | w[a+2] << 16
        st = (p, w[a+0x12] | w[a+0x13] << 8, w[a+0x16] | w[a+0x17] << 8)
        if last.get(a) != st:
            if f < 3000: print(f, hex(a), '%06X' % p, 'X=%d Y=%d' % st[1:], 'd1D=%02X 24=%02X 26=%02X 20=%04X 22=%04X' % (w[a+0x1D], w[a+0x24], w[a+0x26], w[a+0x20] | w[a+0x21] << 8, w[a+0x22] | w[a+0x23] << 8))
            last[a] = st
