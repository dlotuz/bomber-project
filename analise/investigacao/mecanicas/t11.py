from mec import *
e = Dbg(OUT+"st_s1_after600.bin")
e.ww(0x8000,0x80FF)
prev=None
for i in range(1500):
    e.run(1, p0=['DOWN'])
    L=e.log()
    if L:
        pcs=sorted(set(r['pc'] for r in L)); print("frame",e.nframes,"writes",len(L),[hex(p) for p in pcs][:10]); e.clear()
    st=(e.r8(0x1ED2),e.r8(0x1ED0),e.r8(0x1ECE)//60,e.r8(0x1EA0),e.obj(0)[:3].hex(), pos(e))
    key=st[:2]+st[3:]
    if key!=prev: print(600+i, st); prev=key
    if i%100==0: e.shot(OUT+f"start2_{i:04d}.png")
