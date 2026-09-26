"""Fatos de render das montarias (plano 9, Tarefa 4). Uso:
   ../../extraido/cores/venv/bin/python mount_render_facts.py <caminho de web/>
Grava tests/fixtures/rom/mount-render.json e src/render/rom/mounts/facts.ts. Só números, endereços e SHA-1."""
import os, sys, json, hashlib
BASE = "/Users/dlotuz/Projetos Claude/Bomber Project/analise"
os.environ["SNES9X_CORE"] = BASE + "/extraido/cores/rom-montarias/snes9x/libretro/snes9x_libretro.dylib"
sys.path.insert(0, BASE + "/investigacao/montarias-e-telas")
sys.path.insert(0, BASE + "/investigacao/graficos-formato")
import mt, mount_lib as M, objlist, scr
from decomp import decode_zte

WEB = sys.argv[1]
ROM = mt.ROM
TYPES = [0x2, 0x3, 0xA, 0xC, 0xD, 0xE, 0xF]
DIRS = [('up', 'UP'), ('right', 'RIGHT'), ('down', 'DOWN'), ('left', 'LEFT')]
def p24(a): o = a & 0x3FFFFF; return ROM[o] | ROM[o + 1] << 8 | ROM[o + 2] << 16
def sha1(b): return hashlib.sha1(bytes(b)).hexdigest()

def blocks(st):
    p = 14; B = {}
    while p < len(st) - 10:
        name = st[p:p + 3].decode(); ln = int(st[p + 4:p + 10]); B[name] = st[p + 11:p + 11 + ln]; p += 11 + ln
    return B

def vram_cgram(e):
    B = blocks(e.save()); cg = B['PPU'][64:576]
    return B['VRA'], [cg[2 * i] << 8 | cg[2 * i + 1] for i in range(256)]

def tile4(vram, a):
    out = []
    for r in range(8):
        b0, b1, b2, b3 = vram[a + 2 * r], vram[a + 2 * r + 1], vram[a + 16 + 2 * r], vram[a + 17 + 2 * r]
        for c in range(8):
            s = 7 - c
            out.append(((b0 >> s) & 1) | ((b1 >> s) & 1) << 1 | ((b2 >> s) & 1) << 2 | ((b3 >> s) & 1) << 3)
    return out

def sheet_frame(sheet, g, rom=ROM):
    base = (sheet & 0x3FFFFF) + (g & 3) * 0x80 + (g >> 2) * 0x800; px = [0] * 1024
    for r in range(4):
        for k in range(4):
            for i, v in enumerate(tile4(rom, base + r * 0x200 + k * 32)): px[(r * 8 + (i >> 3)) * 32 + k * 8 + (i & 7)] = v
    return px

def dec_frame(dec, g): return sheet_frame(0xC00000, g, dec)

def obj_px(vram, tile, size):
    n = size // 8; px = [0] * (size * size)
    for ty in range(n):
        for tx in range(n):
            col = ((tile & 0xF) + tx) & 0xF; row = ((tile >> 4) + ty) & 0xF
            tt = (tile & 0x100) | (row << 4) | col
            a = (0xC000 + (tt & 0xFF) * 32 + (0x2000 if tt & 0x100 else 0)) & 0xFFFF
            for i, v in enumerate(tile4(vram, a)): px[(ty * 8 + (i >> 3)) * size + tx * 8 + (i & 7)] = v
    return px

