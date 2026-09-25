from mec import *
e=TDbg(OUT+'st_r_normal.bin'); e.run(1)
tele(e,0,8,6); e.run(1); e.run(2,p0=['A'])
tele(e,1,8,5); tele(e,2,8,4); tele(e,3,8,7); tele(e,4,8,6); e.run(1)
prev=None
for i in range(900):
    k=e.step()
    s=(e.r8(0x1EA0), [e.obj(n)[:3].hex() for n in range(5)], [e.r8(0x1F34+2*n) for n in range(5)], e.r8(0x1BD))
    if s[:3]!=(prev[:3] if prev else None) or (s[3]!=prev[3] and s[3] in (0,14,15,1)): print('tick',e.ticks,'frame',e.nframes,s)
    prev=s
    if i==600: e.shot(OUT+'t103_600.png')
