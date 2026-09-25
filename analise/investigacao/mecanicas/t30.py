from mec import *
e=Dbg("st_arena05"); e.run(1)
base=e.save()
# arena05: pillars at (odd col? ) print grid row1-3
g=grid(e)
for r in range(0,5): print(' '.join(f'{v:04X}' for v in g[r]))
for dx in range(-9,10):
    e.load(base)
    e.w16(0x312,cx(4)+dx); e.w16(0x316,cy(1)); e.w8(0x311,0); e.w8(0x315,0)
    tr=[]
    for i in range(18):
        e.run(1,p0=['DOWN']); x,y=pos(e); tr.append(f'{x-cx(4):+.0f},{y-cy(1):+.0f}')
    print(f'dx={dx:+d}', ' '.join(tr))
