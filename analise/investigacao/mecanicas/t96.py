from mec import *
e=TDbg(OUT+'st_r_normal.bin'); e.run(1)
tele(e,0,8,6); e.run(1); e.run(2,p0=['A']); tele(e,0,2,1)
tele(e,1,8,5); tele(e,2,8,4); tele(e,3,8,7); tele(e,4,8,6); e.run(1)
for i in range(60): e.step()
e.w8(0x341,1); e.w8(0x342,2); e.run(2,p0=["A"])   # P1 coloca bomba em (2,1) e fica em cima -> morre ~127 ticks depois
prev=None
for i in range(1200):
    k=e.step()
    s=(e.r8(0x1EA0), [e.obj(n)[:3].hex() for n in range(5)], [e.r8(0x1F34+2*n) for n in range(5)], e.r8(0x1BD))
    if s[:3]!=(prev[:3] if prev else None): print('tick',e.ticks,s)
    prev=s
