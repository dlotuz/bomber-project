"""Gera tests/fixtures/rom/gfx-anims.json: as 141 animações de animacoes.json (dump_json.py), tabelas de ação,
folhas, paletas, scripts de bomba, quadros dos personagens e rostos do HUD. Fonte: animacoes-sprites/anims.py
(ANI §2, §5.1, §10). Os rostos do HUD ($C4:617F/$C4:61F7) são conferidos aqui contra as capturas de VRAM.
Só números e SHA-1. Rodar (da pasta web/): "$PY" scripts/rom-facts/gfx-fixtures-anims.py"""
import hashlib, json, os, sys
ANALISE = os.environ.get('SB4_ANALISE', '/Users/dlotuz/Projetos Claude/Bomber Project/analise')
sys.path.insert(0, os.path.join(ANALISE, 'investigacao', 'animacoes-sprites'))
sys.path.insert(0, os.path.join(ANALISE, 'investigacao', 'graficos-formato'))
from st import ROM, rom as rd                              # noqa: E402
from anims import parse_anim, parse_ms, p24, char_pal      # noqa: E402
from decomp import decode_zte                              # noqa: E402
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'tests', 'fixtures', 'rom', 'gfx-anims.json')
CEN = os.path.join(ANALISE, 'extraido', 'graficos-formato', 'cenas')
sha = lambda b: hashlib.sha1(bytes(b)).hexdigest()
u16 = lambda a: rd(a, 2)[0] | rd(a, 2)[1] << 8
s8 = lambda v: v - 256 if v & 0x80 else v

def anim_key(a):
    frames = []
    for f in parse_anim(a):
        ex = f['extra']
        ps = ';'.join('%d,%d,%d,%d,%d,%d,%d' % (p['dx'], p['dy'], p['gfx'], p['hf'], p['vf'], p['b12'], p['pal']) for p in parse_ms(f['ms']))
        frames.append('%d,%d,%d:%s' % (f['dur'], s8(ex & 0xFF), s8(ex >> 8), ps))
    return '|'.join(frames)

J = json.load(open(os.path.join(ANALISE, 'extraido', 'animacoes-sprites', 'animacoes.json')))
anims = {}
for k, frames in J['anims'].items():
    a = int(k, 16); key = anim_key(a)
    assert len(key.split('|')) == len(frames), k
    anims[k] = dict(frames=len(frames), sha1=sha(key.encode()))
assert len(anims) == 141, len(anims)
first = {name: dict(addr=int(v['addr'], 16), perChar=[int(x, 16) for x in v['per_char']]) for name, v in J['first_level'].items()}

def decode4(b, off, n):   # tiles 4bpp planares -> índices (64 por tile)
    out = bytearray()
    for t in range(n):
        base = off + 32 * t
        for y in range(8):
            p = [b[base + 2 * y], b[base + 2 * y + 1], b[base + 16 + 2 * y], b[base + 17 + 2 * y]]
            for x in range(8):
                bit = 7 - x
                out.append(sum(((p[k] >> bit) & 1) << k for k in range(4)))
    return bytes(out)

def frame32(sheet, g):    # 32x32 índices, linha a linha
    base = sheet + (g & 3) * 0x80 + (g >> 2) * 0x800
    out = bytearray(1024)
    for r in range(4):
        idx = decode4(rd(base + r * 0x200, 128), 0, 4)
        for t in range(4):
            for y in range(8):
                for x in range(8):
                    out[(r * 8 + y) * 32 + t * 8 + x] = idx[t * 64 + y * 8 + x]
    return bytes(out)

chars = []
for c in range(6):
    sheet, vsheet = p24(0xC20730 + 3 * c), p24(0xC28EBF + 3 * c)
    chars.append(dict(char=c, sheet=sheet, victorySheet=vsheet,
                      framesSha1=sha(b''.join(frame32(sheet, g) for g in range(64))),
                      victorySha1=sha(b''.join(frame32(vsheet, g) for g in range(4))),
                      palettes=[dict(slot=s, addr=char_pal(c, s)[0], attr=char_pal(c, s)[1], sha1=sha(rd(char_pal(c, s)[0], 32))) for s in range(5)]))

# rostos do HUD: buffer $7F:208C = 5 blocos ZTE de $C4:6170 em $1000·i; entrada e = $4A·5 + slot
heads = bytearray(0x5000)
for i in range(5):
    d = decode_zte(p24(0xC46170 + 3 * i))[0][:0x1000]; heads[0x1000 * i:0x1000 * i + len(d)] = d
def head_bytes(e):
    src = u16(0xC4617F + 2 * e)
    return b''.join(bytes(heads[src + r * 0x200:src + r * 0x200 + 64]) for r in range(3))
for sc in ('arena01', 'arena02', 'arena05'):      # capturas com os personagens 0–4 em P1–P5
    v = open(os.path.join(CEN, sc + '.vram'), 'rb').read()
    for s in range(5):
        dst = 0x2000 + u16(0xC461F7 + 2 * s)
        got = b''.join(v[2 * (dst + r * 0x100):2 * (dst + r * 0x100) + 64] for r in range(3))
        assert got == head_bytes((6 + s) * 5 + s), (sc, s)
hud = [dict(char=c, slot=s, entry=(6 + c) * 5 + s, sha1=sha(decode4(head_bytes((6 + c) * 5 + s), 0, 6)))
       for c in range(6) for s in range(5)]

bombs = []
for t in range(7):
    a = p24(0xC156A8 + 3 * t); fr = []; p = a
    while u16(p) not in (0xFFFF, 0xFFFE): fr.append([u16(p), rd(p + 2, 1)[0]]); p += 3
    bombs.append(dict(type=t, addr=a, loop=u16(p) == 0xFFFF, frames=fr))

doc = dict(origem='web/scripts/rom-facts/gfx-fixtures-anims.py (animacoes-sprites/anims.py, animacoes.json)', rom_sha1=sha(ROM),
           chave='dur,mx,my:dx,dy,tile,h,v,big,pal;...|...', anims=anims, firstLevel=first, chars=chars, hudHeads=hud, bombScripts=bombs)
json.dump(doc, open(OUT, 'w'), indent=1); open(OUT, 'a').write('\n')
print('anims', len(anims), 'bombs', [(b['type'], len(b['frames'])) for b in bombs])
