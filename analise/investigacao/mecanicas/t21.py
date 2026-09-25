from mec import *
e=Dbg("st_arena01"); e.run(1)
w0=e.wram()
bomb_at(e,0,3,1,back=(2,2))
w=e.wram()
for a in range(0x800,0x1000,0x30):
    blk=w[a:a+0x30]
    if any(blk): print(hex(a), blk[:3][::-1].hex(), blk.hex(' '))
