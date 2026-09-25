from mec import *
e=TDbg("st_arena05"); e.run(1)
print([hex(e.r8(a)) for a in range(0x1EC8,0x1EDA)])
e.w8(0x1ED2,1); e.w8(0x1ED0,3)
for i in range(400):
    e.step()
    if i%50==0: print(e.ticks, [e.r8(a) for a in (0x1ED2,0x1ED0,0x1ECE)], e.obj(0)[:3].hex(), e.r8(0x1EA0))
print(gridstr(e))
e.shot(OUT+'t71.png')
