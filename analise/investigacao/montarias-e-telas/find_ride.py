import mt, sys, random
sys.path.insert(0, mt.BASE+'/ferramentas'); from nav import grid
e = mt.new()
random.seed(1)
BT = ['UP','DOWN','LEFT','RIGHT','A','B','Y','X','L','R']
# reproduz a mesma sequência aleatória de w5d.py até st_cp00
order='st_cpu5,st_cpu5b,st_allcom,st_cp00'.split(',')
for st in order:
    e.load(open(mt.EST + st + '.bin', 'rb').read())
    left = 8000; found=False
    while left > 0:
        n = random.randint(4, 30)
        held = {f'p{p}': random.sample(BT, random.randint(0, 2)) for p in range(5)}
        if st=='st_cp00':
            for f in range(n):
                e.run(1, **held); left-=1
                w=e.wram()
                rid=[(p, w[0x35d+p*0x100], w[0x35c+p*0x100]) for p in range(5) if w[0x35d+p*0x100]]
                if rid and not found:
                    found=True; print('frame', 8000-left, rid, 'stage $1ECA?'); e.shot(mt.OUT+'ride_first.png')
                    open(mt.OUT+'st_ride_battle.bin','wb').write(e.save())
            if found: break
        else:
            e.run(n, **held); left -= n
