"""Gera tests/fixtures/rom/gfx-formats.json: goldens dos formatos (ZTE, Modo 7, tiles e paletas das arenas).
Fonte: graficos-formato/decomp.py (validado 307/307 no emulador). Só números e SHA-1; nenhum byte da ROM.
Rodar (da pasta web/): "$PY" scripts/rom-facts/gfx-fixtures-formats.py"""
import hashlib, json, os, sys
ANALISE = os.environ.get('SB4_ANALISE', '/Users/dlotuz/Projetos Claude/Bomber Project/analise')
sys.path.insert(0, os.path.join(ANALISE, 'investigacao', 'graficos-formato'))
from rom import ROM, r24                                                                        # noqa: E402
from decomp import decode_zte, composite_floor, arena9_post, decode_m7rle, arena_bg_palettes    # noqa: E402
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'tests', 'fixtures', 'rom', 'gfx-formats.json')
sha = lambda b: hashlib.sha1(bytes(b)).hexdigest()
A = lambda s: int(s.replace('$', '').replace(':', ''), 16)

# 1) os 91 blocos ZTE distintos chamados pelo jogo nas 15 cenas (validacao_chamadas.json, todos ok=True)
calls = json.load(open(os.path.join(ANALISE, 'extraido', 'graficos-formato', 'validacao_chamadas.json')))
assert all(c['ok'] for c in calls), 'validação do emulador com falhas'
zte = []
for addr in sorted({A(c['origem']) for c in calls}):
    d, used = decode_zte(addr)
    zte.append(dict(addr=addr, used=used, len=len(d), sha1=sha(d)))
assert len(zte) == 91, len(zte)

# 2) RLE do Modo 7 do DRAW GAME
m7, up, um = decode_m7rle(0xCD9800, 0xD660D9)
assert (up, um) == (6548, 499)

# 3) 32 KB de BG por arena (11 envios: o 2º da arena 9 depois de arena9_post) e CGRAM 0–127
uploads, palettes = [], []
for k in range(1, 11):
    script = r24(r24(0xC36233 + 3 * (k - 1)))
    base = composite_floor(b''.join(decode_zte(r24(script + 3 * i))[0][:0x1000] for i in range(8)))
    uploads.append(dict(arena=k, upload=1, sha1=sha(base)))
    if k == 9: uploads.append(dict(arena=9, upload=2, sha1=sha(arena9_post(base))))
    palettes.append(dict(arena=k, sha1=sha(arena_bg_palettes(script))))

doc = dict(origem='web/scripts/rom-facts/gfx-fixtures-formats.py (graficos-formato/decomp.py)', rom_sha1=sha(ROM),
           zte=zte, m7=dict(pix=0xCD9800, map=0xD660D9, usedPix=up, usedMap=um, sha1=sha(m7)),
           arenaUploads=uploads, arenaPalettes=palettes)
json.dump(doc, open(OUT, 'w'), indent=1); open(OUT, 'a').write('\n')
print('zte', len(zte), 'uploads', len(uploads))
