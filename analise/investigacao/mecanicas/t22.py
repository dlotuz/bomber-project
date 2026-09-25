from mec import *
e=Dbg("st_arena01"); e.run(1)
bomb_at(e,0,3,1,back=(2,2))
prev=None
for i in range(170):
    w=e.wram(); blk=w[0x860:0x890]
    if blk!=prev:
        print(e.nframes, blk[:3][::-1].hex(), ' '.join(f'{b:02X}' for b in blk[3:]))
    prev=blk; e.run(1)
