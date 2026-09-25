# Arena 3: efeito do toque no orb: estado do jogador e controle (segura DIREITA o tempo todo)
from harness import *
e = fresh(3); e.run(1)
e.w8(0x341, 3); e.w8(0x342, 3); e.w8(0x344, 2)   # 3 bombas, fogo 2 -> ver se perde itens
setpos(e, 0, 96 + 7, 112)
last = None; t_routine = []
for f in range(260):
    e.run(1, p0=['DOWN'] if f > 5 else [])
    w = e.wram(); b = 0x300
    s = ('%06X' % (w[b] | w[b+1] << 8 | w[b+2] << 16), pos(e), w[b+0x41], w[b+0x42], w[b+0x44], w[0x1EA0])
    if s != last: print(f, s, '+96=%d' % (w[b+0x96] | w[b+0x97] << 8)); last = s
    if f == 30: e.shot(OUT + '/shots/a03_touch.png')
