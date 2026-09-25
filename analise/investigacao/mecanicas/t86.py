from mec import *
e=TDbg(OUT+'st_r_normal.bin'); e.run(1)
tele(e,0,8,6); e.run(1); e.run(2,p0=['A']); tele(e,0,2,1)
tele(e,1,8,5); tele(e,2,8,4); tele(e,3,8,7); tele(e,4,8,6); e.run(1)
prev=None; f0=e.nframes
for i in range(2400):
    k=e.step()
    s=(e.r8(0x1EA0), [e.obj(n)[:3].hex() for n in range(5)], e.r8(0x1BD), [e.r8(0x1F34+2*n) for n in range(5)], e.r8(0x1ED0), hex(e.r16(0x96)))
    if s[:4]!=(prev[:4] if prev else None): print('frame',e.nframes-f0,'tick',e.ticks, s)
    prev=s
    if i in (300,400,500,700,900,1200): e.shot(OUT+f't86_{i}.png')
