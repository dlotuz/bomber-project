from mec import *
e=TDbg("st_stage00"); e.run(1)
e.run(2,p0=['A'])
prev=None; f0=e.nframes
for i in range(1000):
    k=e.step(p0=['DOWN'] if i>300 else [])
    s=(e.r8(0x1BD), e.r8(0x1ED2), e.r8(0x1ED0), e.r8(0x1EA0), e.obj(0)[:3].hex(), pos(e)[1], 'lag' if k==0 else '')
    if s[:6]!=(prev[:6] if prev else None):
        print('frame', e.nframes-f0, 'tick', e.ticks, s)
    prev=s
