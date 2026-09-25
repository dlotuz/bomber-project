from mec import *
e=TDbg("st_stage00"); e.run(1)
e.run(2,p0=['A'])
f0=e.nframes
out=[]
for i in range(780):
    k=e.step()
    if i>=625: out.append((e.nframes-f0, e.r8(0x1ECE), e.r8(0x1ED0), e.r8(0x1BD), k))
prev=None
for o in out:
    if prev is None or o[1]!=prev[1]-1 or o[3]!=prev[3]: print(o)
    prev=o
