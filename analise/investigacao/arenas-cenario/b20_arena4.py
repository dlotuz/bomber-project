# Arena 4: jogador parado e andando sobre as casas 1DE0..1DEE (cantos)
from harness import *
e = fresh(4); e.run(1)
print('P1 parado em (1,2):')
last = None
for f in range(60):
    e.run(1); p = pos(e)
    if p != last: print(' ', f, p, '%06X' % (e.r16(0x300) | e.r8(0x302) << 16)); last = p
print('P1 anda para a direita (1,2)->(1,3)->(1,4):')
for f in range(40):
    e.run(1, p0=['RIGHT']); p = pos(e)
    if p != last: print(' ', f, p, cell_of(e), '%06X' % (e.r16(0x300) | e.r8(0x302) << 16)); last = p
print('P1 anda para baixo a partir de (1,2):')
e = fresh(4); e.run(1); last = None
for f in range(40):
    e.run(1, p0=['DOWN']); p = pos(e)
    if p != last: print(' ', f, p, cell_of(e), '%06X' % (e.r16(0x300) | e.r8(0x302) << 16)); last = p
