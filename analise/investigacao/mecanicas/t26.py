from mec import *
e=Dbg("st_arena05"); e.run(1)
for n in range(5): e.w8(0x344+n*0x100,0)
tele(e,0,8,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,11); e.run(1)
e.w16(0x412,cx(10)); e.w16(0x416,cy(1))
prev=None; t0=None
for i in range(400):
    e.run(1)
    g=grid(e)[1][10]
    st=(e.obj(1)[:3].hex(), e.r8(0x1EA0), f'{g:04X}', e.obj(1)[0x0C], e.obj(1)[0x0D])
    if st!=prev:
        if t0 is None and st[0]!='1c14c2': t0=e.nframes
        print(e.nframes, (e.nframes-t0) if t0 else '', st)
    prev=st
    if i in (130,140,160,180,200): e.shot(OUT+f"t26_{i}.png")
