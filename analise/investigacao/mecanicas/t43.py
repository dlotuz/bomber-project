from mec import *
import sys
case=sys.argv[1]
e=TDbg("st_arena05"); e.run(1)
tele(e,2,14,11); tele(e,1,14,9); tele(e,3,2,11); tele(e,4,12,11)
bc,br,pc,face,btn = {'hitp':(4,3,3,2,'Y'), 'edge':(13,3,12,2,'Y'), 'up':(4,2,4,0,'Y'), 'edgeup':(4,2,4,4,'Y')}[case][:5] if case in ('hitp','edge','up') else (4,2,4,4,'Y')
if case=='up': bc,br,pc,pr=4,2,4,3
elif case=='edgeup': bc,br,pc,pr=4,2,4,1
else: pr=br
if case=='up': face=0
if case=='edgeup': face=4
tele(e,0,bc,br); e.run(1); e.run(2,p0=['A']); tele(e,0,pc,pr); e.run(1)
if case=='edgeup':  # bomba em (4,2)? use (4,1) acima do jogador em (4,2)? -> soco para cima a partir da linha 2
    pass
if case=='hitp': tele(e,1,7,3)
e.w8(0x362,face)
prev=None
for i in range(60):
    e.step(p0=[btn] if i<2 else [])
    w=e.wram(); a=0x860
    s=(w[a:a+3][::-1].hex(), e.r16(a+0x12), e.r16(a+0x16), 'P1',pos(e,0),'P2',pos(e,1), e.obj(1)[:3].hex(), 'P2 bombs/fire', e.obj(1)[0x41],e.obj(1)[0x42],e.obj(1)[0x44])
    if s!=prev: print(e.ticks, s)
    prev=s
