from mec import *
e=TDbg("st_arena05"); e.run(1)
tele(e,2,14,11); tele(e,3,2,11); tele(e,4,12,11)
tele(e,0,3,3); tele(e,1,5,3); e.run(1)
e.w8(0x34D,0x21)
prev=None
for i in range(80):
    e.step(p0=['RIGHT'] if i<40 else ['LEFT'])
    s=(hex(e.r8(0x34D)), hex(e.r8(0x44D)), pos(e,0), pos(e,1), hex(e.r16(0x3F0)), hex(e.r16(0x4F0)))
    if s[:2]!=(prev[:2] if prev else None): print(e.ticks, s)
    prev=s
print('--- cura por item: P1 doente pega bomba+')
e=TDbg("st_arena05"); e.run(1)
for n in range(1,5): tele(e,n,14,11)
tele(e,0,3,3); e.run(1); e.w8(0x34D,0x22); e.w16(0x2800+3*64+4*2,0x0941)
b=e.r8(0x342)
for i in range(40):
    e.step(p0=['RIGHT'])
print('P1 $4D', hex(e.r8(0x34D)), 'bombs', b, '->', e.r8(0x342))
for i in range(60): e.step()
g=grid(e); print('caveiras no chão:', [(c,r,hex(g[r][c])) for r in range(14) for c in range(16) if (g[r][c]&0xFF)>=0xA0 and (g[r][c]>>8)==0x09])
