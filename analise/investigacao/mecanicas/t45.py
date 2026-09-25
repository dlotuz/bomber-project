from mec import *
import sys
e=TDbg("st_arena05"); e.run(1)
tele(e,2,14,11); tele(e,3,2,11); tele(e,4,12,11)
tele(e,0,3,3); tele(e,1,4,3); e.run(1)
e.w8(0x348,0)  # sem soco: só P
e.w8(0x362,2)
prev=None
for i in range(150):
    e.step(p0=['Y'] if i<2 else [])
    s=('P1',e.obj(0)[:3].hex(),pos(e,0), 'P2', e.obj(1)[:3].hex(), pos(e,1), 'P2 b/f', e.obj(1)[0x42],e.obj(1)[0x44], hex(e.r16(0x4C0)), e.r8(0x4DA))
    if s!=prev: print(e.ticks, s)
    prev=s
    if i in (3,6,10,20): e.shot(OUT+f't45_{i}.png')
