from mec import *
e=TDbg("st_arena05"); e.run(1)
for n in range(1,5): tele(e,n,14,11)
tele(e,0,3,3); e.run(1)
e.w16(0x2800+3*64+4*2,0x094F)
for i in range(30): e.step(p0=['RIGHT'])
print('45',hex(e.r8(0x345)),'5C',hex(e.r8(0x35C)),'5D',hex(e.r8(0x35D)), e.obj(0)[:3].hex())
e.shot(OUT+'t84_item0F.png')
for i in range(30): e.step(p0=['RIGHT'])
e.shot(OUT+'t84_item0F_b.png')
# capsulas: forcar tipos via $5C/$5D
for t in (2,3,0xA,0xC,0xD,0xE,0xF):
    e=TDbg("st_arena05"); e.run(1)
    for n in range(1,5): tele(e,n,14,11)
    tele(e,0,4,3); e.run(1)
    e.w8(0x35C,t); e.w8(0x35D,1); e.w8(0x351, e.r8(0x351)|1)
    for i in range(10): e.step(p0=['RIGHT'])
    e.shot(OUT+f't84_mount_{t:X}.png')
    x0=pos(e)[0]
    for i in range(8): e.step(p0=['RIGHT'])
    print('tipo',hex(t),'vel px/tick', (pos(e)[0]-x0)/8, e.obj(0)[:3].hex())
