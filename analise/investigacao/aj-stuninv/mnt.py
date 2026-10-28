from h import *
e = TDbg("st_arena05"); e.run(1)
tele(e,1,8,5); e.run(1)
b = ob(1); c = 0x2800 + e.r16(b+0x80); e.w16(c, 0x0940 + 0x33)
prev=None
for i in range(60):
    e.step(); k=(hex(rt(e,1)), e.obj(1)[0x5d], tuple(occ_of(e,1)), e.r16(b+0x96))
    if k!=prev: print(e.ticks, k); prev=k
