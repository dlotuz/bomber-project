"""Gera tests/fixtures/rom/gfx-scenes.json: reconstrução de VRAM e CGRAM das 11 telas a partir de catalogo.json
(como graficos-formato/loader_test.py) com SHA-1 por segmento, da VRAM montada e da CGRAM. Confere cada segmento
contra a captura do emulador (cenas/<tela>.vram/.cgram), como o loader_test (100 %).
Rodar (da pasta web/): "$PY" scripts/rom-facts/gfx-fixtures-scenes.py"""
import hashlib, json, os, sys
ANALISE = os.environ.get('SB4_ANALISE', '/Users/dlotuz/Projetos Claude/Bomber Project/analise')
GF = os.path.join(ANALISE, 'investigacao', 'graficos-formato')
sys.path.insert(0, GF)
from rom import ROM, rd              # noqa: E402
from decomp import decode_zte        # noqa: E402
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'tests', 'fixtures', 'rom', 'gfx-scenes.json')
CEN = os.path.join(ANALISE, 'extraido', 'graficos-formato', 'cenas')
sha = lambda b: hashlib.sha1(bytes(b)).hexdigest()
A = lambda s: int(s.replace('$', '').replace(':', '').split()[0], 16)
cat = json.load(open(os.path.join(GF, 'catalogo.json')))
zc = {}
def z(a):
    if a not in zc: zc[a] = decode_zte(a)[0]
    return zc[a]
scenes = []
for tag, sc in cat['cenas'].items():
    vram = bytearray(0x10000); written = bytearray(0x10000); segs = []
    real = open(os.path.join(CEN, tag + '.vram'), 'rb').read()
    for s in sc['vram']:
        o, n = A(s['vram_byte']), s['bytes']
        if s['tipo'] == 'zte': d = z(A(s['origem']))[s['offset']:s['offset'] + n]
        elif s['tipo'] == 'raw': d = rd(A(s['origem']) + s['offset'], n)
        elif s['tipo'] == 'zero': d = bytes(n)
        else: d = bytes([s['valor']]) * n
        assert len(d) == n, (tag, s)
        for i in range(n): vram[(o + i) & 0xFFFF] = d[i]; written[(o + i) & 0xFFFF] = 1
        segs.append(dict(vramByte=o, bytes=n, sha1=sha(d)))
    ok = sum(1 for i in range(0x10000) if written[i] and vram[i] == real[i]); tot = sum(written)
    assert ok == tot, (tag, ok, tot)          # 100 % dos bytes escritos batem com a captura
    cg = b''.join(rd(A(r['rom']), 32) for r in sorted(sc['cgram'], key=lambda r: r['paleta']))
    realcg = open(os.path.join(CEN, tag + '.cgram'), 'rb').read()
    lines_ok = sum(1 for i in range(16) if cg[32 * i:32 * i + 32] == realcg[32 * i:32 * i + 32])
    scenes.append(dict(id=tag, segments=segs, written=tot, vramSha1=sha(vram), cgramSha1=sha(cg), cgramLinesEqualCapture=lines_ok))
    print(tag, len(segs), tot, 'cgram', lines_ok)
doc = dict(origem='web/scripts/rom-facts/gfx-fixtures-scenes.py (graficos-formato/catalogo.json, loader_test.py)', rom_sha1=sha(ROM), scenes=scenes)
json.dump(doc, open(OUT, 'w'), indent=1); open(OUT, 'a').write('\n')
