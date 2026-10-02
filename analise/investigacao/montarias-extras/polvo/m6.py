from plib import *
def bombs(e): return 'B' + str([(hex(o['rt'] & 0xffff), o['x'], o['y']) for o in objs(e) if o['rt'] >> 16 == 0xC1])
def walk_to(e, btn, cond, maxf=100):
    for i in range(maxf):
        if cond(pl(e)): return
        e.run(1, p0=[btn])
e = new(); mount(e, 4)
e.w8(P1 + 0x4A, 1)
walk_to(e, 'RIGHT', lambda p: p['x'] >= 47)
e.run(2, p0=['A']); e.run(2)
walk_to(e, 'LEFT', lambda p: p['x'] <= 31)
print('pre', fmt(pl(e)), bombs(e))
# empurra para a direita até chutar, depois Y
log = []
for f in range(60):
    btn = ['RIGHT'] if f < 6 else (['Y'] if f == 6 else [])
    e.run(1, p0=btn); p = pl(e)
    log.append((f, fmt(p) + ' ' + bombs(e) + ' g' + hex(e.r16(cellr(p['x'], p['y'])))))
print(compress(log))
