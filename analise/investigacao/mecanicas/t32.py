from mec import *
import sys
dx=int(sys.argv[1]); dirn=sys.argv[2]; nf=int(sys.argv[3])
e=Dbg("st_arena05"); e.run(1)
e.w16(0x312,cx(4)+dx); e.w16(0x316,cy(1)); e.w8(0x311,0); e.w8(0x315,0)
e.ww(0x360,0x36B); e.ww(0x382,0x387); e.ww(0x3C0,0x3C3)
for i in range(nf):
    e.clear(); e.run(1,p0=[dirn])
    print('--- frame',i+1,pos(e))
    for r in e.log(): print(fmt(r))
