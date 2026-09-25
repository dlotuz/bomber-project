# Arena 3: bomba ao lado do orb em (5,6); rastreia o orb depois da explosao
from harness import *
e = fresh(3); e.run(1)
setpos(e, 0, 112, 112); e.run(2)
print('P1 cell', cell_of(e), 'log(5,6)=%04X' % logic(e, 5, 6))
e.run(3, p0=['A']); e.run(1)
print('bomba?', '%04X' % logic(e, 5, 7))
setpos(e, 0, 32, 48)
last = None
for f in range(400):
    e.run(1); w = e.wram(); a = 0x1580
    p = w[a] | w[a+1] << 8 | w[a+2] << 16
    st = ('%06X' % p, w[a+0x12] | w[a+0x13] << 8, w[a+0x16] | w[a+0x17] << 8, w[a+0x1D])
    if st != last:
        print(f, st, 'log(5,5..8)=', ['%04X' % logic(e, 5, c) for c in range(3, 10)])
        last = st
