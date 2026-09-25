# mesmo renderizador, alimentado com VRAM/CGRAM/mapas do savestate (fresh) x alimentado so pela ROM: isola a equivalencia dos DADOS
from ac import *
from render_rom import draw_layer, COLOR_MATH
from PIL import Image
def render_state(n):
    st = open(SCR + '/rom-arenas/fresh%02d.bin' % n, 'rb').read(); p = PPUState(st); r = p.ram
    buf = p.vram[:0x8000]; pal = p.cg[:128]
    W = lambda a, cnt: [r[a + 2*i] | r[a + 2*i + 1] << 8 for i in range(cnt)]
    bg2 = W(0x2000, 480) + [0] * (1024 - 480); bg1 = W(0x5000, 1024)
    hofs1 = r[0x9EDC] | r[0x9EDD] << 8
    hud = [0] * 1024; hud[28*32:28*32+96] = W(0x5700, 96)
    img = Image.new('RGB', (256, 224), snes_rgb(pal[0])); px = img.load()
    L2, L1, H = {}, {}, {}
    draw_layer(buf, pal, bg2, 32, 32, True, 8, -24, 24, 224, L2, None, 2)
    draw_layer(buf, pal, bg1, 32, 32, True, hofs1, -24, 24, 224, L1, None, 1)
    draw_layer(buf, pal, hud, 32, 32, False, 8, 224, 0, 24, H, None, 1)
    ts_, cga = COLOR_MATH.get(n, (0, 0))
    for y in range(224):
        for x in range(256):
            if y < 24:
                c = H.get((x, y))
                if c: px[x, y] = c[0]
                continue
            b2 = L2.get((x, y)); b1 = L1.get((x, y))
            cand = ([(b1[1] * 2 + 1, 'b1', b1)] if b1 else []) + ([(b2[1] * 2, 'b2', b2)] if b2 else [])
            if not cand: continue
            cand.sort(key=lambda t: -t[0]); top = cand[0]; col = top[2][0]
            if top[1] == 'b1' and (cga & 1) and (ts_ & 2) and b2:
                c5 = [v >> 3 for v in col]; s5 = [v >> 3 for v in b2[0]]
                r5 = [(a + b) >> 1 for a, b in zip(c5, s5)] if cga & 0x40 else [min(31, a + b) for a, b in zip(c5, s5)]
                col = tuple((v << 3) | (v >> 2) for v in r5)
            px[x, y] = col
    return img
for n in range(1, 11):
    a = render_state(n); a.save(OUT + '/render/arena_%02d_estado.png' % n)
    b = Image.open(OUT + '/render/arena_%02d_rom.png' % n).convert('RGB')
    pa, pb = a.load(), b.load()
    dh = sum(1 for y in range(24) for x in range(256) if pa[x, y] != pb[x, y])
    df = sum(1 for y in range(24, 224) for x in range(256) if pa[x, y] != pb[x, y])
    print('arena %2d: render(estado) x render(ROM): HUD %d px, campo %d px' % (n, dh, df))
