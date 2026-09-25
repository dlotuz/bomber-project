from mec import *
import sys
e=TDbg("st_arena05"); e.run(1)
tele(e,2,14,11)  # P3 fora do caminho
tele(e,0,4,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,1); e.run(1)
def bombs(e):
    w=e.wram(); out=[]
    for a in range(0x800,0x1400,0x30):
        if w[a:a+3]==bytes([0xE5,0x3B,0xC1]) or (w[a+2]==0xC1 and w[a+0x1A]!=0 and w[a+5]==8):
            out.append((hex(a), (w[a+0x11]|w[a+0x12]<<8|w[a+0x13]<<16)/256, (w[a+0x15]|w[a+0x16]<<8|w[a+0x17]<<16)/256, w[a+0x1A], (w[a+2]<<16|w[a+1]<<8|w[a]).__format__('06X')))
    return out
print(bombs(e))
prev=None
for i in range(130):
    k=e.step(p0=['RIGHT'] if i<40 else [])
    b=bombs(e); p=pos(e)
    s=(b,p)
    if s!=prev: print('tick',e.ticks,'lag' if k==0 else '', 'P1',p,'bombs',b)
    prev=s
