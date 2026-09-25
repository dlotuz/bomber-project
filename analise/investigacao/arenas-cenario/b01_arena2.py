# Arena 2: efeito de $1EB6 (0/1/2) na velocidade do jogador e no pavio da bomba
from harness import *
for mode in (0, 1, 2):
    e = fresh(2); clear_row(e, 1); e.run(1)
    e.w8(0x1EB6, mode)
    xs = []
    for f in range(48):
        e.run(1, p0=['RIGHT']); e.w8(0x1EB6, mode); xs.append(subpos(e)[0])
    d = [b - a for a, b in zip(xs, xs[1:])]
    px = (xs[-1] - xs[0]) / (len(xs) - 1) / 256
    r, c = cell_of(e)
    e.run(3, p0=['A']); f0 = None; f = 0
    for f in range(900):
        e.w8(0x1EB6, mode); e.run(1)
        L = logic(e, r, c)
        if f0 is None and L == 0xC900: f0 = f
        if f0 is not None and (L & 0xFF00) == 0x1000: break
    print('modo %d: velocidade %.4f px/frame (deltas em 1/256 px: %s)  pavio %s frames' % (mode, px, sorted(set(d)), (f - f0) if f0 is not None else None))
