from mec import *
e=TDbg("st_arena05"); e.run(1)
tele(e,2,14,11); tele(e,3,2,11); tele(e,4,12,11)
tele(e,0,12,1); tele(e,1,13,1); e.run(1)
e.w8(0x348,0); e.w8(0x362,2)
prev=None
for i in range(200):
    e.step(p0=['Y'] if i<2 else [])
    s=(e.obj(0)[:3].hex(),pos(e,0), e.obj(1)[:3].hex(), pos(e,1), e.obj(1)[0x42], e.obj(1)[0x44])
    if s!=prev: print(e.ticks, s)
    prev=s
