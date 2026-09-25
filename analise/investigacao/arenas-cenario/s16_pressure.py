# blocos de pressao: força o relogio para 1:02 e registra cada mudanca em $2000/$2800 (celula, frame, antes->depois)
import sys
from ac import *
n = int(sys.argv[1]) if len(sys.argv) > 1 else 1
NF = int(sys.argv[2]) if len(sys.argv) > 2 else 900
e = DEmu(); e.loadst('st_arena%02d' % n); e.run(2)
e.w8(0x1ED2, 1); e.w8(0x1ED0, 2)
prev = e.wram()
ev = []
for f in range(NF):
    e.run(1); w = e.wram()
    for r in range(13):
        for c in range(17):
            a = r * 0x40 + c * 2
            for base, nm in ((0x2000, 'bg2'), (0x2800, 'log')):
                o = w[base + a] | w[base + a + 1] << 8; p = prev[base + a] | prev[base + a + 1] << 8
                if o != p: ev.append((f + 1, r, c, nm, p, o, w[0x1ED2], w[0x1ED0]))
    prev = w
    if f == 400: e.shot(OUT + '/shots/pressure_a%02d.png' % n)
e.shot(OUT + '/shots/pressure_a%02d_end.png' % n)
for x in ev[:400]: print('f%d (%d,%d) %s %04X->%04X  relogio %d:%02d' % x)
print(len(ev))
