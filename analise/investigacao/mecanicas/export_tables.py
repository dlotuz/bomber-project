"""Exporta as tabelas de mecânica lidas da ROM para analise/extraido/mecanicas/tabelas_mecanica.json (fora do git)."""
from mec import *
import movesim, itemsim, json, struct
def b(a,n): fo=rom24(a); return list(ROM[fo:fo+n])
out = {}
out['velocidade_por_nivel_1_256px'] = {lv: [list(v) for v in movesim.SPEED[lv][:8]] for lv in range(8)}
out['dpad_para_direcao'] = movesim.DPAD
out['codigo_subposicao_C32520'] = [movesim.CODE[i] & 15 for i in range(256)]
out['tabela_direcao_normal_C32C60'] = list(movesim.TBL[0])
out['tabela_direcao_corredor_vertical_C32D40'] = list(movesim.TBL[1])
out['tabela_direcao_corredor_horizontal_C32CD0'] = list(movesim.TBL[2])
out['paridade_C24F25'] = movesim.PAR
out['empurrao_parede_C32A20'] = list(movesim.A20)
out['empurrao_diamante_C32620'] = [list(v) for v in movesim.DIAM]
out['itens_por_fase'] = {st: itemsim.stage_list(st) for st in range(1, 11)}
out['lista_fallback_C41327'] = itemsim.FALLBACK
fo=rom24(0xC1724E); steps=[]
while True:
    v=struct.unpack_from('<h',ROM,fo)[0]; steps.append(v); fo+=2
    if v==-0x8000: break
out['pressao_passos_C1724E'] = steps
def script(off):
    fo=rom24(0xC10000|off); s=[]
    while ROM[fo] not in (0x80,0x81,0x82):
        s.append(list(struct.unpack('bb',ROM[fo:fo+2]))); fo+=2
    return s
fo=rom24(0xC12126); p=struct.unpack('<8H',ROM[fo:fo+16])
out['voo_soco_C12126'] = {d: script(p[d]) for d in range(4)}
out['voo_quique_C1212E'] = {d: script(p[4+d]) for d in range(4)}
for name,t in (('arremesso_1casa_C12579',0xC12579),('arremesso_2casas_C12571',0xC12571),('arremesso_3casas_C12569',0xC12569),('arremesso_4casas_C12561',0xC12561),('arremesso_5casas_C12559',0xC12559)):
    fo=rom24(t); pp=struct.unpack('<4H',ROM[fo:fo+8]); out[name]={d: script(pp[d]) for d in range(4)}
fo=rom24(0xC135C9); pp=struct.unpack('<4H',ROM[fo:fo+8]); out['chute_C135C9']={d: script(pp[d]) for d in range(4)}
json.dump(out, open(OUT+'tabelas_mecanica.json','w'))
print('ok', list(out.keys()))
