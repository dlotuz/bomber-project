from mec import *
for t in (0,1,2):
    e=TDbg("st_arena01"); e.run(1)
    e.w8(0x343,t); e.w8(0x344,2)
    print('tipo',t,'antes ', ''.join('x' if v==0xCC80 else ('#' if v==0xEC40 else '.') for v in grid(e)[1]))
    tele(e,0,8,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,1); e.run(1)
    w=e.wram(); print('   bomba +1A fuse', w[0x87A], '+22 tipo', w[0x882], '+23 fogo', w[0x883])
    for i in range(200):
        e.step(p0=['B'] if (t==1 and 60<=i<63) else [])
        g=grid(e)[1]
        if any(v&0x1000 or (v&0xFF00)==0xED00 for v in g): 
            print('   explodiu no tick', e.ticks, ''.join('*' if v&0x1000 else ('b' if (v&0xFF00)==0xED00 else ('x' if v==0xCC80 else ('#' if v==0xEC40 else '.'))) for v in g)); break
