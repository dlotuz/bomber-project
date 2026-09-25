from mec import *
e=Dbg("st_arena01"); e.run(1)
tele(e,0,3,1); e.run(1)
hist=[]
for i in range(260):
    e.run(1, p0=['A'] if i<2 else [])
    if i==3: tele(e,0,2,2)
    g=grid(e)
    hist.append((e.nframes, g[1][3], g[1][2], g[1][4], e.r8(0x341), e.r8(0x342)))
prev=None
for h in hist:
    if h[1:]!=prev: print(h[0], ' '.join(f'{v:04X}' for v in h[1:4]), 'bombs cap/avail', h[4], h[5])
    prev=h[1:]
