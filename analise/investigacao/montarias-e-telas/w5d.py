import mt, sys, random, collections
e = mt.new()
random.seed(1)
BT = ['UP','DOWN','LEFT','RIGHT','A','B','Y','X','L','R']
res=collections.Counter()
for st in 'st_cpu5,st_cpu5b,st_allcom,st_cp00,st_cp05,st_cp10,st_cp15,st_cp20,st_matchend,st_ev05,st_ev15'.split(','):
    e.load(open(mt.EST + st + '.bin', 'rb').read())
    mt.watch(e, wlo=0x300, whi=0x7ff)
    left = 8000
    while left > 0:
        n = random.randint(4, 30)
        held = {f'p{p}': random.sample(BT, random.randint(0, 2)) for p in range(5)}
        e.run(n, **held); left -= n
        for pc,kd,a,v in mt.log(e):
            if (a & 0xff) in (0x5d,0x8c,0x8d,0xe8): res[(st,hex(pc),hex(a&0xff),v)]+=1
        e.lib.mt_reset_log()
for k,v in sorted(res.items()): print(k,v)
