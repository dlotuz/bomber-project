"""Fatos de render dos tipos da senha (1, 4, 5, 6, 9, B), no formato de web/src/render/rom/mounts/facts.ts.
Mesmo método de montarias-e-telas/mount_render_facts.py (anim = +$08−1, anim2 = +$38−1), sem os estados antigos."""
import sys, json, ctypes as C
from lib import *
TYPES = [0x1, 0x4, 0x5, 0x6, 0x9, 0xB, 0x2]   # 2 = controle (tem de bater com o facts.ts atual)
DIRS = [('up', 'UP'), ('right', 'RIGHT'), ('down', 'DOWN'), ('left', 'LEFT')]
def p24(a): b = rom(a, 3); return b[0] | b[1] << 8 | b[2] << 16
def tile4(v, a):
    out = []
    for r in range(8):
        b0, b1, b2, b3 = v[a + 2 * r], v[a + 2 * r + 1], v[a + 16 + 2 * r], v[a + 17 + 2 * r]
        for c in range(8):
            s = 7 - c; out.append(((b0 >> s) & 1) | ((b1 >> s) & 1) << 1 | ((b2 >> s) & 1) << 2 | ((b3 >> s) & 1) << 3)
    return out
def sheet_frame(src, g, data=ROM):
    base = (src & 0x3FFFFF) + (g & 3) * 0x80 + (g >> 2) * 0x800; px = [0] * 1024
    for r in range(4):
        for k in range(4):
            for i, v in enumerate(tile4(data, base + r * 0x200 + k * 32)): px[(r * 8 + (i >> 3)) * 32 + k * 8 + (i & 7)] = v
    return px
def vram(e):
    L = e.lib; L.retro_get_memory_data.restype = C.c_void_p; L.retro_get_memory_size.restype = C.c_size_t
    return C.string_at(L.retro_get_memory_data(3), L.retro_get_memory_size(3))
def obj32(v, tile):
    px = [0] * 1024
    for ty in range(4):
        for tx in range(4):
            tt = (tile & 0x100) | ((((tile >> 4) + ty) & 0xF) << 4) | (((tile & 0xF) + tx) & 0xF)
            a = (0xC000 + (tt & 0xFF) * 32 + (0x2000 if tt & 0x100 else 0)) & 0xFFFF
            for i, x in enumerate(tile4(v, a)): px[(ty * 8 + (i >> 3)) * 32 + tx * 8 + (i & 7)] = x
    return px
def cgram(e):
    e.lib.dbg_cgram.restype = C.POINTER(C.c_ubyte); p = e.lib.dbg_cgram(); return bytes(p[i] for i in range(512))
def smp(e):
    w = e.wram(); b = P1
    return dict(anim=(w[b+8] | w[b+9] << 8 | w[b+10] << 16) - 1, anim2=max(0, (w[b+0x38] | w[b+0x39] << 8 | w[b+0x3A] << 16) - 1),
                sheet2=w[b+0xA4] | w[b+0xA5] << 8 | w[b+0xA6] << 16, rt=w[b] | w[b+1] << 8 | w[b+2] << 16)
def rec(e, n, held=None): return [(e.run(1, p0=held or []), smp(e))[1] for _ in range(n)]
def uniq(ss, k):
    out = []
    for s in ss:
        if s[k] and s[k] not in out: out.append(s[k])
    return out
e = new(); fx = {}
for t in TYPES:
    d = {}
    e.load(open(EST + 'mx_arena01.bin', 'rb').read()); e.run(1); clear_soft(e)
    p = pl(e); e.w16(cell(p['x'], p['y']), 0x0940 + (0x30 | t))
    # o harness conta do tick em que o ovo choca; pula os quadros até o pedido de montar
    while not (pl(e)['f51'] & 1) and pl(e)['rt'] == 0xC2141C: e.run(1)
    m = rec(e, 43)
    d['mounting'] = dict(anim=uniq(m, 'anim'), anim2=uniq(m, 'anim2'))
    e.run(60); base = e.save()
    d['dirs'] = {}
    for name, btn in DIRS:
        e.load(base); w = rec(e, 24, [btn]); i = rec(e, 8)
        d['dirs'][name] = dict(walk=uniq(w, 'anim'), idle=uniq(i, 'anim'), walk2=uniq(w, 'anim2'), idle2=uniq(i, 'anim2'))
    e.load(base)
    for f in range(12): e.run(1, p0=['DOWN'])
    e.run(4)
    cg = cgram(e); pal2 = cg[2 * (128 + 32):2 * (128 + 48)]
    d['pal2'] = [hex(0xC00000 + i) for i in range(len(ROM)) if ROM.startswith(pal2, i)][:4]
    src = p24(0xC470DC + 3 * t); v = vram(e); fr = obj32(v, 0x008)
    g = next((g for g in range(64) if sheet_frame(src, g) == fr), None)
    d['gfx'] = dict(src=hex(src), raw_frame=g, sheet2=hex(smp(e)['sheet2']))
    # Y: animações durante o uso (4: investida; 5: varredura; 9: soco) — andando p/ direita
    e.load(base); e.run(2, p0=['RIGHT'])
    y = rec(e, 3, ['Y']) + rec(e, 40)
    d['y'] = dict(anim=uniq(y, 'anim'), anim2=uniq(y, 'anim2'), rts=uniq(y, 'rt'))
    fx['%x' % t] = d
    print('%X' % t, json.dumps(d, default=lambda x: x)); sys.stdout.flush()
json.dump(fx, open(OUT + 'facts_extra.json', 'w'), indent=1, default=lambda x: x)
