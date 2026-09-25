from mec import *
import sys
btn=sys.argv[1]
e=TDbg("st_arena05"); e.run(1)
tele(e,2,14,11); tele(e,1,14,9); tele(e,3,2,11); tele(e,4,12,11)
tele(e,0,4,1); e.run(1); e.run(2,p0=['A']); tele(e,0,3,1); e.run(1)
e.w8(0x362,2); e.w8(0x361,2)
def bomb(e):
    w=e.wram(); a=0x860
    return (w[a:a+3][::-1].hex(), e.r16(a+0x12), e.r16(a+0x16), w[a+0x1A], w[a+0x1C], w[a+0x1D], [hex(x) for x in w[a+0x20:a+0x30]])
prev=None
for i in range(80):
    k=e.step(p0=[btn] if i<3 else [])
    s=(bomb(e), ''.join('B' if (v&0xEFC0)==0xC900 else '.' for v in grid(e)[1]), pos(e))
    if s!=prev: print(e.ticks, s)
    prev=s
