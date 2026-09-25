from mec import *
e=TDbg(OUT+'st_badactive.bin'); e.run(1)
for i in range(40): e.step()
print('P2 at', pos(e,1), e.obj(1)[:3].hex(), 'P2 bombs', e.obj(1)[0x41], e.obj(1)[0x42], 'fire', e.obj(1)[0x44])
def bombs(e):
    w=e.wram(); out=[]
    for a in range(0x800,0x1400,0x30):
        r=(w[a+2]<<16|w[a+1]<<8|w[a])
        if w[a+2]==0xC1 and 0x11D00<=r-0xC00000+0x10000 and r not in (0xC34EE6,): 
            if r in (0xC13BE5,0xC12798,0xC135E1,0xC126C9,0xC1243F,0xC12416,0xC11E61,0xC11E75): out.append((hex(a), f'{r:06X}', e.r16(a+0x12), e.r16(a+0x16), w[a+0x1A]))
    return out
prev=None
for i in range(600):
    k=e.step(p1=['A'] if i%10<2 else [])
    s=(e.obj(1)[:3].hex(), e.obj(1)[0x41], bombs(e), e.r8(0x1EA0))
    if s[:2]!=(prev[:2] if prev else None) or (s[2] and prev and [b[1] for b in s[2]]!=[b[1] for b in prev[2]]): print(e.ticks, s)
    prev=s
