import mt, collections
e = mt.new('st_cpu5b')
mt.watch(e, wlo=0x2800, whi=0x2bff)
c=collections.Counter()
for k in range(20):
    e.run(500)
    lg=mt.log(e); e.lib.mt_reset_log()
    for i,(pc,kd,a,v) in enumerate(lg):
        if a&1 and v==0x09: c[(hex(pc), hex(lg[i-1][3]) if i else None)]+=1
for k,v in sorted(c.items()): print(k,v)
