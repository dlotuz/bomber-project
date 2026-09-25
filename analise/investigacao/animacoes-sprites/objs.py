from bomb_seq import *
SKIP = (0, 0xC30000, 0xC34EE6, 0xC34E6F, 0xC10000)
def objs(e):
    w = e.wram(); r = []
    for n in range(32):
        o = 0x800 + n*0x60; rt = w[o] | w[o+1] << 8 | w[o+2] << 16
        if rt not in SKIP:
            r.append(dict(n=n, rt=rt, anim=(w[o+8] | w[o+9] << 8 | w[o+10] << 16) - 1, idx=w[o+0xC], tmr=w[o+0xD],
                          x=w[o+0x12] | w[o+0x13] << 8, y=w[o+0x16] | w[o+0x17] << 8, st=w[o+0x1C]))
    return r
def smalloam(e):
    return [(x, y, t, a) for (j, x, y, t, a, b) in oam(e) if y < 224 and y != 0xE0 and not b]