def pieces_near(e, X, Y, rad=40, min_tile=0):
    vram, _ = vram_cgram(e); out = []
    for o in scr.oam(e):
        size = 32 if o['big'] else 16
        if o['tile'] < min_tile: continue   # objetos que não são jogador: ignora os slots de jogador/montaria ($000–$0FF)
        if abs(o['x'] + size // 2 - X) > rad or abs(o['y'] + size // 2 - Y) > rad: continue
        out.append(dict(dx=o['x'] - X, dy=o['y'] - Y, size=size, hflip=bool(o['hf']), vflip=bool(o['vf']),
                        pal=o['pal'], prio=o['pri'], tile=o['tile'], pxSha1=sha1(obj_px(vram, o['tile'], size))))
    return out

def sample(e, base, f, rad=40, min_tile=0):
    w = e.wram()
    X = w[base + 0x12] | w[base + 0x13] << 8; Y = w[base + 0x16] | w[base + 0x17] << 8
    s = dict(f=f, anim=(w[base + 8] | w[base + 9] << 8 | w[base + 10] << 16) - 1, frame=w[base + 0x0C],
             sheet2=w[base + 0xA4] | w[base + 0xA5] << 8 | w[base + 0xA6] << 16, pieces=pieces_near(e, X, Y, rad, min_tile))
    if 0x300 <= base < 0x800:   # objeto de jogador: 2ª animação (+$38, +1 como em +$08) e 1ª folha (+$A0)
        s.update(anim2=max(0, (w[base + 0x38] | w[base + 0x39] << 8 | w[base + 0x3A] << 16) - 1), frame2=w[base + 0x3C],
                 sheet1=w[base + 0xA0] | w[base + 0xA1] << 8 | w[base + 0xA2] << 16)
    return s

def rec(e, base, n, held=None, who='p0', rad=40):
    out = []
    for f in range(n):
        e.run(1, **{who: held or []}); out.append(sample(e, base, f, rad))
    return out

e = mt.new(); fx = dict(source='analise/investigacao/montarias-e-telas/mount_render_facts.py',
                        romSha1=hashlib.sha1(ROM).hexdigest(), riders={}, mounting={}, costumes={}, gfx={}, palettes=[])
pal_seen = {}
def note_pal(scene):
    _, cg = vram_cgram(e)
    for pal in range(8):
        cols = cg[128 + 16 * pal:128 + 16 * pal + 16]
        raw = b''.join(bytes([c & 0xFF, c >> 8]) for c in cols)
        addrs, i = [], ROM.find(raw)
        while i >= 0 and len(addrs) < 4:
            addrs.append(0xC00000 + i); i = ROM.find(raw, i + 1)
        fx['palettes'].append(dict(scene=scene, objPal=pal, sha1=sha1(raw), romAddrs=addrs))

for t in TYPES:
    e.load(open(mt.EST + 'st_arena01.bin', 'rb').read()); e.run(1); M.clear_soft(e)
    p = M.pl(e); e.w16(M.cell(p['x'], p['y']), 0x0940 + (0x30 | t))
    fx['mounting'][format(t, 'x')] = rec(e, 0x300, 43)
    base = e.save(); fx['riders'][format(t, 'x')] = {}
    for name, btn in DIRS:
        e.load(base)
        walk = rec(e, 0x300, 24, [btn]); idle = rec(e, 0x300, 8)
        fx['riders'][format(t, 'x')][name] = dict(walk=walk, idle=idle)
    note_pal('rider_' + format(t, 'x'))
    src = p24(0xC470DC + 3 * t)
    # quadros 32×32 do slot da montaria do P1 (tile $008) vistos na VRAM, em ordem de aparição
    tsha = []
    for d in fx['riders'][format(t, 'x')].values():
        for s in d['walk'] + d['idle']:
            for pc in s['pieces']:
                if pc['tile'] == 0x008 and pc['size'] == 32 and pc['pxSha1'] not in tsha: tsha.append(pc['pxSha1'])
    try:
        dec, _ = decode_zte(src); fmt = 'zte'
        ok = all(any(sha1(dec_frame(dec, g)) == x for g in range(64)) for x in tsha)
    except Exception:
        ok = False
    if not ok:   # leitura crua: folha de 16 tiles de largura, quadro g em +(g&3)·$80 + (g>>2)·$800 (como as folhas de personagem)
        gs = [next((g for g in range(64) if sha1(sheet_frame(src, g)) == x), None) for x in tsha]
        if tsha and None not in gs:
            n = 0x800 * (max(gs) // 4 + 1); dec, fmt = ROM[(src & 0x3FFFFF):(src & 0x3FFFFF) + n], 'raw'
        else:
            dec, fmt = b'', 'unknown'
    fx['gfx'][format(t, 'x')] = dict(tableAddr=0xC470DC + 3 * t, src=src, format=fmt, decodedSha1=sha1(dec), vramTileSha1=tsha)

# desmonte (tipo 2) e remonte (tipo 3 com reserva tipo 2)
M.mount(e, 0x2); e.run(3, p0=['A']); e.run(120)
fx['dismount'] = rec(e, 0x300, 60)
M.mount(e, 0x3); e.w16(M.cell(64, 48), 0x0940 + 0x32)
for f in range(32): e.run(1, p0=['RIGHT'])
def reserve_objs(e):   # rotina $C2:62D7 (o objeto não tem o bit 7 em +$03, então objlist não o acha)
    w = e.wram()
    return [a for a in range(0x800, 0x1C00, 0x10) if (w[a] | w[a + 1] << 8 | w[a + 2] << 16) >> 8 == 0xC262]
# A casa escrita na grade não tem objeto de ovo; ao pegar, o jogo copia o tipo de +$18 desse objeto ($C1:6463).
# Gravamos o id $32 no +$18 do reserva, como ficaria com um ovo revelado de verdade.
for a in reserve_objs(e): e.w8(a + 0x18, 0x32)
fx['reserveEgg'] = []
for f in range(30):
    e.run(1)
    w = e.wram()
    for a in reserve_objs(e):
        fx['reserveEgg'].append(dict(sample(e, a, f, 40, 0x100), x=w[a + 0x12] | w[a + 0x13] << 8, y=w[a + 0x16] | w[a + 0x17] << 8))
# Acerto: a própria bomba também queimaria o reserva (1 casa atrás), então entra direto na rotina de acerto montado $C2:105E.
glow_addr = reserve_objs(e)[0]   # T14b: é o próprio objeto do ovo reserva que "brilha" e revela a montaria — não nasce outro.
e.w16(0x300, 0x105E); e.w8(0x302, 0xC2)
fx['remount'] = []; fx['remountGlow'] = []
for f in range(60):
    e.run(1)
    w = e.wram()
    fx['remount'].append(dict(sample(e, 0x300, f), x=w[0x312] | w[0x313] << 8, y=w[0x316] | w[0x317] << 8))
    fx['remountGlow'].append(dict(sample(e, glow_addr, f, 40, 0x100),
                                   x=w[glow_addr + 0x12] | w[glow_addr + 0x13] << 8, y=w[glow_addr + 0x16] | w[glow_addr + 0x17] << 8))

# ovos no chão (partidas reais de CPU)
fx['eggs'] = []
for st in ('st_ride_pre.bin', 'st_ride_battle.bin'):
    e.load(open(mt.OUT + st, 'rb').read()); e.run(1)
    for lin in range(13):
        for col in range(17):
            code = e.r16(0x2800 + lin * 0x40 + col * 2)
            if (code & 0xFFF0) == 0x0970 and all(g['id'] != 0x30 | (code & 0xF) for g in fx['eggs']):
                X, Y = 16 * col, 16 * (lin + 2)
                objs = [o for o in objlist.objs(e) if abs(o['x'] - X) <= 1 and abs(o['y'] - Y) <= 1]
                smp = [dict(sample(e, objs[0]['a'], 0, 40, 0x100))] if objs else [dict(f=0, anim=0, frame=0, sheet2=0, pieces=pieces_near(e, X, Y, 12, 0x100))]
                fx['eggs'].append(dict(id=0x30 | (code & 0xF), samples=smp))

# projéteis e dança
fx['projectiles'] = {}
for t, key, tx in ((0xD, 'd', 200), (0xE, 'e', 200), (0xF, 'f', 200)):
    M.mount(e, t); e.w16(0x512, tx); e.w16(0x516, 48)
    e.run(1, p0=['RIGHT']); e.run(2, p2=['LEFT']); e.run(2, p2=['RIGHT'])
    before = {(o['a'], o['rt']) for o in objlist.objs(e)}; smp = []; rt = 0
    for f in range(120):
        e.run(1, p0=(['Y'] if f < 3 else []))
        for o in objlist.objs(e):
            if (o['a'], o['rt']) in before or o['rt'] == 0xC34EE6 or not (0x800 <= o['a'] < 0x1400): continue
            rt = rt or o['rt']
            smp.append(dict(sample(e, o['a'], f, 40, 0x100), x=o['x'], y=o['y']))
    fx['projectiles'][key] = dict(rt=rt, samples=smp)
M.mount(e, 0xF); e.w16(0x512, 72); e.w16(0x516, 48)
e.run(1, p0=['RIGHT']); e.run(2, p2=['LEFT']); e.run(2, p2=['RIGHT'])
before = {(o['a'], o['rt']) for o in objlist.objs(e)}
e.run(3, p0=['Y'])
# Objeto das notas (T14b): nasce no próprio tick do Y, nova chave (endereço, rt) que não existia antes.
note_addr = next(o['a'] for o in objlist.objs(e) if (o['a'], o['rt']) not in before)
while (lambda w: w[0x500] | w[0x501] << 8 | w[0x502] << 16)(e.wram()) != 0xC20D83: e.run(1)   # até P2 entrar na rotina de dança
fx['dance'] = [sample(e, 0x500, 0, rad=32)]
fx['danceNote'] = [sample(e, note_addr, 0, 40, 0x100)]
for f in range(1, 160):
    e.run(1)
    fx['dance'].append(sample(e, 0x500, f, rad=32))   # raio menor: o P1 montado fica a 40 px
    fx['danceNote'].append(sample(e, note_addr, f, 40, 0x100))

# trajes (fase 10)
for c in range(8):
    fx['costumes'][str(c)] = {}
    for name, btn in DIRS:
        e.load(open(mt.EST + 'st_arena10.bin', 'rb').read()); e.run(1); M.clear_soft(e)
        e.w8(0x345, 0xE8 | c); e.run(2)
        fx['costumes'][str(c)][name] = dict(walk=rec(e, 0x300, 24, [btn]), idle=rec(e, 0x300, 8))
    note_pal('costume_' + str(c))

json.dump(fx, open(WEB + '/tests/fixtures/rom/mount-render.json', 'w'), separators=(',', ':'))

# facts.ts: endereços distintos (ordem de aparição) por cena
def anims(samples, key='anim'):
    out = []
    for s in samples:
        if s.get(key) and s[key] not in out: out.append(s[key])
    return out
def dir_anims(d, key='anim'):
    return ', '.join('{ walk: [%s], idle: [%s] }' % (', '.join(map(h, anims(d[n]['walk'], key))), ', '.join(map(h, anims(d[n]['idle'], key)))) for n, _ in DIRS)
def h(v): return '0x%06x' % v
def stage_ticks(samples, key='anim'):
    """quantos ticks (amostras) cada endereço aparece antes do próximo trocar, na ordem de aparição; o último
    trecho (aberto — sem endereço seguinte dentro da amostra) não entra, porque não há como medir sua duração total."""
    out = []; cur = samples[0].get(key); n = 0
    for s in samples:
        if s.get(key) != cur: out.append(n); cur = s.get(key); n = 0
        n += 1
    return out
L = ['// gerado por analise/investigacao/montarias-e-telas/mount_render_facts.py — não editar',
     '// ROM SHA-1 ' + fx['romSha1'],
     'export interface DirAnims { walk: number[]; idle: number[] }   // ↑ → ↓ ← (índices 0..3)',
     'export const RIDER_ANIMS: Record<number, DirAnims[]> = {']
for t in TYPES:
    d = fx['riders'][format(t, 'x')]
    L.append('  0x%x: [%s],' % (t, dir_anims(d)))
L.append('};')
L.append('// 2ª animação do objeto do jogador (+$38, guarda endereço + 1 como +$08): desenha a montaria (tile $008 do P1, folha MOUNT_GFX[tipo]).')
L.append('export const MOUNT_ANIMS: Record<number, DirAnims[]> = {')
for t in TYPES:
    L.append('  0x%x: [%s],' % (t, dir_anims(fx['riders'][format(t, 'x')], 'anim2')))
L.append('};')
L.append('export const MOUNTING_MOUNT_ANIMS: Record<number, number[]> = {' + ', '.join('0x%x: [%s]' % (t, ', '.join(map(h, anims(fx['mounting'][format(t, 'x')], 'anim2')))) for t in TYPES) + '};')
L.append('export const MOUNTING_ANIMS: Record<number, number[]> = {' + ', '.join('0x%x: [%s]' % (t, ', '.join(map(h, anims(fx['mounting'][format(t, 'x')])))) for t in TYPES) + '};')
L.append('export const DISMOUNT_ANIMS: number[] = [%s];' % ', '.join(map(h, anims(fx['dismount']))))
L.append('export const REMOUNT_ANIMS: number[] = [%s];' % ', '.join(map(h, anims(fx['remount']))))
L.append('export const REMOUNT_MOUNT_ANIMS: number[] = [%s];   // +$38 durante o remonte' % ', '.join(map(h, anims(fx['remount'], 'anim2'))))
L.append('export const RESERVE_EGG_ANIMS: number[] = [%s];' % ', '.join(map(h, anims(fx['reserveEgg']))))
L.append('export const EGG_ANIMS: number[] = [%s];' % ', '.join(map(h, anims([s for g in fx['eggs'] for s in g['samples']]))))
L.append('export const PROJ_ANIMS: Record<\'d\' | \'e\' | \'f\', number[]> = {' + ', '.join("%s: [%s]" % (k, ', '.join(map(h, anims(v['samples'])))) for k, v in fx['projectiles'].items()) + '};')
L.append('export const DANCE_ANIMS: number[] = [%s];' % ', '.join(map(h, anims(fx['dance']))))
L.append('// Notas da dança (T14b): objeto OAM independente da nota que acerta (tipo F, Y), não o jogador dançando.')
L.append('// Nasce no tick do acerto e usa esta única animação, medida com 4 quadros de 10 ticks (40 no total); depois some.')
L.append('export const DANCE_NOTE_ANIMS: number[] = [%s];' % ', '.join(map(h, anims(fx['danceNote']))))
L.append('// Ticks medidos em que o objeto da nota tem peça visível perto do jogador (0 = no próprio tick do acerto).')
DANCE_NOTE_TICKS = next(i for i, s in enumerate(fx['danceNote']) if not s['pieces'])
L.append('export const DANCE_NOTE_TICKS: number = %d;' % DANCE_NOTE_TICKS)
L.append('// Ticks medidos de cada quadro de DANCE_NOTE_ANIMS[0] (não a duração da tabela: o quadro 0 já nasce')
L.append('// parcial, porque a captura começa no tick em que o jogador entra na rotina de dança, alguns ticks')
L.append('// depois do próprio objeto da nota já ter entrado no quadro 0 da explosão).')
L.append('export const DANCE_NOTE_FRAME_TICKS: number[] = [%s];' % ', '.join(map(str, stage_ticks(fx['danceNote'][:DANCE_NOTE_TICKS], 'frame'))))
L.append('// Ovo reserva "brilhando" → explosão de brilho → revelação da montaria, no remonte (T14b). É o próprio objeto')
L.append('// do ovo reserva (não nasce outro): brilha parado na casa de origem, "pula" até o jogador e estoura.')
L.append('export const REMOUNT_GLOW_ANIMS: number[] = [%s];' % ', '.join(map(h, anims(fx['remountGlow']))))
L.append('// Ticks medidos de cada um dos 2 primeiros endereços de REMOUNT_GLOW_ANIMS antes de trocar (o 3º, a explosão,')
L.append('// não tem limite próprio medido aqui — REMOUNT_TICKS do core já corta a fase antes dele se esgotar sozinho).')
L.append('export const REMOUNT_GLOW_STAGE_TICKS: number[] = [%s];' % ', '.join(map(str, stage_ticks(fx['remountGlow']))))
L.append('export const COSTUME_ANIMS: Record<number, DirAnims[]> = {')
for c in range(8):
    d = fx['costumes'][str(c)]
    L.append('  %d: [%s],' % (c, dir_anims(d)))
L.append('};')
L.append('// folha do jogador com traje (+$A0 medido), = p24(COSTUME_SHEET_TABLE + 3·traje); mesma fórmula de quadro das folhas de personagem')
L.append('export const COSTUME_SHEET_TABLE = 0xc20718;')
L.append('export const COSTUME_SHEETS: Record<number, number> = {' + ', '.join('%d: %s' % (c, h(fx['costumes'][str(c)]['right']['idle'][-1]['sheet1'])) for c in range(8)) + '};')
L.append('export const MOUNT_GFX: Record<number, { src: number; format: \'zte\' | \'raw\' | \'unknown\' }> = {' + ', '.join("0x%x: { src: %s, format: '%s' }" % (t, h(fx['gfx'][format(t, 'x')]['src']), fx['gfx'][format(t, 'x')]['format']) for t in TYPES) + '};')
L.append('export const MOUNT_SHEET_TABLE = 0xc470dc;   // MOUNT_GFX[t].src = p24(MOUNT_SHEET_TABLE + 3·t) = +$A4 do jogador montado')
L.append('export const SHEET2 = %s;   // +$A4 medido montado no tipo 2 (esperado $D4:0000; nos outros tipos +$A4 = MOUNT_GFX[t].src)' % h(fx['riders']['2']['right']['idle'][0]['sheet2']))
open(WEB + '/src/render/rom/mounts/facts.ts', 'w').write('\n'.join(L) + '\n')
print('ok', os.path.getsize(WEB + '/tests/fixtures/rom/mount-render.json'))
