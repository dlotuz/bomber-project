from mec import *
e=Dbg("st_arena01"); e.run(1)
# put item 05 (speed) at row1 col3 in logical grid
e.w16(0x2800+0x40+3*2, 0x0945)
e.ww(0x340,0x34F); e.ww(0x3D8); e.ww(0x3E3); e.ww(0x396,0x397); e.ww(0x2846,0x2847)
for i in range(25): e.run(1,p0=['RIGHT'])
for r in e.log(): print(fmt(r))
print(pos(e), e.obj(0)[0x40])
