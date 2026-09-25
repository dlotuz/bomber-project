"""Exporta (da ROM) as tabelas de animação decodificadas para conferência do carregador TS."""
import json
from anims import *
from folhas_bg import parse_script, BOMB_SCRIPTS
FIRST = {  # tabela de 1o nivel (16 x ptr24, indexada por personagem +$22&7) -> nome
    'normal_andar_parado': 0xC276C5, 'montado_45': 0xC276F5, 'luva_carregando': 0xC27665,
    'luva_levantar': 0xC27515, 'luva_arremessar': 0xC2755D, 'soco': 0xC2746D, 'item_P_Y': 0xC2749D,
    'tedio_e_saltos': 0xC26F71, 'desconhecida_C26F35': 0xC26F35, 'desconhecida_C27001': 0xC27001,
    'desconhecida_C27049': 0xC27049, 'desconhecida_C27085': 0xC27085, 'desconhecida_C270C1': 0xC270C1,
    'desconhecida_C270FD': 0xC270FD, 'desconhecida_C27139': 0xC27139, 'desconhecida_C27431': 0xC27431,
    'estado_C26CE8': 0xC26CE8, 'montaria_C26C1C': 0xC26C1C, 'montaria_C26C4C': 0xC26C4C,
    'montaria_C26E45': 0xC26E45, 'montaria_C26E8D': 0xC26E8D, 'montaria_C274CD': 0xC274CD,
}
DIRECT = {'morte': 0xC26E15, 'vitoria_rodada': 0xC26F05}   # tabelas de ptr24 direto para anim (por personagem)
def anim_json(a):
    out = []
    for f in parse_anim(a):
        ex = f['extra']; dx = ex & 0xFF; dy = ex >> 8
        out.append(dict(ms=f'{f["ms"]:06X}', dur=f['dur'], move=[dx - 256 if dx & 0x80 else dx, dy - 256 if dy & 0x80 else dy],
                        pieces=[dict(dx=p['dx'], dy=p['dy'], gfx=p['gfx'], hflip=p['hf'], vflip=p['vf'], pal=p['pal'], big=p['b12']) for p in parse_ms(f['ms'])]))
    return out
res = {'first_level': {}, 'anims': {}}
for name, t in FIRST.items():
    per_char = [f'{p24(t + 3*c):06X}' for c in range(8)]
    res['first_level'][name] = dict(addr=f'{t:06X}', per_char=per_char)
    for s in set(per_char):
        s = int(s, 16)
        for i in range(16):
            v = p24(s + 3*i)
            if v >> 16 != 0xD8: break
            res['anims'].setdefault(f'{v:06X}', anim_json(v))
for name, t in DIRECT.items():
    res['first_level'][name] = dict(addr=f'{t:06X}', per_char=[f'{p24(t + 3*c):06X}' for c in range(8)])
    for c in range(8): res['anims'].setdefault(f'{p24(t+3*c):06X}', anim_json(p24(t + 3*c)))
for a in (0xC3E7F7, 0xC3DA94, 0xD8D3A8, 0xD8D3AF, 0xD8D2CC):
    res['anims'][f'{a:06X}'] = anim_json(a)
res['char_sheet'] = [f'{char_base(c):06X}' for c in range(8)]
res['victory_sheet'] = [f'{p24(0xC28EBF + 3*c):06X}' for c in range(8)]
res['palettes'] = {c: [dict(addr=f'{char_pal(c, s)[0]:06X}', attr=char_pal(c, s)[1], colors=[f'{x:04X}' for x in char_pal(c, s)[2]]) for s in range(5)] for c in range(6)}
res['bomb_bg_scripts'] = {bt: dict(addr=f'{a:06X}', frames=[[f'{w:04X}', d] for w, d in parse_script(a)]) for bt, a in BOMB_SCRIPTS}
json.dump(res, open(OUT + 'animacoes.json', 'w'), indent=1)
print(len(res['anims']), 'anims')
