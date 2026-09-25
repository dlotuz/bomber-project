"""Experimentos de evento -> SFX. uso: run_exp.py <nome>  (ver EXPS abaixo). Imprime eventos de som com frame relativo."""
import sys
from aemu import *
D = SCR + '/rom-audio/'
P1 = 0x0300
def setup_items(e, **flags):
    for off, v in flags.items(): e.w8(P1 + int(off[1:], 16), v)

def grid_set(e, col, row, lo, hi):
    a = 0x2800 + row * 0x40 + col * 2; e.w8(a, lo); e.w8(a + 1, hi)

EXPS = {
 # nome: (estado, função(e, mark))
}
def exp(name, st):
    def deco(fn): EXPS[name] = (st, fn); return fn
    return deco

@exp('bomba', 'st_arena01')
def _(e, mark):
    mark('A (colocar bomba)'); e.run(4, p0=['A']); e.run(6)
    mark('andar DOWN p/ fugir'); e.run(20, p0=['DOWN']); e.run(20, p0=['RIGHT']) ; e.run(150)
    mark('fim')

@exp('morte', 'st_arena01')
def _(e, mark):
    mark('A (bomba) e ficar parado'); e.run(4, p0=['A']); e.run(300); mark('fim')

@exp('item', 'st_arena01')
def _(e, mark):
    # coloca itens nas casas abaixo de P1 (col 2, linhas 2..)
    for r, it in ((2, 0x01), (3, 0x03)):
        grid_set(e, 2, r, 0x40 | it, 0x09)
    mark('DOWN sobre item Bomb Up (linha 2) e Fire Up (linha 3)'); e.run(40, p0=['DOWN']); e.run(30); mark('fim')

@exp('pause', 'st_arena01')
def _(e, mark):
    mark('START (pausa)'); e.run(3, p0=['START']); e.run(60); mark('START (despausa)'); e.run(3, p0=['START']); e.run(60); mark('fim')

@exp('chute', 'st_arena01')
def _(e, mark):
    setup_items(e, o4A=0xFF)
    mark('A bomba'); e.run(4, p0=['A']); e.run(4)
    mark('DOWN 16f (sai da bomba)'); e.run(16, p0=['DOWN'])
    mark('UP (chuta a bomba para cima?)'); e.run(20, p0=['UP']); e.run(20)
    mark('fim')

@exp('soco', 'st_arena01')
def _(e, mark):
    setup_items(e, o48=0xFF)
    mark('A bomba'); e.run(4, p0=['A']); e.run(4)
    mark('DOWN 16f'); e.run(16, p0=['DOWN']); e.run(2)
    mark('UP 2f (vira)'); e.run(2, p0=['UP']); e.run(2)
    mark('Y (soco)'); e.run(4, p0=['Y']); e.run(80)
    mark('fim')

@exp('luva', 'st_arena01')
def _(e, mark):
    setup_items(e, o49=0xFF)
    mark('A bomba (segura A = levantar)'); e.run(4, p0=['A']); e.run(30, p0=['A'])
    mark('solta A (arremessa)'); e.run(80)
    mark('fim')

@exp('remota', 'st_arena01')
def _(e, mark):
    setup_items(e, o43=0x01)
    mark('A bomba'); e.run(4, p0=['A']); e.run(4); e.run(20, p0=['DOWN']); e.run(20, p0=['RIGHT']); e.run(10)
    mark('B detona'); e.run(4, p0=['B']); e.run(60)
    mark('fim')

@exp('caveira', 'st_arena01')
def _(e, mark):
    grid_set(e, 2, 2, 0xA1, 0x09)
    mark('DOWN sobre caveira'); e.run(40, p0=['DOWN']); e.run(60); mark('fim')

@exp('itens_todos', 'st_arena01')
def _(e, mark):
    for it in (0x01,0x03,0x05,0x07,0x0D,0x0E,0x12,0x06,0x0A,0x0B,0x0C,0x08,0x04,0x09,0x02):
        e.state('st_arena01'); grid_set(e, 2, 2, 0x40 | it, 0x09)
        mark('item %02X' % it); e.run(24, p0=['DOWN']); e.run(20)
    mark('fim')

@exp('tempo', 'st_arena01')
def _(e, mark):
    e.w8(0x1ED2, 0); e.w8(0x1ED0, 3)
    mark('relógio 0:03 -> fim de tempo'); e.run(900); mark('fim')

@exp('tempo_1min', 'st_arena01')
def _(e, mark):
    e.w8(0x1ED2, 1); e.w8(0x1ED0, 2)
    mark('relógio 1:02 -> 1:00 (hurry)'); e.run(600); mark('fim')

@exp('andar', 'st_arena05')
def _(e, mark):
    for k in range(120):
        if k % 10 == 0: mark('RIGHT k=%d X=%d Y=%d' % (k, e.r16(0x312), e.r16(0x316)))
        e.run(1, p0=['RIGHT'])
    mark('fim X=%d' % e.r16(0x312))

@exp('explosao_sobrevive', 'st_arena05')
def _(e, mark):
    mark('A bomba em (2,1)'); e.run(4, p0=['A']); e.run(2)
    e.run(34, p0=['RIGHT']); e.run(20, p0=['DOWN'])
    mark('P1 em X=%d Y=%d (fora do alcance)' % (e.r16(0x312), e.r16(0x316))); e.run(160); mark('fim, P1 rotina=%06X' % (e.r16(0x300) | e.r8(0x302) << 16))

@exp('bloco', 'st_arena01')
def _(e, mark):
    # bomba em (3,1) ao lado do soft block (4,1); P1 foge para (2,2)
    e.run(16, p0=['RIGHT']); mark('A bomba X=%d' % e.r16(0x312)); e.run(4, p0=['A']); e.run(2)
    e.run(18, p0=['LEFT']); e.run(20, p0=['DOWN']); mark('P1 X=%d Y=%d' % (e.r16(0x312), e.r16(0x316))); e.run(200); mark('fim')

