import mt
e=mt.new(mt.OUT+'st_story1.bin')
e.tap('START',0,3,5); e.run(30)
L=0x1580
e.w8(L,0xAC); e.w8(L+1,0xC8); e.w8(L+2,0xC1)
e.run(2)
lx,ly=e.r16(L+0x12),e.r16(L+0x16)
e.w16(0x312,lx); e.w16(0x316,ly)
mt.watch(e, wlo=0x300, whi=0x302)
e.lib.mt_set(0x300,0x302,1,0,1); e.lib.mt_reset_cov()
for k in range(40):
    e.run(1)
    lg=mt.log(e)
    if lg: print(k, [(hex(pc),hex(a),hex(v)) for pc,kd,a,v in lg]); e.lib.mt_reset_log()
