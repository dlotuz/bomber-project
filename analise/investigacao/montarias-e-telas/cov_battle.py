"""Cobertura de código de todo o Battle: partidas CPU longas + as 10 arenas com humanos aleatórios + todas as regras."""
import mt, sys, random, ctypes as C
name = sys.argv[1]; states = sys.argv[2].split(','); frames = int(sys.argv[3])
e = mt.new()
e.lib.mt_set(1, 0, 1, 0, 1); e.lib.mt_reset_cov()
random.seed(1)
BT = ['UP','DOWN','LEFT','RIGHT','A','B','Y','X','L','R']
for st in states:
    e.load(open(mt.EST + st + '.bin', 'rb').read() if not st.startswith('/') else open(st,'rb').read())
    left = frames
    while left > 0:
        n = random.randint(4, 30)
        held = {f'p{p}': random.sample(BT, random.randint(0, 2)) for p in range(5)}
        e.run(n, **held); left -= n
buf = mt.cov(e)
open(f'cov/{name}.cov', 'wb').write(buf)
print(name, sum(1 for b in buf if b))
