import mt
e = mt.new('st_stage00')
e.lib.mt_set(1,0,1,0,0)
e.tap('A',0,3,1)
# break at C4121D: log reads of DP $54-$56 at that moment via write watch on $54..56
mt.watch(e, wlo=0x54, whi=0x56)
for k in range(1500):
    e.run(1)
    lg=[x for x in mt.log(e) if x[0] in range(0xC41100,0xC41300)]
    if lg: print(k,[(hex(pc),hex(a),hex(v)) for pc,kd,a,v in lg][:6]); break
    e.lib.mt_reset_log()
