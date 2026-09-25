from mec import *
import sys
def run(case):
    e=TDbg("st_arena05"); e.run(1)
    tele(e,2,14,11); tele(e,1,14,9); tele(e,3,2,11); tele(e,4,12,11)
    if case=='player': tele(e,1,8,1)
    if case=='player_off': tele(e,1,8,1,dx=-6)
    if case=='item': e.w16(0x2800+0x40+8*2,0x0941)
    if case=='bomb':
        tele(e,1,8,1); e.run(1); e.run(2,p1=['A']); tele(e,1,14,9); e.run(1)
    tele(e,0,4,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,1); e.run(1)
    log=[]
    for i in range(110):
        e.step(p0=['RIGHT'] if i<16 else [])
        g=grid(e)[1]
        log.append((e.ticks, ''.join('B' if (v&0xEFC0)==0xC900 else ('i' if (v&0xFF00)==0x0900 else ('#' if v==0xEC40 else ('*' if v&0x1000 else '.'))) for v in g), pos(e,1), e.obj(1)[:3].hex()))
    prev=None
    for l in log:
        if l[1:]!=prev: print(case, l)
        prev=l[1:]
for c in sys.argv[1:]: run(c)
