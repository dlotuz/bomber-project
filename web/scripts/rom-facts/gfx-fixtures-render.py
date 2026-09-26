"""Gera tests/fixtures/rom/gfx-render-bg.json: SHA-1 do render só de BG (render_rom.py) das 10 arenas.
Rodar (da pasta web/): "$PY" scripts/rom-facts/gfx-fixtures-render.py
  PY = analise/extraido/cores/venv/bin/python do projeto principal (tem Pillow). Usa SB4_ANALISE (padrão abaixo)."""
import hashlib, json, os, sys
ANALISE = os.environ.get('SB4_ANALISE', '/Users/dlotuz/Projetos Claude/Bomber Project/analise')
sys.path.insert(0, os.path.join(ANALISE, 'investigacao', 'graficos-formato'))
sys.path.insert(0, os.path.join(ANALISE, 'investigacao', 'arenas-cenario'))
from render_rom import render_arena          # noqa: E402
from ac import ROM                            # noqa: E402
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'tests', 'fixtures', 'rom', 'gfx-render-bg.json')
cases = [(n, 8) for n in range(1, 11)] + [(2, 0x18)]
arenas = []
for n, hofs in cases:
    im = render_arena(n - 1, bg1_hofs=hofs)
    assert im.mode == 'RGB' and im.size == (256, 224)
    arenas.append(dict(stage=n, bg1Hofs=hofs, tileCopies=[], sha1=hashlib.sha1(im.convert('RGBA').tobytes()).hexdigest()))
    print(n, hofs, arenas[-1]['sha1'])
doc = dict(origem='web/scripts/rom-facts/gfx-fixtures-render.py (arenas-cenario/render_rom.render_arena)',
           rom_sha1=hashlib.sha1(ROM).hexdigest(), hash='SHA-1 de ImageData.data: RGBA 256x224 linha a linha, alfa 255', arenas=arenas)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(doc, open(OUT, 'w'), indent=1); open(OUT, 'a').write('\n')
