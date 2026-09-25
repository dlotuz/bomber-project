# papeis de tile por arena (piso, sombras, pilar, soft, bordas) + dump json de enderecos
import json
from arena_rom import *
from ac import OUT
NAMES = ['The Classic', "Fast 'n' Slow", 'Orb-ital Bombardment', "Don't Push Me", 'School of Hard Shocks',
         'Totally Floored', 'Hide and Blow Seek', 'Spinny Slots', 'Seesaw Yeehaw', 'Sartorial Shenanigans']
out = []
for i in range(10):
    R = arena_record(i)
    fc, _ = decode_map(R['floor_map']); fe = map_to_entries(fc, R['bg2_tbl'])
    bc, _ = decode_map(R['bg2_map'])
    E = lambda r, c: fe[r * 32 + c]
    tbl = R['bg2_tbl']
    roles = dict(piso=E(3, 2) if i != 3 else E(9, 2), sombra_pilar=E(3, 3), sombra_parede=E(1, 4) if i != 3 else E(1, 4),
                 pilar=E(2, 3), soft=w16(tbl + 2), codigo0=w16(tbl), codigo2=w16(tbl + 4))
    codes_used = sorted(set(bc) | set(fc))
    lst = R['tiles']
    d = dict(arena=i + 1, nome=NAMES[i], registro='%06X' % R['addr'], registro_file='0x%06X' % s2f(R['addr']),
             blocos_tiles=['%06X' % p24(lst + 3 * k) for k in range(8)], paletas=['%06X' % p24(lst + 3 * (8 + k)) for k in range(8)],
             bg1_mapa='%06X' % R['bg1_map'], bg1_tabela='%06X' % R['bg1_tbl'], bg2_mapa='%06X' % R['bg2_map'], piso_mapa='%06X' % R['floor_map'],
             bg2_tabela='%06X' % tbl, anim_script='%06X' % R['obj12'], itens='%06X' % R['anim18'], objetos='%06X' % R['obj1B'],
             soft_aleatorios_removidos=R['b1E'], byte15='%02X' % R['b15'], byte16='%02X' % R['b16'],
             papeis={k: '%04X' % v for k, v in roles.items()}, codigos_usados=['%X' % c for c in codes_used])
    out.append(d)
    print(i + 1, d['papeis'], 'codigos', d['codigos_usados'])
json.dump(out, open(OUT + '/arenas_rom.json', 'w'), indent=1, ensure_ascii=False)
