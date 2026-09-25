from mec import *
import movesim, random, sys
random.seed(int(sys.argv[2]) if len(sys.argv)>2 else 1)
st=sys.argv[1]
e=TDbg(st); e.run(1)
base=e.save()
def gridd(e):
    w=e.wram(); return {r*0x40+c*2: w[0x2800+r*0x40+c*2]|w[0x2801+r*0x40+c*2]<<8 for r in range(14) for c in range(16)}
names=['UP','DOWN','LEFT','RIGHT']
combos=[['UP'],['DOWN'],['LEFT'],['RIGHT'],['UP','LEFT'],['UP','RIGHT'],['DOWN','LEFT'],['DOWN','RIGHT'],[]]
tot=0; bad=0
for trial in range(int(sys.argv[3]) if len(sys.argv)>3 else 30):
    e.load(base)
    g=gridd(e)
    free=[(c,r) for r in range(1,12) for c in range(2,15) if g[r*0x40+c*2]==0]
    c,r=random.choice(free)
    if len(sys.argv)>4:
        for k in range(int(sys.argv[4])):
            bc,br=random.choice(free)
            if (bc,br)!=(c,r): e.w16(0x2800+br*0x40+bc*2,0xC900)
        g=gridd(e)
    lvl=random.choice([1,1,2,3,4,5,0,6,7])
    e.w8(0x340,lvl)
    X=(cx(c)+random.randint(-7,8))<<8; Y=(cy(r)+random.randint(-7,8))<<8
    if movesim.cell_of(X>>8,Y>>8) not in g or g[movesim.cell_of(X>>8,Y>>8)]!=0: continue
    e.w16(0x311,X&0xFFFF); e.w8(0x313,X>>16); e.w16(0x315,Y&0xFFFF); e.w8(0x317,Y>>16)
    e.run(1)  # deixa o jogo atualizar $80 etc.
    X=e.r16(0x311)|e.r8(0x313)<<16; Y=e.r16(0x315)|e.r8(0x317)<<16
    seq=[]
    for k in range(6):
        cb=random.choice(combos); seq += [cb]*random.randint(3,25)
    mism=None
    for i,cb in enumerate(seq):
        dp=sum(movesim.BTN[b] for b in cb)
        k=e.step(p0=cb)
        for _ in range(k): X,Y,d=movesim.step(X,Y,dp,lvl,g)
        EX=e.r16(0x311)|e.r8(0x313)<<16; EY=e.r16(0x315)|e.r8(0x317)<<16
        tot+=1
        if (EX,EY)!=(X,Y):
            mism=(i,cb,(EX/256,EY/256),(X/256,Y/256),d); bad+=1; break
    if mism: print('trial',trial,'lvl',lvl,'start',(c,r),'MISMATCH at',mism, 'prev inputs', seq[max(0,mism[0]-3):mism[0]])
print('frames ok', tot-bad, 'mismatches', bad)
