from mec import *
import movesim
e=TDbg("st_arena05"); e.run(1)
for n in range(1,5): tele(e,n,14,11)
tele(e,0,4,3); e.run(1); e.run(2,p0=['A']); e.run(1)
def gridd(e):
    w=e.wram(); return {r*0x40+c*2: w[0x2800+r*0x40+c*2]|w[0x2801+r*0x40+c*2]<<8 for r in range(14) for c in range(16)}
X=e.r16(0x311)|e.r8(0x313)<<16; Y=e.r16(0x315)|e.r8(0x317)<<16
seq=['RIGHT']*20+['LEFT']*30+['UP']*8
for i,d in enumerate(seq):
    g=gridd(e)
    k=e.step(p0=[d])
    for _ in range(k): X,Y,dd=movesim.step(X,Y,movesim.BTN[d],1,g)
    EX=e.r16(0x311)|e.r8(0x313)<<16; EY=e.r16(0x315)|e.r8(0x317)<<16
    if i>=40: print(i,d,'emu',EX/256,EY/256,'sim',X/256,Y/256,'$60',e.r8(0x360),'cell',hex(e.r16(0x380)), hex(g[0xC8]), '' if (EX,EY)==(X,Y) else '<<<')
