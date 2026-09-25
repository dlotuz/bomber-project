# Arena 6: o que muda em $2000/$2800/$3800 depois de uma explosao
from harness import *
e = fresh(6); e.run(1)
clear_row(e, 5); clear_col(e, 8)
for k in range(1, 5): setpos(e, k, 32 + 16 * k, 208)
setpos(e, 0, 128, 112); e.run(2)
w0 = e.wram()
e.run(3, p0=['A']); e.run(1); setpos(e, 0, 224, 48)
ev = []; prev = e.wram()
for f in range(900):
    e.run(1); w = e.wram()
    for base, nm in ((0x2000, 'bg2'), (0x2800, 'log'), (0x3800, 'flr')):
        for i in range(0, 13 * 0x40, 2):
            if w[base + i:base + i + 2] != prev[base + i:base + i + 2]:
                r, c = i // 0x40, (i % 0x40) // 2
                if c < 17 and not (nm == 'log' and (w[base+i] | w[base+i+1] << 8) < 8 and (prev[base+i] | prev[base+i+1] << 8) < 8):
                    ev.append('f%d %s (%d,%d) %04X->%04X' % (f, nm, r, c, prev[base+i] | prev[base+i+1] << 8, w[base+i] | w[base+i+1] << 8))
    prev = w
print('\n'.join(ev[:150])); print(len(ev))
e.shot(OUT + '/shots/a06_after.png')
