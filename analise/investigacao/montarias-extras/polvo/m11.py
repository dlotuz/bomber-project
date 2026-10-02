from plib import *
e = new(); mount(e, 4)
e.run(2, p0=['RIGHT'])
out = []
for f in range(66):
    e.run(1, p0=['Y'] if f == 0 else (['DOWN'] if f >= 50 else []))
    p = pl(e)
    out.append((f, fmt(p)))
    if p['x'] >= 160: e.w16(P1 + 0x12, p['x'] - 64)
print(compress(out))
