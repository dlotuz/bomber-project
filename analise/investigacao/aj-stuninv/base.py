"""Base: P2 montado (tipo 3) em (8,5), atingido pela chama de uma bomba do P3 em (8,4). Salva o estado no tick D0
(rotina do P2 vira $C2:105E). P1 em (4,5), P4/P5 longe."""
from h import *
def make(mtype=3, p1mount=None):
    e = TDbg("st_arena05"); e.run(1)
    tele(e,3,2,11); tele(e,4,12,11); tele(e,0,4,5); tele(e,1,8,5); tele(e,2,14,1); e.run(1)
    assert mount_n(e,1,mtype)
    if p1mount is not None:
        tele(e,0,4,7); e.run(1); assert mount_n(e,0,p1mount); tele(e,0,4,5); e.run(1)
    bomb_at(e,2,8,4,back=(14,1))
    for i in range(400):
        e.step()
        if rt(e,1) == 0xC2105E: return e
    raise SystemExit('sem desmonte')
if __name__ == '__main__':
    import sys
    for t in [None, 0xE, 0xF]:
        e = make(3, t)
        open(f'd0_{t}.bin','wb').write(e.save())
        print(t, 'D0 ok', pos(e,0), pos(e,1), hex(rt(e,0)), e.obj(0)[0x5d])
