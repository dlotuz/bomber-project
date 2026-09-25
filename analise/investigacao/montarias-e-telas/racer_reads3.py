import mt, collections
e=mt.new('st_cpu5b')
print('1F04..', [hex(e.r16(a)) for a in (0x1f04,0x1f4e,0x1f50)])
e.w16(0x1f04,1)
mt.watch(e, wlo=0x1f4e, whi=0x1f51, rlo=0x1f04, rhi=0x1f05)
seen=collections.Counter()
for k in range(40):
    e.run(500)
    for pc,kd,a,v in mt.log(e): seen[(hex(pc),kd,hex(a),v)]+=1
    e.lib.mt_reset_log()
for k,v in sorted(seen.items()): print(k,v)
e.shot(mt.OUT+'racer_cpu.png')
open(mt.OUT+'st_racer_cpu_end.bin','wb').write(e.save())
