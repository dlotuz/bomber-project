from mec import *
import sys
hold=int(sys.argv[1]) if len(sys.argv)>1 else 30
e=TDbg("st_arena05"); e.run(1)
tele(e,2,14,11); tele(e,1,14,9); tele(e,3,2,11); tele(e,4,12,11)
tele(e,0,4,3); e.run(1); e.w8(0x362,2)
prev=None
def bombs(e):
    w=e.wram(); out=[]
    for a in range(0x800,0x1400,0x30):
        r=(w[a+2]<<16|w[a+1]<<8|w[a]); 
        if r in (0xC13BE5,0xC12798,0xC135E1) or (w[a+2]==0xC1 and w[a+0x1B]==0x7E):
            out.append((hex(a), f'{r:06X}', e.r16(a+0x12), e.r16(a+0x16), w[a+0x1A]))
    return out
for i in range(120):
    k=e.step(p0=['A'] if (i<2 or 5<=i<5+hold) else [])
    s=(e.obj(0)[:3].hex(), pos(e,0), bombs(e), ''.join('B' if (v&0xEFC0)==0xC900 else '.' for v in grid(e)[3]))
    if s!=prev: print(e.ticks, s)
    prev=s
