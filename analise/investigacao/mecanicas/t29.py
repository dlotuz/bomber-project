from mec import *
e=TDbg("st_arena05"); e.run(1)
for n in range(5): e.w8(0x344+n*0x100,0)
tele(e,0,8,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,11); e.run(1)
e.w16(0x412,cx(10)); e.w16(0x416,cy(1))
prev=None; t0=None
for i in range(400):
    e.step()
    g=grid(e)[1][10]
    st=(e.obj(1)[:3].hex(), e.r8(0x1EA0), f'{g:04X}')
    if st!=prev:
        if t0 is None and g==0x1000: t0=e.ticks
        print('frame',e.nframes,'tick',e.ticks, (e.ticks-t0) if t0 else '', st)
    prev=st
