from mec import *
e=TDbg(OUT+'st_r_normal.bin'); e.run(1)
tele(e,0,8,6); e.run(1); e.run(2,p0=['A']); tele(e,0,2,1)
tele(e,1,8,5); tele(e,2,8,4); tele(e,3,8,7); tele(e,4,8,6); e.run(1)
for i in range(60): e.step()
e.w8(0x341,1); e.w8(0x342,2); e.run(2,p0=["A"])
for i in range(40): e.step()
print('tick',e.ticks,'(2,1)=',hex(grid(e)[1][2]), pos(e))
for i in range(120): 
    e.step()
    g=grid(e)[1][2]
    if g&0x1000: print('flame at P1 cell tick', e.ticks, e.obj(0)[:3].hex()); break
for i in range(10): e.step()
print(e.obj(0)[:3].hex())
