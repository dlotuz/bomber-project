from mec import *
e = Dbg("st_arena01")
walk_to(e,0,tx=47); e.run(2,p0=['A']); e.run(1)
walk_to(e,0,tx=31); walk_to(e,0,ty=63)
f0=e.nframes
e.ww(0x890,0x8BF)
for i in range(200): e.run(1)
for r in e.log()[:60]: print(fmt(r))
