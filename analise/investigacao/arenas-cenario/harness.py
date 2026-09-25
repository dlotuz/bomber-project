"""utilitarios para medir mecanicas: limpar casas, posicionar jogador, ler posicao"""
from ac import *
P = lambda k: 0x300 + 0x100 * k
def cell_addr(r, c): return r * 0x40 + c * 2
def clear_cells(e, cells, floor_from=0x3800):
    w = e.wram()
    for (r, c) in cells:
        a = cell_addr(r, c)
        e.w16(0x2800 + a, 0); e.w16(0x2000 + a, w[floor_from + a] | w[floor_from + a + 1] << 8)
def clear_row(e, r, c0=2, c1=14): clear_cells(e, [(r, c) for c in range(c0, c1 + 1)])
def clear_col(e, c, r0=1, r1=11): clear_cells(e, [(r, c) for r in range(r0, r1 + 1)])
def pos(e, k=0): return e.r16(P(k) + 0x12), e.r16(P(k) + 0x16)
def subpos(e, k=0):
    w = e.wram(); b = P(k)
    return (w[b + 0x11] | w[b + 0x12] << 8 | w[b + 0x13] << 16), (w[b + 0x15] | w[b + 0x16] << 8 | w[b + 0x17] << 16)
def setpos(e, k, x, y):
    e.w16(P(k) + 0x12, x); e.w16(P(k) + 0x16, y); e.w8(P(k) + 0x11, 0); e.w8(P(k) + 0x15, 0)
def logic(e, r, c): return e.r16(0x2800 + cell_addr(r, c))
def bg2(e, r, c): return e.r16(0x2000 + cell_addr(r, c))
def fresh(n):
    e = DEmu(); e.load(open(SCR + '/rom-arenas/ready%02d.bin' % n, 'rb').read()); return e
def park_others(e, keep=(0,)):
    """joga os outros jogadores para longe? (nao mexe: ficam parados nos spawns)"""
    pass
def cell_of(e, k=0):
    x, y = pos(e, k); return (y + 8) // 16 - 2, (x + 8) // 16
def objects(e, lo=0x800, hi=0x2000, step=0x60, base=0x1400):
    w = e.wram(); out = []
    for a in range(base, hi, step):
        p = w[a] | w[a+1] << 8 | w[a+2] << 16
        if (p >> 16) in (0xC1, 0xC2, 0xC3, 0xC4) and (p & 0xFFFF) not in (0x0000, 0x4E6F):
            out.append((a, p, w[a+0x12] | w[a+0x13] << 8, w[a+0x16] | w[a+0x17] << 8))
    return out
