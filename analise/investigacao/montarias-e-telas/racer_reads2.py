import mt, collections
e=mt.new(mt.OUT+'st_racer_battle.bin')  # stage select, racer ON
mt.watch(e, rlo=0x12017, rhi=0x1201C)
e.tap('A',0,3,1); e.run(1500)
c=collections.Counter((hex(pc),hex(a)) for pc,k,a,v in mt.log(e))
for k,v in sorted(c.items()): print(k,v)
