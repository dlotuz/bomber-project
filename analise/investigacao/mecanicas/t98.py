from mec import *
e=TDbg("st_arena05"); e.run(1)
spots=[(8,5),(9,7),(7,5),(8,7),(8,6)]
for n in range(5): tele(e,n,*spots[n])
e.run(1)
e.w16(0x2800+64+4*2,0x0941)
e.w8(0x1ED2,1); e.w8(0x1ED0,2)
seen=set()
for i in range(420):
    if i==200:
        tele(e,0,3,1); e.run(1); e.run(2,p0=['A']); tele(e,0,8,5)
    e.step()
    g=grid(e)[1]
    s=(hex(g[3]),hex(g[4]))
    if s not in seen: print(e.ticks, s); seen.add(s)
w=e.wram(); print('bomb obj 860:', w[0x860:0x863][::-1].hex(), 'fuse', w[0x87A], 'P1 bombs avail', e.r8(0x341))
