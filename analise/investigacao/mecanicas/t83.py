from mec import *
e=TDbg("st_arena01"); e.run(1)
bomb_at(e,0,8,1,back=(2,1))
for i in range(160): e.step()
tele(e,0,8,1); e.run(1)
e.ww(0x345,0x345); e.ww(0x35C,0x35D)
for i in range(20): e.step(p0=['RIGHT'])
for r in e.log():
    if r['t'] in ('W8','W16'): print(fmt(r))
print('45',hex(e.r8(0x345)),'5C',hex(e.r8(0x35C)),'5D',hex(e.r8(0x35D)))
