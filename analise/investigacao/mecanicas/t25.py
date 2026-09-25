from mec import *
import sys
e=Dbg("st_arena05"); e.run(1)
base=e.save()
def trial(px,py):
    e.load(base)
    for n in range(5): e.w8(0x344+n*0x100,0)  # fire 0
    tele(e,0,8,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,11); e.run(1)
    e.w16(0x412,px); e.w16(0x416,py); e.w8(0x411,0); e.w8(0x415,0)
    for i in range(200):
        e.run(1)
        if e.obj(1)[:3].hex()!='1c14c2': return (i, e.obj(1)[:3].hex())
    return None
mode=sys.argv[1]
if mode=='x':
    for dx in range(-3,18):
        px=cx(10)+dx; print('X',px,'(col10+%d)'%dx, trial(px,cy(1)))
else:
    for dy in range(-3,18):
        py=cy(1)+dy; print('Y',py,'(row1+%d) at col10'%dy, trial(cx(10),py), ' at col11', trial(cx(11),py))
