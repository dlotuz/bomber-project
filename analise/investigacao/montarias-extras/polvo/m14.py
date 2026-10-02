from plib import *
e = new('st_arena09')
mount(e, 4)
def saw(e): return ' '.join(f'{e.r16(0x2000 + 3*0x40 + c*2):04X}' for c in range(3, 8))
for i in range(80):
    if pl(e)['x'] >= 95: break
    e.run(1, p0=['RIGHT'])
e.run(1, p0=['DOWN'])
print('pre', fmt(pl(e)), saw(e))
out = []
for f in range(40):
    e.run(1, p0=['Y'] if f == 0 else [])
    p = pl(e); out.append((f, fmt(p) + f" c0={p['c0']:04X} " + saw(e)))
print(compress(out))
