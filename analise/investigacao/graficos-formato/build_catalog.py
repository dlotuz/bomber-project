"""Monta catalogo.json (e as tabelas de catalogo.md) a partir da ROM + dos mapas de VRAM validados (recipe.py)."""
import sys, os, json, hashlib; sys.path.insert(0, '.')
from rom import ROM, rd, r24, hx, fo
from decomp import decode_zte, decode_m7rle
from pal_attr import attr
BASE = "/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/graficos-formato"
CEN = BASE + '/cenas'
HERE = os.path.dirname(os.path.abspath(__file__))

def fofs(a): return f'0x{fo(a):06X}'
def zinfo(a):
    d, n = decode_zte(a)
    return dict(rom=hx(a), arquivo=fofs(a), formato='zte', comprimido=n, bytes=len(d), tiles_4bpp=len(d) // 32)

NOMES = ["The Classic", "Fast 'n' Slow", "Orb-ital Bombardment", "Don't Push Me", "School of Hard Shocks",
         "Totally Floored", "Hide and Blow Seek", "Spinny Slots", "Seesaw Yeehaw", "Sartorial Shenanigans"]
CONT_BLOCO = {4: 'HUD da partida (barra do topo: relógio, cabeças dos jogadores, dígitos, contadores)',
              5: 'painéis de itens (power-ups: bomba, fogo, patins, luva, soco, chute, P, caveira, ...) e ícones',
              6: 'bombas e chamas da explosão (parte 1); recebem o piso por baixo ($C4:4BDD)',
              7: 'bombas e chamas da explosão (parte 2), variantes de bomba (D/S/H...); recebem o piso por baixo'}
ANIM_PAL = {1: 'pal4 cor15', 8: 'pal0 cor0, pal4 cor15', 9: 'pal4 cor15, pal5 cores 12-15', 10: 'pal4 cor15, pal5 cores 4-8'}

def arenas():
    out = []
    tab = 0xC36233
    for k in range(10):
        desc = r24(tab + 3 * k)
        script = r24(desc)
        blocos = []
        for i in range(8):
            a = r24(script + 3 * i); z = zinfo(a)
            z.update(slot=i, buffer_wram=f'$7F:{0x8000 + 0x1000 * i:04X}', vram_word=f'${0x800 * i:04X}',
                     tiles=f'{128 * i}-{128 * i + 127}',
                     conteudo=CONT_BLOCO.get(i, 'cenário próprio da arena (piso, paredes, blocos fixos e destrutíveis, bordas, objetos)'))
            blocos.append(z)
        pals = [dict(slot=i, rom=hx(r24(script + 24 + 3 * i)), arquivo=fofs(r24(script + 24 + 3 * i)), cgram=f'{16 * i}-{16 * i + 15}') for i in range(8)]
        out.append(dict(arena=k + 1, nome=NOMES[k], descritor=hx(desc),
                        variantes_descritor=[hx(desc + 0x22 * v) for v in range(4)],
                        script_gfx=hx(script), blocos_bg=blocos, paletas_bg=pals,
                        pos_processamento=(['composicao_piso'] + (['arena9_post'] if k == 8 else [])),
                        paleta_animada_em_jogo=ANIM_PAL.get(k + 1, 'pal4 cor15')))
    return out

def vmap_segments(tag, lo=0, hi=0x10000, skip_maps=True):
    v = json.load(open(f'{CEN}/{tag}.vmap.json'))
    segs = []
    for r in v:
        a = int(r['vram_byte'], 16)
        if not (lo <= a < hi): continue
        if r['tipo'] == 'wram?': continue
        if skip_maps and (0x8000 <= a < 0xA000 or 0xA800 <= a < 0xC000): continue
        s = dict(vram_word=f'${a // 2:04X}', vram_byte=f'${a:04X}', bytes=r['bytes'], tipo=r['tipo'])
        if r['tipo'] in ('zte', 'zte+piso', 'raw'):
            s.update(origem=r['origem'], offset=r['offset'])
        elif r['tipo'] == 'fill':
            s.update(valor=r['origem'])
        segs.append(s)
    return segs

def cgram_rows(tag):
    cg = open(f'{CEN}/{tag}.cgram', 'rb').read()
    rows = []
    for row, how, f in attr(cg):
        rows.append(dict(paleta=row, cgram=f'{16 * row}-{16 * row + 15}', camada='BG' if row < 8 else 'OBJ',
                         rom=f[0] if f else None, busca=how, candidatos=f[1:]))
    return rows

CENAS = {
    'title': dict(descricao='Tela-título (menu NORMAL/BATTLE/PASSWORD da tradução)', script_gfx='$C1:C182 (via $E0:FE44, rotina do patch)',
                  obj='ZTE $C8:0000,$C8:0670,$C8:0C64,$C7:FA7E,$C7:E1B6,$C7:E6F0,$C7:EE58,$C7:F46B -> $7F:0800 -> VRAM (rotina $C4:371D)'),
    'vsmode': dict(descricao='"Select a VS mode!"', script_gfx='$C1:C1B2 (via $E0:FE44) + textos crus do patch ($E0/$E1)'),
    'ffa': dict(descricao='Free-for-All / Team Battle', script_gfx='$C1:C1B2 + textos do patch'),
    'players': dict(descricao='"Decide on the players!"', script_gfx='$C1:C1B2 + textos do patch'),
    'rules': dict(descricao='"Configure the rules!"', script_gfx='$C1:C1B2 + textos do patch'),
    'charsel': dict(descricao='"Select a character!"', script_gfx='$C1:C1E2 (via $E0:FE44) + textos do patch; OBJ ZTE $CE:53D7,$CE:5BBB,$CE:60F5'),
    'stagesel': dict(descricao='"Select a stage!" (prévias das arenas)', script_gfx='$C1:C1E2 e depois $C1:A901 (tiles das prévias, 8 blocos; carregado por $C1:A262); nomes das fases: tiles crus do patch $E0:0021.. (DMA direto $E0:401B..)'),
    'scoreboard': dict(descricao='SCORE BOARD (coroas)', script_gfx='$C2:9C35 (mesmo tileset da vitória); OBJ ZTE $C9:F997,$CA:F0B0,$CA:F8B3,$CD:E585 (cabeças, coroas, troféu)'),
    'victory': dict(descricao='VICTORY! (troféu)', script_gfx='$C2:9C35; OBJ ZTE $C9:F997,$CA:F0B0,$CA:F8B3,$CD:E585; poses dos personagens por DMA direto'),
    'draw1': dict(descricao='DRAW GAME (fase Modo 7, zoom)', script_gfx='Modo 7: RLE duplo $C4:6201 com pixels $CD:9800 e mapa $D6:60D9 -> 32 KB VRAM $0000'),
    'draw2': dict(descricao='DRAW GAME (fase final, BG2)', script_gfx='ZTE $CD:B195,$CD:C11C,$CD:D11F,$CD:E122 (tabela $C2:DC09) -> $7F:208C -> VRAM word $4000-$5BFF (tiles do BG2, NBA=$44)'),
}

def main():
    cat = dict(
        versao=1,
        rom=dict(arquivo='Super Bomberman 4 (USA).sfc', tamanho=len(ROM), sha1=hashlib.sha1(ROM).hexdigest(), crc_md5_na_analise='CRC32 4DC7D0D3',
                 mapeamento='HiROM: offset = ((banco & 0x3F) << 16) | endereço (bancos $C0-$FF); os bancos $E0-$E2 são do patch de tradução'),
        formatos=dict(
            zte='Tiles com elisão de tile zerado. byte Z, byte E; depois: b==Z -> 32 zeros (consome 1); b==E -> fim (consome 1); senão 32 bytes literais (consome 32). Rotinas $C4:09A5 e $C1:874D.',
            raw_4bpp='Tiles 4bpp planares do SNES sem compressão (32 bytes/tile), lidos por DMA direto da ROM.',
            raw_2bpp='Tiles 2bpp planares (16 bytes/tile), DMA direto.',
            m7rle='RLE duplo do Modo 7 ($C4:6201): fluxo de pixels (b<$80 literal; b>=$80 -> valor b&$7F repetido N=próximo byte) e fluxo de mapa (b!=$01 literal; b==$01 -> N, valor); intercalados em palavras (baixo=mapa, alto=pixel).',
            paleta='BGR555 little-endian, 16 cores = 32 bytes, sem compressão.',
            composicao_piso='$C4:4BDD/$C4:4C5C: nos tiles 768-1023 do buffer de 32 KB, pixel de cor 0 recebe o pixel do tile 8+(n&1)+16*((n>>4)&1).',
            arena9_post='$C3:215C: cópias $7F:A000->AC00 ($400), $7F:B800->A400 ($800), $7F:B800->B000 ($800); composição de $7F:9D80 sob $7F:A000 (96 tiles) e de $7F:9C80 sob $7F:AC00 (96 tiles).'),
        vram_layout=dict(BGMODE='Modo 1 (+prioridade BG3); tiles 16x16 em BG1/BG2 (menus) e BG1-3 (partida)', BG1_mapa='$4000', BG2_mapa='$4400',
                         BG3_mapa='$5400 (64x64)', BG12_tiles='$0000 (4bpp, 1024 tiles)', BG3_tiles='$5000 (2bpp)', OBJ='$6000 (OBSEL=$63: 16x16 e 32x32, 512 tiles)',
                         observacao='endereços em palavras de VRAM'),
        arenas=dict(tabela_descritores='$C3:6233 (3 bytes por arena; 12 entradas, 10 usadas no Battle)', tamanho_registro='$88 por arena = 4 variantes de $22 bytes (+0 ponteiro do script gráfico, +3.. mapas)',
                    script_gfx='48 bytes: 8 ponteiros de blocos ZTE (-> $7F:8000 + $1000*i) + 8 ponteiros de paleta BG (32 bytes cada -> CGRAM 16*i)',
                    fixup_paleta='$C4:4E2F: cores 13-15 da paleta 7 copiadas para as cores 13-15 das paletas 2 e 3',
                    lista=arenas()),
        partida_comum=dict(
            bg3=[dict(rom='$D1:BC16', arquivo=fofs(0xD1BC16), formato='raw_2bpp', bytes=1024, vram_word='$5000', conteudo='fonte ASCII 8x8 (64 tiles)'),
                 dict(rom='$D0:F57B', arquivo=fofs(0xD0F57B), formato='raw_2bpp', bytes=1024, vram_word='$5200', conteudo='faixas "PAUSE!", "HURRY!", "TIME UP!"')],
            obj=[dict(zinfo(0xC8FD36), vram_word='$6800', conteudo='efeitos pequenos (faíscas/fragmentos)'),
                 dict(zinfo(0xD187CE), vram_word='$7000', conteudo='esferas e cilindros grandes, rastro de fogo'),
                 dict(zinfo(0xD18F93), vram_word='$7400', conteudo='nuvens de fumaça/poeira, brilhos, sombra'),
                 dict(zinfo(0xD1967F), vram_word='$7800', conteudo='bombas (normal, remota, espinhos, D/S/H), números 0-1'),
                 dict(zinfo(0xC5013B), vram_word='$7C00', conteudo='números 2-9, ícones (lança-chamas, notas musicais, placas)'),
                 dict(zinfo(0xC8FA44), vram_word='$7C00 (só arena 3, sobrepõe parte de $C5:013B)', conteudo='objetos da arena 3'),
                 dict(zinfo(0xC7FEA1), vram_word='$64C0 e $65C0 (2 x 4 tiles)', conteudo='caixa/ícone 32x16'),
                 dict(zinfo(0xC5FE5C), vram_word='$02E0 e $03E0 (BG, 2 x 2 tiles)', conteudo='tiles de BG animados')],
            hud_rostos=dict(tabela='$C4:6170', blocos=[hx(r24(0xC46170 + 3 * i)) for i in range(5)], destino='$7F:208C + $1000*i, depois pedaços de 64 bytes por DMA ($C4:6157) para VRAM word $2010.. (cabeças do HUD de cada jogador)'),
            paleta_obj=dict(slot15=dict(rom='$D7:E6DC', uso='bombas, chamas e efeitos (OBJ pal 7)'),
                            jogadores='tabela $C2:779D: índice = personagem*32 + jogador*4 -> ponteiro 24 bits + byte de atributo; slot OBJ = 8 + (atributo>>1) -> 8,9,12,13,14 para P1..P5',
                            tabela_times='$C2:7B9D (mesma estrutura; uma cor por personagem)')),
        personagens=[],
        cenas={},
    )
    NOMEP = ['Bomberman branco', 'ciborgue de monóculo', 'bomber de capacete amarelo ("felino laranja" na análise anterior)', 'cavaleiro alado (mochila de asas)',
             'verde blindado', 'vermelho/roxo']
    BANCOS = ['$D2:0000-$D2:7FFF', '$CB:0000-$CB:7FFF', '$CB:8000-$CB:FFFF', '$CC:0000-$CC:7FFF (+ quadros com ponteiros por linha em $CA, ex. $CA:0DC3)',
              '$CC:8000-$CC:FFFF', '$CD:0000-$CD:7FFF']
    for c in range(6):
        cat['personagens'].append(dict(id=c, nome=NOMEP[c], sprites=BANCOS[c], formato='raw_4bpp, folha de 16 tiles de largura (linha = $200 bytes), quadros 32x32; enviado quadro a quadro por DMA ($C1:8949..$C1:8A84, 4 linhas de 128 bytes)',
                                       paletas_por_jogador=[dict(jogador=p + 1, rom=hx(r24(0xC2779D + 32 * c + 4 * p)), atributo=f'${ROM[fo(0xC2779D + 32 * c + 4 * p + 3)]:02X}') for p in range(5)]))
    for tag, info in CENAS.items():
        d = dict(info)
        d['vram'] = vmap_segments(tag)
        d['cgram'] = cgram_rows(tag)
        cat['cenas'][tag] = d
    # arenas: segmentos observados em BG3 e OBJ da arena 1 (comuns)
    cat['partida_comum']['vram_observada_arena01'] = vmap_segments('arena01', 0xA000, 0x10000)
    json.dump(cat, open(os.path.join(HERE, 'catalogo.json'), 'w'), indent=1, ensure_ascii=False)
    print('ok', len(json.dumps(cat)))

if __name__ == '__main__':
    main()
