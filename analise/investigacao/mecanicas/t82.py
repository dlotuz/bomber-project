from mec import *
e=TDbg(OUT+'st_badactive.bin'); e.run(1)
for i in range(40): e.step()
tele(e,0,6,5)
e.run(1)
prev=None
for i in range(700):
    k=e.step(p1=['A'] if i%10<2 else [])
    s=(e.obj(0)[:3].hex(), e.obj(1)[:3].hex(), pos(e,0), pos(e,1), e.r8(0x1EA0), hex(e.r16(0x3C0)), hex(e.r16(0x4C0)))
    if s[:2]!=(prev[:2] if prev else None) : print(e.ticks, s)
    prev=s
e.shot(OUT+'t82.png')