def shots(e, tag, n, every=4, **held):
    ps = []
    for k in range(n):
        e.run(1, **held)
        if k % every == 0:
            p = SCR + '/rom-audio/sh_%s_%05d.png' % (tag, e.nframes); e.shot(p); ps.append(p)
    return ps

@exp('chute2', 'st_arena05')
def _(e, mark):
    setup_items(e, o4A=0xFF)
    e.run(16, p0=['RIGHT']); mark('A bomba X=%d' % e.r16(0x312)); e.run(4, p0=['A']); e.run(4)
    e.run(16, p0=['LEFT']); e.run(4); mark('RIGHT (chute) X=%d' % e.r16(0x312))
    shots(e, 'chute2', 30, 3, p0=['RIGHT']); shots(e, 'chute2', 60, 6); mark('fim')

@exp('soco2', 'st_arena05')
def _(e, mark):
    setup_items(e, o48=0xFF)
    e.run(16, p0=['RIGHT']); mark('A bomba X=%d' % e.r16(0x312)); e.run(4, p0=['A']); e.run(4)
    e.run(16, p0=['LEFT']); e.run(2, p0=['RIGHT']); e.run(2); mark('Y soco X=%d' % e.r16(0x312))
    shots(e, 'soco2', 4, 2, p0=['Y']); shots(e, 'soco2', 80, 4); mark('fim')

@exp('luva2', 'st_arena05')
def _(e, mark):
    setup_items(e, o49=0xFF)
    mark('A (bomba)'); e.run(4, p0=['A']); e.run(6)
    mark('A de novo, segurando (levanta)'); shots(e, 'luva2', 30, 5, p0=['A'])
    mark('RIGHT segurando A'); e.run(3, p0=['A', 'RIGHT'])
    mark('solta (arremessa)'); shots(e, 'luva2', 80, 5); mark('fim')

def menu_seq(st, seq):
    def fn(e, mark):
        for b in seq:
            e.state(st) if b == 'RESET' else None
            if b == 'RESET': continue
            mark(b); e.run(3, p0=[b]); e.run(40)
        mark('fim')
    return fn
for st, seq in {
    'st_title': ['START', 'DOWN', 'UP', 'A'],
    'st_b1': ['DOWN', 'UP', 'B', 'RESET', 'A'],
    'st_c0': ['DOWN', 'UP', 'B', 'RESET', 'A'],
    'st_c1': ['LEFT', 'DOWN', 'RIGHT', 'B', 'RESET', 'A'],
    'st_rules': ['DOWN', 'RIGHT', 'LEFT', 'B', 'RESET', 'A'],
    'st_c3': ['RIGHT', 'LEFT', 'DOWN', 'A', 'B', 'RESET', 'A'],
    'st_stage00': ['RIGHT', 'LEFT', 'B', 'RESET', 'START'],
}.items():
    EXPS['menu_' + st] = (st, menu_seq(st, seq))

@exp('vitoria', 'st_arena01')
def _(e, mark):
    for a in (0x1F34, 0x1F36, 0x1F38, 0x1F3A, 0x1F3C): e.w8(a, 2)
    e.w8(0x1ED2, 1); e.w8(0x1ED0, 3)
    mark('coroas=2 p/ todos, relógio 1:03')
    for k in range(40):
        shots(e, 'vit', 150, 150)
    mark('fim')

@exp('morte_itens', 'st_arena01')
def _(e, mark):
    for r, it in ((2, 0x01),):
        grid_set(e, 2, r, 0x40 | it, 0x09)
    e.run(24, p0=['DOWN']); e.run(24, p0=['UP']); mark('pegou item; A bomba e parado')
    e.run(4, p0=['A']); e.run(400); mark('fim')

@exp('item_queima', 'st_arena05')
def _(e, mark):
    grid_set(e, 2, 2, 0x41, 0x09)
    mark('A bomba em (2,1), item em (2,2)'); e.run(4, p0=['A']); e.run(2)
    e.run(34, p0=['RIGHT']); e.run(20, p0=['DOWN']); e.run(160); mark('fim')

@exp('titulo_battle', 'st_title')
def _(e, mark):
    mark('START'); e.run(3, p0=['START']); e.run(90)
    mark('DOWN'); e.run(3, p0=['DOWN']); e.run(30)
    mark('A (BATTLE GAME?)'); e.run(3, p0=['A']); e.run(300)
    mark('fim'); e.shot(SCR + '/rom-audio/titulo_battle.png')

@exp('selecao_b', 'st_c0')
def _(e, mark):
    mark('B, B, B (voltar até o título)')
    for k in range(4): e.run(3, p0=['B']); e.run(60)
    mark('fim'); e.shot(SCR + '/rom-audio/selecao_b.png')

@exp('titulo_battle2', 'st_title')
def _(e, mark):
    mark('START'); e.run(3, p0=['START']); e.run(200)
    for k in range(3):
        mark('DOWN'); e.run(6, p0=['DOWN']); e.run(40)
    e.shot(SCR + '/rom-audio/titulo_menu.png')
    mark('A'); e.run(3, p0=['A']); e.run(300)
    mark('fim'); e.shot(SCR + '/rom-audio/titulo_battle2.png')

@exp('titulo_battle3', 'st_title')
def _(e, mark):
    mark('DOWN'); e.run(6, p0=['DOWN']); e.run(30)
    mark('START'); e.run(3, p0=['START']); e.run(250)
    mark('fim'); e.shot(SCR + '/rom-audio/titulo_battle3.png')
