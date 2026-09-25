# Arena 3: jogador encostando no orb parado; estado do jogador
from harness import *
e = fresh(3); e.run(1)
def st(e):
    w = e.wram(); b = 0x300
    return '%06X' % (w[b] | w[b+1] << 8 | w[b+2] << 16), 'X=%d Y=%d' % pos(e), '+24=%02X +96=%04X +C0=%04X vivos1EA0=%02X bombs=%d fire=%d spd=%d' % (w[b+0x24], w[b+0x96] | w[b+0x97] << 8, w[b+0xC0] | w[b+0xC1] << 8, w[0x1EA0], w[b+0x41], w[b+0x44], w[b+0x40])
print('antes', st(e))
setpos(e, 0, 96 + 7, 112)   # 7 px de distancia
last = None
for f in range(200):
    e.run(1); s = st(e)
    if s != last: print(f, s); last = s
