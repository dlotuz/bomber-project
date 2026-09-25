from mec import *
e=TDbg("st_arena05"); e.run(1)
for n in range(1,5): tele(e,n,14,11)
tele(e,0,8,5); e.run(1); e.w8(0x34D,0x2B)
prev=None
for i in range(300):
    e.step()
    o=e.obj(0)
    s=(hex(o[0x4D]), o[0x42], o[0x44], o[0x40], o[0x48],o[0x49],o[0x4A],o[0xD8], pos(e))
    if s!=prev: print(e.ticks, s)
    prev=s
g=grid(e); print('itens no chão:', [(c,r,hex(g[r][c])) for r in range(14) for c in range(16) if (g[r][c]>>8)==0x09])
