"""Gera catalogo.md a partir de catalogo.json."""
import json, collections
cat = json.load(open('catalogo.json'))
L = []
w = L.append
w('# Catálogo de gráficos do Battle Mode — Super Bomberman 4 (ROM do usuário, com patch de tradução)\n')
w('Gerado por `build_catalog_md.py` a partir de `catalogo.json` (a fonte de verdade para o carregador).')
w('Endereços SNES `$BB:AAAA` (HiROM); offset no arquivo = `((BB & 0x3F) << 16) | AAAA`. ZTE = tiles com elisão de tile zerado (ver RELATORIO.md §2).')
w('Validação: ✅ = reconstruído da ROM e comparado byte a byte com a VRAM/CGRAM do emulador (`recipe.py`, `loader_test.py`).\n')
w(f"ROM: `{cat['rom']['arquivo']}`, {cat['rom']['tamanho']} bytes, SHA-1 `{cat['rom']['sha1']}`.\n")
w('## 1. Layout de VRAM (todas as cenas do Battle) ✅\n')
w('| Item | Endereço (palavra) |\n|---|---|')
for k, v in cat['vram_layout'].items(): w(f'| {k} | {v} |')
w('\n## 2. Arenas ✅\n')
a = cat['arenas']
w(f"- Tabela de descritores: `{a['tabela_descritores']}`; registro: {a['tamanho_registro']}.")
w(f"- Script gráfico: {a['script_gfx']}.")
w(f"- Correção de paleta após carregar: {a['fixup_paleta']}.")
w('- Depois dos 8 blocos: composição do piso sob os tiles 768–1023 (`composite_floor`); arena 9: `arena9_post` no início da partida.\n')
w('| # | Nome | Descritor | Script | Blocos 0–3 (cenário da arena, VRAM $0000–$1FFF) | Paletas BG 0–7 (CGRAM 0–127) | Paleta animada em jogo |')
w('|---|---|---|---|---|---|---|')
for ar in a['lista']:
    bl = ', '.join(f"`{b['rom']}` ({b['comprimido']} B)" for b in ar['blocos_bg'][:4])
    pl = ', '.join(f"`{p['rom']}`" for p in ar['paletas_bg'])
    w(f"| {ar['arena']} | {ar['nome']} | `{ar['descritor']}` | `{ar['script_gfx']}` | {bl} | {pl} | {ar['paleta_animada_em_jogo']} |")
w('\nBlocos 4–7 (iguais nas 10 arenas):\n')
w('| Slot | ROM | Arquivo | Comprimido | Tiles 4bpp | VRAM (palavra) | Conteúdo |\n|---|---|---|---|---|---|---|')
for b in a['lista'][0]['blocos_bg'][4:]:
    w(f"| {b['slot']} | `{b['rom']}` | {b['arquivo']} | {b['comprimido']} | {b['tiles_4bpp']} | {b['vram_word']} | {b['conteudo']} |")
w('\nVariantes de descritor (mesmo script gráfico, mapas diferentes — interessa à frente arenas-cenario): ')
w(', '.join(f"{ar['arena']}: " + '/'.join(f'`{v}`' for v in ar['variantes_descritor']) for ar in a['lista']))
w('\n## 3. Comum a todas as partidas ✅\n')
pc = cat['partida_comum']
w('| Camada | ROM | Formato | Bytes | VRAM (palavra) | Conteúdo |\n|---|---|---|---|---|---|')
for b in pc['bg3']: w(f"| BG3 | `{b['rom']}` | {b['formato']} | {b['bytes']} | {b['vram_word']} | {b['conteudo']} |")
for b in pc['obj']: w(f"| OBJ/BG | `{b['rom']}` | zte ({b['comprimido']} B) | {b['bytes']} | {b['vram_word']} | {b['conteudo']} |")
h = pc['hud_rostos']
w(f"\nCabeças animadas do HUD: tabela `{h['tabela']}` = {', '.join('`'+x+'`' for x in h['blocos'])}; {h['destino']}.\n")
po = pc['paleta_obj']
w(f"Paletas OBJ: slot 15 = `{po['slot15']['rom']}` ({po['slot15']['uso']}); jogadores: {po['jogadores']}; times: {po['tabela_times']}.\n")
w('## 4. Personagens ✅ (bancos confirmados pelo DMA de cada jogador; nomes descritivos)\n')
w('| id | Personagem | Sprites (4bpp cru) | Paletas P1–P5 (tabela $C2:779D) |\n|---|---|---|---|')
for c in cat['personagens']:
    w(f"| {c['id']} | {c['nome']} | {c['sprites']} | {', '.join('`'+p['rom']+'`' for p in c['paletas_por_jogador'])} |")
w(f"\nFormato: {cat['personagens'][0]['formato']}.\n")
w('## 5. Telas (menus, título, placar, vitória, empate) ✅\n')
w('Cada tela lista as origens dos tiles na VRAM (segmentos completos em `catalogo.json` → `cenas.<tela>.vram`, na ordem de aplicação).\n')
for tag, sc in cat['cenas'].items():
    w(f"### {tag} — {sc['descricao']}\n")
    w(f"- Script/carregamento: {sc['script_gfx']}")
    if 'obj' in sc: w(f"- OBJ: {sc['obj']}")
    agg = collections.OrderedDict()
    for s in sc['vram']:
        if s['tipo'] in ('zte', 'raw', 'zte+piso'):
            key = (s['tipo'], s['origem'])
            agg.setdefault(key, []).append(int(s['vram_word'][1:], 16))
    parts = []
    for (t, o), ws in agg.items():
        parts.append(f"`{o}` {t} → ${min(ws):04X}–${max(ws):04X} ({len(ws)} seg.)")
    w('- Origens: ' + '; '.join(parts))
    w('- Paletas (linha: ROM): ' + ', '.join(f"{r['paleta']}:`{r['rom']}`" + ('' if r['busca'] == 'exato' else '*') for r in sc['cgram']))
    w('')
w('`*` = casou com a ROM ignorando a cor 0 (a cor 0 é escrita à parte pelo jogo).\n')
open('catalogo.md', 'w').write('\n'.join(L) + '\n')
print('ok')
