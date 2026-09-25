from mec import *
import movesim, random, sys
random.seed(int(sys.argv[2])); st=sys.argv[1]; want=int(sys.argv[3])
e=Dbg(st); e.run(1); base=e.save()
def gridd(e):
    w=e.wram(); return {r*0x40+c*2: w[0x2800+r*0x40+c*2]|w[0x2801+r*0x40+c*2]<<8 for r in range(14) for c in range(16)}
combos=[['UP'],['DOWN'],['LEFT'],['RIGHT'],['UP','LEFT'],['UP','RIGHT'],['DOWN','LEFT'],['DOWN','RIGHT'],[]]
for trial in range(want+1):
    e.load(base); g=gridd(e)
    free=[(c,r) for r in range(1,12) for c in range(2,15) if g[r*0x40+c*2]==0]
    c,r=random.choice(free); lvl=random.choice([1,1,2,3,4,5,0,6,7]); e.w8(0x340,lvl)
    X=(cx(c)+random.randint(-7,8))<<8; Y=(cy(r)+random.randint(-7,8))<<8
    if movesim.cell_of(X>>8,Y>>8) not in g or g[movesim.cell_of(X>>8,Y>>8)]!=0: continue
    e.w16(0x311,X&0xFFFF); e.w8(0x313,X>>16); e.w16(0x315,Y&0xFFFF); e.w8(0x317,Y>>16)
    e.run(1); X=e.r16(0x311)|e.r8(0x313)<<16; Y=e.r16(0x315)|e.r8(0x317)<<16
    seq=[]
    for k in range(6):
        cb=random.choice(combos); seq += [cb]*random.randint(3,25)
    if trial!=want: continue
    for i,cb in enumerate(seq):
        dp=sum(movesim.BTN[b] for b in cb)
        e.run(1,p0=cb); X,Y,d=movesim.step(X,Y,dp,lvl,g)
        EX=e.r16(0x311)|e.r8(0x313)<<16; EY=e.r16(0x315)|e.r8(0x317)<<16
        print(i,cb,'emu',(EX/256,EY/256),'sim',(X/256,Y/256),'d',d,'emu$60',e.r8(0x360),'$84',e.r8(0x384),'$82',hex(e.r8(0x382)), '' if (EX,EY)==(X,Y) else '<<<<')
        if (EX,EY)!=(X,Y): break
