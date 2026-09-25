from mec import *
def run(label, setup):
    e=TDbg("st_arena05"); e.run(1)
    for n in range(2,5): tele(e,n,14,11)
    for n in range(5): e.w8(0x344+n*0x100,0)
    tele(e,0,8,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,11); tele(e,1,9,1); e.run(1)
    setup(e)
    prev=None
    for i in range(400):
        e.step()
        s=(e.obj(1)[:3].hex(), e.r16(0x496), e.r8(0x447), hex(e.r8(0x445)))
        if s[:1]!=(prev[:1] if prev else None) or (s[1] in (0,1) and prev and prev[1] not in (0,1)): print(label, e.ticks, s)
        prev=s
run('coração', lambda e: e.w8(0x447,0xFF))
run('colete(08)', lambda e: e.w16(0x496,0x1FF))
