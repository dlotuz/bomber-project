"""Fixture tests/fixtures/rom/mount-render-extra.json: peças OAM (sem bytes) dos tipos da senha montados e parados.
Mesmo formato de riders[t][dir].idle[].pieces de mount-render.json (montarias-e-telas/mount_render_facts.py)."""
import sys, json, hashlib, ctypes as C
from lib import *
from facts_extra_util import tile4
WEB = sys.argv[1]
TYPES = [0x1, 0x4, 0x5, 0x6, 0x9, 0xB, 0x2]
DIRS = [('up', 'UP'), ('right', 'RIGHT'), ('down', 'DOWN'), ('left', 'LEFT')]
sha1 = lambda b: hashlib.sha1(bytes(b)).hexdigest()
def vram(e):
    L = e.lib; L.retro_get_memory_data.restype = C.c_void_p; L.retro_get_memory_size.restype = C.c_size_t
    return C.string_at(L.retro_get_memory_data(3), L.retro_get_memory_size(3))
def oam(e):
    o = e.wram()[0x10000:0x10220]; out = []
    for i in range(128):
        x, y, t, a = o[i*4:i*4+4]; hi = (o[512 + i//4] >> ((i % 4) * 2)) & 3
        x |= (hi & 1) << 8
        if x >= 256: x -= 512
        if 224 <= y < 240: continue
        if y >= 240: y -= 256
        out.append(dict(x=x, y=y, tile=t | ((a & 1) << 8), pal=(a >> 1) & 7, pri=(a >> 4) & 3, hf=(a >> 6) & 1, vf=a >> 7, big=hi >> 1))
    return out
def obj_px(v, tile, size):
    n = size // 8; px = [0] * (size * size)
    for ty in range(n):
        for tx in range(n):
            tt = (tile & 0x100) | ((((tile >> 4) + ty) & 0xF) << 4) | (((tile & 0xF) + tx) & 0xF)
            a = (0xC000 + (tt & 0xFF) * 32 + (0x2000 if tt & 0x100 else 0)) & 0xFFFF
            for i, x in enumerate(tile4(v, a)): px[(ty * 8 + (i >> 3)) * size + tx * 8 + (i & 7)] = x
    return px
def pieces(e, X, Y, rad=40):
    v = vram(e); out = []
    for o in oam(e):
        size = 32 if o['big'] else 16
        if abs(o['x'] + size // 2 - X) > rad or abs(o['y'] + size // 2 - Y) > rad: continue
        out.append(dict(dx=o['x'] - X, dy=o['y'] - Y, size=size, hflip=bool(o['hf']), vflip=bool(o['vf']), pal=o['pal'],
                        prio=o['pri'], tile=o['tile'], pxSha1=sha1(obj_px(v, o['tile'], size))))
    return out
e = new(); fx = dict(source='analise/investigacao/montarias-extras/fixture_extra.py', romSha1=hashlib.sha1(ROM).hexdigest(), riders={})
for t in TYPES:
    mount(e, t); e.run(60); base = e.save(); fx['riders']['%x' % t] = {}
    for name, btn in DIRS:
        e.load(base); e.run(24, p0=[btn]); smp = []
        for f in range(8):
            e.run(1); w = e.wram()
            X = w[P1 + 0x12] | w[P1 + 0x13] << 8; Y = w[P1 + 0x16] | w[P1 + 0x17] << 8
            smp.append(dict(anim=(w[P1+8] | w[P1+9] << 8 | w[P1+10] << 16) - 1, frame=w[P1 + 0x0C],
                            anim2=max(0, (w[P1+0x38] | w[P1+0x39] << 8 | w[P1+0x3A] << 16) - 1), frame2=w[P1 + 0x3C], pieces=pieces(e, X, Y)))
        fx['riders']['%x' % t][name] = dict(idle=smp)
json.dump(fx, open(WEB + '/tests/fixtures/rom/mount-render-extra.json', 'w'), separators=(',', ':'))
# controle: o tipo 2 tem de bater com a fixture antiga
old = json.load(open(WEB + '/tests/fixtures/rom/mount-render.json'))
norm = lambda ps: sorted('%d,%d,%d,%d,%d,%s' % (p['dx'], p['dy'], p['size'], p['hflip'], p['vflip'], p['pxSha1']) for p in ps)
for d, _ in DIRS:
    print('controle tipo 2', d, norm(fx['riders']['2'][d]['idle'][-1]['pieces']) == norm(old['riders']['2'][d]['idle'][-1]['pieces']))
