from mec import *
e=Dbg("st_arena05"); e.run(1)
tele(e,2,14,11)
tele(e,0,4,1); e.run(1); e.run(2,p0=['A']); tele(e,0,2,1); e.run(1)
e.run(15,p0=['RIGHT'])
e.ww(0x87C,0x87D); e.ww(0x860,0x862)
e.run(4,p0=['RIGHT'])
for r in e.log(): print(fmt(r))
w=e.wram(); print(w[0x860:0x890].hex(' '))
