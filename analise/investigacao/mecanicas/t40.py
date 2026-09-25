from mec import *
e=TDbg("st_arena05"); e.run(1)
tele(e,2,14,11)
tele(e,0,4,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,1); e.run(1)
for i in range(100): e.step(p0=['RIGHT'] if i<16 else [])
g=grid(e); print(' '.join(f'{v:04X}' for v in g[1]))
w=e.wram(); print(w[0x860:0x890].hex(' '))
e.shot(OUT+'t40.png')
