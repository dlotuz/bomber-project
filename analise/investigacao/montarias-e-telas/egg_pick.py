import mt, collections
e = mt.new(mt.OUT+'st_ride_pre.bin')
lo=0x1000000|0xC16080; hi=0x1000000|0xC16180
mt.watch(e, wlo=0x451, whi=0x451, rlo=lo, rhi=hi)
for t in range(200):
    e.run(1)
    lg=mt.log(e)
    if lg:
        print(t, [(hex(pc),k,hex(a&0xffffff),hex(v)) for pc,k,a,v in lg][:12]); e.lib.mt_reset_log()
    if e.r8(0x45d): print('ride at',t); break
