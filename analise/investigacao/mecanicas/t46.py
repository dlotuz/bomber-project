from mec import *
import sys
def run(label, p1, p2, face, extra=None):
    e=TDbg("st_arena05"); e.run(1)
    tele(e,2,14,11); tele(e,3,2,11); tele(e,4,12,11)
    tele(e,0,*p1); tele(e,1,*p2); e.run(1)
    e.w8(0x348,0); e.w8(0x362,face)
    if extra: extra(e)
    prev=None; out=[]
    for i in range(60):
        e.step(p0=['Y'] if i<2 else [])
        s=(e.obj(0)[:3].hex(),pos(e,0), e.obj(1)[:3].hex(), pos(e,1))
        if s!=prev: out.append((e.ticks,)+s)
        prev=s
    print(label, out[0], '...', out[-1])
run('P2 contra parede', (12,1),(13,1),2)
run('dash contra parede (cima)', (3,1),(13,5),0)
run('dash contra pilar', (2,1),(13,5),4, None)
run('dash vertical c/ P2', (2,1),(2,2),4)
run('P2 empurrado contra bomba', (3,3),(4,3),2, lambda e: e.w16(0x2800+3*0x40+6*2,0xC900))
run('P2 empurrado contra soft', (3,3),(4,3),2, lambda e: e.w16(0x2800+3*0x40+7*2,0xCC80))
