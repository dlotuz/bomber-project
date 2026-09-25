from mec import *
e = Dbg("st_stage00"); e.run(1)
e.tap('A', hold=2, after=0)
e.ww(0x8000,0x80FF)
seen=set()
for i in range(600):
    e.run(1)
    L=e.log()
    if L:
        pcs=sorted(set(r['pc'] for r in L)); 
        print("frame",e.nframes,"writes",len(L),[hex(p) for p in pcs][:10]); e.clear()
    if i%30==0: e.shot(OUT+f"start_{i:03d}.png")
e.save(); open(OUT+"st_s1_after600.bin","wb").write(e.save())
