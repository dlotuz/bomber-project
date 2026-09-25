from mec import *
import sys
nop = len(sys.argv)>1 and sys.argv[1]=='noP'
e=TDbg("st_arena05"); e.run(1)
tele(e,2,14,11); tele(e,1,14,9); tele(e,3,2,11); tele(e,4,12,11)
if nop: e.w8(0x3D8,0)
tele(e,0,4,3); e.run(1); e.run(2,p0=['A']); tele(e,0,3,3); e.run(1)
tele(e,1,7,3)
e.w8(0x362,2)
prev=None; t0=None
for i in range(400):
    e.step(p0=['Y'] if i<2 else [])
    st=e.obj(1)[:3].hex()
    s=(st, 'P1',pos(e,0), 'P2', pos(e,1), 'P2 b/f/spd', e.obj(1)[0x42],e.obj(1)[0x44],e.obj(1)[0x40], 'kick,punch,glove,P', e.obj(1)[0x4A],e.obj(1)[0x48],e.obj(1)[0x49],e.obj(1)[0xD8])
    if s!=prev: print(e.ticks, s)
    prev=s
g=grid(e)
print('\n'.join(' '.join(f'{v:04X}' for v in row) for row in g[:13]))
