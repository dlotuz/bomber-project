import mt, collections
e = mt.new('st_stage00')
mt.watch(e, wlo=0x8000, whi=0x80ff)
e.tap('A',0,3,1)
for k in range(1500):
    e.run(1)
lg=mt.log(e)
c=collections.Counter(hex(pc) for pc,kd,a,v in lg)
print(c.most_common(10))
