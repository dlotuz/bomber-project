"""Gera tests/fixtures/rom/gfx-arenas.json: goldens da montagem das 10 arenas (mapas, lógico, carga com RNG,
elementos fixos, script de tiles, HUD, OBJ comuns, BG3, paletas OBJ). Fontes: arenas-cenario/arena_rom.py e
render_rom.py (validados contra a WRAM/VRAM do emulador, ARN §2.4 e §6) e graficos-formato/decomp.py.
As partes novas (tiles 46/47/62/63 de $C5:FE5C e OBJ comuns) são conferidas aqui contra as capturas de VRAM.
Rodar (da pasta web/): "$PY" scripts/rom-facts/gfx-fixtures-arenas.py"""
import hashlib, json, os, struct, sys
ANALISE = os.environ.get('SB4_ANALISE', '/Users/dlotuz/Projetos Claude/Bomber Project/analise')
sys.path.insert(0, os.path.join(ANALISE, 'investigacao', 'graficos-formato'))
sys.path.insert(0, os.path.join(ANALISE, 'investigacao', 'arenas-cenario'))
from ac import ROM                                                                             # noqa: E402
from arena_rom import (arena_record, decode_map, map_to_entries, logic_of, build_arena, fallback_offsets,
                       decode_anim_script, p24, w16)                                           # noqa: E402
from render_rom import hud_entries, apply_static_objects                                       # noqa: E402
from decomp import decode_zte, composite_floor, arena9_post                                    # noqa: E402
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'tests', 'fixtures', 'rom', 'gfx-arenas.json')
CEN = os.path.join(ANALISE, 'extraido', 'graficos-formato', 'cenas')
sha = lambda b: hashlib.sha1(bytes(b)).hexdigest()
w16s = lambda ws: sha(struct.pack('<%dH' % len(ws), *ws))
COLOR_MATH = {2: 'half', 6: 'half', 10: 'add'}

def tile_anim_key(cmds):
    out = []
    for c in cmds:
        if c[0] == 'wait': out.append('w%d' % c[1])
        elif c[0] == 'dma': out.append('d%d,%d' % (c[1], c[2]))
        elif c[0] == 'loop': out.append('L')
        else: out.append('E')
    return ' '.join(out)

fe5c = decode_zte(0xC5FE5C)[0]
arenas = []
for n in range(1, 11):
    R = arena_record(n - 1)
    script = R['tiles']
    tiles = bytearray(composite_floor(b''.join(decode_zte(p24(script + 3 * i))[0][:0x1000] for i in range(8))))
    if n == 9: tiles = bytearray(arena9_post(bytes(tiles)))
    tiles[46 * 32:48 * 32] = fe5c[0:64]; tiles[62 * 32:64 * 32] = fe5c[512:576]
    vram = open(os.path.join(CEN, 'arena%02d.vram' % n), 'rb').read()
    assert vram[46 * 32:48 * 32] == fe5c[0:64] and vram[62 * 32:64 * 32] == fe5c[512:576], n
    c1, u1 = decode_map(R['bg1_map']); c2, u2 = decode_map(R['bg2_map']); cf, uf = decode_map(R['floor_map'])
    ent, logic, fent, seed = build_arena(n - 1)
    st = list(ent); apply_static_objects(n, None, st)
    cmds = decode_anim_script(R['obj12']) if R['obj12'] else None
    arenas.append(dict(
        arena=n, record=R['addr'], script=script, removeN=R['b1E'], colorMath=COLOR_MATH.get(n, 'none'),
        tilesLoadedSha1=sha(tiles),
        bg1=dict(used=u1, sha1=w16s(map_to_entries(c1, R['bg1_tbl']))),
        bg2Base=dict(used=u2, sha1=w16s(map_to_entries(c2, R['bg2_tbl']))),
        floor=dict(used=uf, sha1=w16s(map_to_entries(cf, R['bg2_tbl']))),
        logicBaseSha1=w16s([logic_of(c) for c in c2]),
        build=dict(seedIn=0xC689, seedOut=seed, soft=sum(1 for v in logic if v == 0xCC80),
                   bg2Sha1=w16s(ent), logicSha1=w16s(logic), floorSha1=w16s(fent)),
        staticBg2Sha1=w16s(st),
        tileAnim=None if cmds is None else dict(addr=R['obj12'], count=len(cmds), key=sha(tile_anim_key(cmds).encode()))))

# OBJ $6000–$7FFF comuns (16 KB), conferidos contra arena01/arena03 fora das vagas dos jogadores
def obj_common(n):
    buf = bytearray(0x4000); at = lambda w: (w - 0x6000) * 2; z = lambda a: decode_zte(a)[0]
    for a, w in ((0xC8FD36, 0x6800), (0xD187CE, 0x7000), (0xD18F93, 0x7400), (0xD1967F, 0x7800), (0xC5013B, 0x7C00)):
        buf[at(w):at(w) + 0x800] = z(a)[:0x800]
    box = z(0xC7FEA1); buf[at(0x64C0):at(0x64C0) + 128] = box[:128]; buf[at(0x65C0):at(0x65C0) + 128] = box[512:640]
    if n == 3:
        orb = z(0xC8FA44)
        for t in (0, 1, 2, 3, 4, 5, 16, 17, 18, 19, 20, 21): buf[at(0x7C00) + 32 * t:at(0x7C00) + 32 * t + 32] = orb[32 * t:32 * t + 32]
    return bytes(buf)
for n in (1, 3):
    v = open(os.path.join(CEN, 'arena%02d.vram' % n), 'rb').read()[0xC000:]
    b = obj_common(n)
    for lo, hi in ((0x0980, 0x0A00), (0x0B80, 0x0C00), (0x1000, 0x4000)): assert b[lo:hi] == v[lo:hi], (n, hex(lo))

hud = [v for v in hud_entries()[:96]]
base_hud = map_to_entries(decode_map(0xD68EEC, 96)[0], 0xD68F72); base_hud = [(v + 0x2200) & 0xFFFF for v in base_hud]
fb = fallback_offsets()
doc = dict(origem='web/scripts/rom-facts/gfx-fixtures-arenas.py (arenas-cenario/arena_rom.py, render_rom.py)', rom_sha1=sha(ROM),
           arenas=arenas,
           hud=dict(baseSha1=w16s(base_hud), startSha1=w16s(hud)),
           fallback=dict(count=len(fb), first=fb[:3], sha1=w16s(fb)),
           objCommon={'1': sha(obj_common(1)), '3': sha(obj_common(3))},
           bg3=dict(fontSha1=sha(ROM[0x11BC16:0x11BC16 + 1024]), bannersSha1=sha(ROM[0x10F57B:0x10F57B + 1024])),
           objPal7Sha1=sha(ROM[0x17E6DC:0x17E6DC + 32]))
json.dump(doc, open(OUT, 'w'), indent=1); open(OUT, 'a').write('\n')
print('ok', [(a['arena'], a['build']['soft'], hex(a['build']['seedOut'])) for a in arenas])
