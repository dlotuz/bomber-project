from mec import *
import sys
dx=int(sys.argv[1]); dirn=sys.argv[2]; nf=int(sys.argv[3]) if len(sys.argv)>3 else 1
e=Dbg("st_arena05"); e.run(1)
e.w16(0x312,cx(4)+dx); e.w16(0x316,cy(1)); e.w8(0x311,0); e.w8(0x315,0)
e.run(nf-1,p0=[dirn])
e.trace(True); e.run(1,p0=[dirn]); e.trace(False)
L=e.log()
# find P1 routine segment: from C2141C with X=0300 to next C0F3DD
start=[i for i,r in enumerate(L) if r['pc']==0xC2141C and r['x']==0x300][0]
end=[i for i,r in enumerate(L) if i>start and r['pc']==0xC0F3DD][0]
out=[]
for r in L[start:end]:
    out.append(f"{r['pc']:06X} A={r['a']:04X} X={r['x']:04X} Y={r['y']:04X} P={r['p']:02X}")
open(f'trace_move_{dx}_{dirn}_{nf}.txt','w').write('\n'.join(out))
print(len(out), pos(e))
