from plib import *
def bombs(e): return 'B' + str([(hex(o['rt'] & 0xffff), o['x'], o['y']) for o in objs(e) if o['rt'] >> 16 == 0xC1])
def walk_to(e, btn, cond, maxf=100):
    for i in range(maxf):
        if cond(pl(e)): return
        e.run(1, p0=[btn])
def occ(e): w = e.wram(); return ' '.join(f'{w[0x11040 + c*2] | w[0x11041 + c*2] << 8:04X}' for c in range(1, 10))
print('ptr38', hex(new().r16(0x38)), hex(new().r8(0x3a)), 'ptr28', hex(new().r16(0x28)), hex(new().r8(0x2a)))
e = new(); mount(e, 4)
e.w8(P1 + 0x4A, 1)
walk_to(e, 'RIGHT', lambda p: p['x'] >= 47)
print('occ antes A', occ(e))
e.run(2, p0=['A']); e.run(2)
print('occ bomba ', occ(e))
walk_to(e, 'LEFT', lambda p: p['x'] <= 31)
print('occ volta ', occ(e))
for f in range(30):
    btn = ['RIGHT'] if f < 6 else (['Y'] if f == 6 else [])
    e.run(1, p0=btn); p = pl(e)
    print(f, p['x'], p['v64'], bombs(e), occ(e))
