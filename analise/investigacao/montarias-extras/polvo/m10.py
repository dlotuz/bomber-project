from plib import *
def bombs(e): return 'B' + str([(hex(o['rt'] & 0xffff), o['x'], o['y']) for o in objs(e) if o['rt'] >> 16 == 0xC1])
def walk_to(e, btn, cond, maxf=100):
    for i in range(maxf):
        if cond(pl(e)): return
        e.run(1, p0=[btn])
for kickoff in (True, False):
  for mounted in (True, False):
    e = new()
    if mounted: mount(e, 4)
    else: clear_soft(e)
    e.w8(P1 + 0x4A, 1)
    walk_to(e, 'RIGHT', lambda p: p['x'] >= 47)
    e.run(2, p0=['A']); e.run(2)
    walk_to(e, 'LEFT', lambda p: p['x'] <= 31)
    out = []
    for f in range(40):
        if f == 6 and kickoff: e.w8(P1 + 0x4A, 0)
        btn = ['RIGHT'] if f < 6 else (['Y'] if (f == 6 and mounted) else (['RIGHT'] if not mounted else []))
        if not mounted and f >= 6: e.w8(P1 + 0x40, 8)  # velocidade alta a pé para alcançar
        e.run(1, p0=btn); p = pl(e)
        out.append((f, f"x={p['x']} v={p['v64']:04X} {bombs(e)}"))
    print('== kickoff', kickoff, 'montado', mounted); print(compress(out)[:1500])
