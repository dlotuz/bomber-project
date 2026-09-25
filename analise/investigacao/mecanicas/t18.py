from mec import *
e=Dbg("st_arena01"); print('01A4=',e.r16(0x1A4))
bomb_at(e,0,8,1,back=(2,1))
e.run(10); e.shot(OUT+"t18a.png")
print(gridstr(e))
for i in range(200): e.run(1)
print(gridstr(e)); e.shot(OUT+"t18b.png")
