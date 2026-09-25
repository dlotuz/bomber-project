from mec import *
e=TDbg(OUT+'st_r_bad.bin'); e.run(1)
# matar P2 rapido: P2 em (8,5) coloca bomba e fica
tele(e,1,8,5); e.run(1)
e.run(2,p1=['A']); e.run(1)
for i in range(300):
    e.step()
    if e.obj(1)[:3].hex() in ('895bc2','1d5cc2','eb5bc2','8a5cc2'): break
print('bad bomber ativo tick',e.ticks, e.obj(1)[:3].hex(), pos(e,1))
open(OUT+'st_badactive.bin','wb').write(e.save())
prev=None
for i in range(200):
    e.step(p1=['UP'] if i<100 else ['DOWN'])
    s=(e.obj(1)[:3].hex(), pos(e,1))
    if s!=prev and (i<12 or i%10==0): print(e.ticks, s)
    prev=s
