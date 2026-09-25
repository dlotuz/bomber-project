from mec import *
import sys
st=sys.argv[1]
e=TDbg(OUT+st); e.run(1)
spots=[(8,5),(9,7),(7,5),(8,7),(8,6)]
for n in range(5): tele(e,n,*spots[n])
e.w8(0x1ED2,0); e.w8(0x1ED0,3)
prev=None; f0=e.nframes
for i in range(1500):
    k=e.step()
    s=(e.r8(0x1ED2),e.r8(0x1ED0), [e.obj(n)[:3].hex() for n in range(5)], e.r8(0x1BD), [e.r8(0x1F34+2*n) for n in range(5)], hex(e.r16(0x9E)))
    if s[2:]!=(prev[2:] if prev else None) or s[:2]!=(prev[:2] if prev else None): print('frame',e.nframes-f0,'tick',e.ticks,s)
    prev=s
    if i in (200,260,330): e.shot(OUT+f't95_{st}_{i}.png')
