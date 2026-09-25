"""Harness de montaria no Battle: coloca um ovo (item $30|tipo) na casa do P1 e monta."""
import mt
P1 = 0x300
def cell(x, y): return 0x2800 + (y // 16 - 2) * 0x40 + (x // 16) * 2
def clear_soft(e):
    for r in range(14):
        for c in range(16):
            a = 0x2800 + r * 0x40 + c * 2
            if e.r16(a) == 0xCC80: e.w16(a, 0)
def pl(e, b=P1):
    w = e.wram()
    return dict(rt=w[b+2] << 16 | w[b+1] << 8 | w[b], x=w[b+0x12] | w[b+0x13] << 8, y=w[b+0x16] | w[b+0x17] << 8,
                t5c=w[b+0x5c], r5d=w[b+0x5d], f51=w[b+0x51], f32=w[b+0x32], spd=w[b+0x40], e8=w[b+0xe8], c2=w[b+0xc2] | w[b+0xc3] << 8,
                i96=w[b+0x96] | w[b+0x97] << 8, d=w[b+0x62], a1=w[b+0x61])
def mount(e, t, state='st_arena01', clear=True, maxf=200):
    e.load(open(mt.EST + state + '.bin', 'rb').read()); e.run(1)
    if clear: clear_soft(e)
    p = pl(e)
    e.w16(cell(p["x"], p["y"]), 0x0940 + (0x30 | t))
    seq = []
    for f in range(maxf):
        e.run(1); p = pl(e); seq.append(p)
        if p['r5d'] and p['rt'] == 0xC2141C: break
    return seq
