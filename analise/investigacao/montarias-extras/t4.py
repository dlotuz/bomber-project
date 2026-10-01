from lib import *
P2 = 0x400
def run(tag, setup):
    e = new(); mount(e, 4); setup(e)
    e.run(2, p0=['RIGHT']); e.run(2, p0=['Y'])
    seq = []
    for f in range(60):
        e.run(1); p = pl(e); q = pl(e, P2)
        seq.append((f, hex(p['rt']), p['x'], hex(q['rt']), q['x'], q['y']))
    ch = []
    for s in seq:
        if not ch or ch[-1][1:] != s[1:]: ch.append(s)
    print(tag, ch[:25]); print('  objs', [(hex(o['rt']), o['x'], o['y']) for o in objs(e)])
    print('  grid', [hex(e.r16(cell(x, 48))) for x in range(32, 224, 16)])
def bomb(e):  # bomba na casa (96,48)
    e.w16(cell(96, 48), 0)
    import ctypes
    # põe o P1 numa casa, solta bomba e volta: mais simples, P2 vai p/ (128,48)
def p2(e):
    e.w16(P2 + 0x12, 127); e.w16(P2 + 0x16, 47)
def softblk(e): e.w16(cell(128, 48), 0xCC80)
run('vazio', lambda e: None)
run('bloco128', softblk)
run('p2_em_127', p2)
