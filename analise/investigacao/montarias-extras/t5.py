from lib import *
e = new(); mount(e, 5, clear=False)
def nsoft(): return sum(1 for r in range(14) for c in range(16) if (e.r16(0x2800 + r * 0x40 + c * 2) & 0xEFC0) == 0xCC80)
print('$90 antes', hex(e.r16(0x90)), 'soft', nsoft())
e.run(2, p0=['Y']); t0 = None
for f in range(700):
    e.run(1)
    if f % 50 == 0: print(f, 'soft', nsoft(), '$90', hex(e.r16(0x90)), 'obj', [hex(o['rt']) for o in objs(e) if o['rt'] >> 16 == 0xC1 and 0x6A00 < (o['rt'] & 0xffff) < 0x6B00])
    if f == 100: e.shot(OUT + 't5_100.png')
    if f == 300:
        e.shot(OUT + 't5_300.png'); e.run(2, p0=['Y'])
        print('2o Y: objs', [hex(o['rt']) for o in objs(e) if 0x6A00 < (o['rt'] & 0xffff) < 0x6B00])
e.shot(OUT + 't5_700.png')
print('itens na grade', sorted({hex(e.r16(0x2800 + r * 0x40 + c * 2)) for r in range(14) for c in range(16)}))
