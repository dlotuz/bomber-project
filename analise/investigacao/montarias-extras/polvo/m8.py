import os
os.environ['SNES9X_CORE'] = '/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/cores/rom-arenas/snes9x/libretro/snes9x_libretro.dylib'
from plib import *
def walk_to(e, btn, cond, maxf=100):
    for i in range(maxf):
        if cond(pl(e)): return
        e.run(1, p0=[btn])
e = new(); mount(e, 4)
e.w8(P1 + 0x4A, 1); print('kick', e.r8(P1+0x4A))
walk_to(e, 'RIGHT', lambda p: p['x'] >= 47)
e.run(2, p0=['A']); e.run(2)
walk_to(e, 'LEFT', lambda p: p['x'] <= 31)
for f in range(11):
    btn = ['RIGHT'] if f < 6 else (['Y'] if f == 6 else [])
    e.run(1, p0=btn)
L = e.lib
L.dbg_open(b'/tmp/polvo_w.log')
L.dbg_add(4, 0xC23287, 0xC2333D); L.dbg_add(4, 0xC23566, 0xC23592)
L.dbg_set_trace(0)
e.run(1)
L.dbg_close()
print(fmt(pl(e)))
