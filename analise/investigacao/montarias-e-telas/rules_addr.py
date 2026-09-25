import mt
e=mt.new('st_rules')
names=['cpu','matches','time','sudden','bad','racer']
for i,n in enumerate(names):
    w0=e.wram()
    e.tap('RIGHT',0,3,30)
    w1=e.wram()
    d=[(hex(a),w0[a],w1[a]) for a in range(0x20000) if w0[a]!=w1[a] and not (0x2000<=a<0x4000) and not (0x5000<=a<0x5800) and not (0xa000<=a<0xb000)]
    print(n, d[:40])
    e.tap('DOWN',0,3,30)
