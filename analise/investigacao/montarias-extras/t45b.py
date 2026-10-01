from lib import *
def trace(t, script, clear=True, n=60):
    e = new(); mount(e, t, clear=clear); seq = []
    for f in range(n):
        e.run(1, p0=script.get(f, []))
        p = pl(e); seq.append((f, hex(p['rt']), p['x'], p['y'], p['d']))
    ch = []
    for s in seq:
        if not ch or ch[-1][1:] != s[1:]: ch.append(s)
    return e, ch
# 4: A durante a investida; virar (UP) durante; Y de novo logo depois de parar
e, ch = trace(4, {0: ['RIGHT'], 1: ['Y'], 2: ['Y'], 6: ['A'], 7: ['A'], 10: ['UP'], 11: ['UP']})
print('4 A/UP durante:', [c for c in ch if c[1] != '0xc226e0' or c[0] in (5, 6, 7, 8, 10, 11, 12)][:14])
print('   bombas', [(hex(o['rt']), o['x'], o['y']) for o in objs(e) if o['rt'] == 0xc13be5])
e, ch = trace(4, {0: ['RIGHT'], 1: ['Y'], 2: ['Y'], **{f: ['Y'] for f in range(52, 60)}}, n=70)
print('4 Y repetido:', [c for c in ch if c[0] >= 45])
# 5: dois Y seguidos com a varredura ativa
e = new(); mount(e, 5, clear=False)
e.run(2, p0=['Y']); e.run(20); e.run(2, p0=['Y']); e.run(1)
print('5 objetos de varredura apos 2o Y:', [hex(o['a']) for o in objs(e) if o['rt'] == 0xc16a5f])
