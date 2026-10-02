from plib import *
import sys
dash = sys.argv[1] == 'dash'
e = new('st_arena09')
p24 = e.r16(0x24) | e.r8(0x26) << 16
print('ptr24', hex(p24))
mount(e, 4) if dash else clear_soft(e)
def saw(e):
    base = (p24 & 0xFFFF) + (0x10000 if (p24 >> 16) == 0x7F else 0)
    return ' '.join(f'{e.r16(base + 3*0x40 + c*2):04X}' for c in range(3, 8))
for i in range(60):
    if pl(e)['y'] >= 79: break
    e.run(1, p0=['DOWN'])
e.run(1, p0=['RIGHT'])
print('pre', fmt(pl(e)), saw(e))
out = []
for f in range(70):
    e.run(1, p0=(['Y'] if f == 0 else []) if dash else ['RIGHT'])
    p = pl(e); out.append((f, fmt(p) + f" c0={p['c0']:04X} " + saw(e)))
print(compress(out))
