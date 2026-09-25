from rec import *
def cell(w, c, r): a = 0x2000 + r*0x40 + c*2; return w[a] | w[a+1] << 8
def lcell(w, c, r): a = 0x2800 + r*0x40 + c*2; return w[a] | w[a+1] << 8
def bomb_run(state='st_arena05', col=6, row=3, fire=1, frames=180, cells=None, prep=None, tag=''):
    e = emu(False, state); e.run(30)
    X, Y = col*16, (row+2)*16
    e.w16(0x312, X); e.w16(0x316, Y); e.w16(0x326, Y); e.w8(0x344, fire)
    if prep: prep(e)
    e.run(2); e.run(3, p0=['A'])
    e.w16(0x312, 32); e.w16(0x316, 208); e.w16(0x326, 208)   # move P1 away
    cells = cells or [(col, row)]
    hist = {c: [] for c in cells}
    for k in range(frames):
        e.run(1); w = e.wram()
        for c in cells: hist[c].append((cell(w, *c), lcell(w, *c)))
    return e, hist
def runs(seq):
    out = []
    for v in seq:
        if out and out[-1][0] == v: out[-1][1] += 1
        else: out.append([v, 1])
    return out
