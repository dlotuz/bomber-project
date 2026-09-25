from mec import *
import sys
e=TDbg(OUT+'st_r_bad.bin'); e.run(1)
tele(e,0,8,5); e.run(1); e.run(2,p0=['A']); tele(e,0,2,1); tele(e,1,9,5); e.run(1)
prev=None
for i in range(700):
    btn={'p1':['RIGHT'] if (i//60)%2==0 else ['DOWN']}
    if i>400 and i%30<3: btn={'p1':['A']}
    k=e.step(**btn)
    o=e.obj(1)
    s=(o[:3].hex(), pos(e,1), e.r8(0x1EA0), o[0x41], o[0x42])
    if s[0]!=(prev[0] if prev else None) or i%40==0: print(e.ticks, s)
    prev=s
    if i in (250,300,420,450): e.shot(OUT+f't78_{i}.png')
