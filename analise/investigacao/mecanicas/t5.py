from mec import *
def pos(e,n=0): return (e.r16(0x311+n*0x100)/256, e.r16(0x315+n*0x100)/256)
for d in ['RIGHT','DOWN']:
    e = Dbg("st_arena01")
    tr=[]
    for i in range(40):
        e.run(1, p0=[d]); tr.append(pos(e))
    print(d, tr)
