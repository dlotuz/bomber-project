from mec import *
e=TDbg("st_arena05"); e.run(1)
for n in range(1,5): tele(e,n,14,11)
e.w8(0x344,7); e.w8(0x3D8,0); e.w8(0x34A,0)
tele(e,0,2,1); e.run(1); e.run(2,p0=['A']); 
for i in range(30): e.step()
tele(e,0,10,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,11); e.run(1)
prev=None
for i in range(140):
    e.step()
    g=grid(e)[1]
    s=''.join('B' if (v&0xEFC0)==0xC900 else ('*' if v&0x1000 else '.') for v in g)
    if s!=prev: print(e.ticks, s)
    prev=s
