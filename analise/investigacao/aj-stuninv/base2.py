"""Como base.py, mas salva também o estado PRE ticks antes de D0 (determinístico), com o P1 montado em t1 na casa (c1,5)."""
from h import *
import sys
def make(t1, c1, upto=None):
    e = TDbg("st_arena05"); e.run(1)
    tele(e,3,2,11); tele(e,4,12,11); tele(e,0,c1,7); tele(e,1,8,5); tele(e,2,14,1); e.run(1)
    assert mount_n(e,1,3)
    assert mount_n(e,0,t1); tele_m(e,0,c1,5); e.run(1); e.w8(0x362,2); e.step()
    bomb_at(e,2,8,4,back=(14,1))
    n = 0
    for i in range(400):
        if upto is not None and n == upto: return e, n
        e.step(); n += 1
        if rt(e,1) == 0xC2105E: return e, n
    raise SystemExit('sem desmonte')
t1 = int(sys.argv[1],16); c1 = int(sys.argv[2]); pre = int(sys.argv[3])
e, n = make(t1, c1)
e2, m = make(t1, c1, n - pre)
open(f'pre_{t1:X}_{c1}_{pre}.bin','wb').write(e2.save())
print('D0 em', n, 'salvo em', m, pos(e2,0), hex(e2.r8(0x362)), e2.obj(0)[0x5d], pos(e2,1))
