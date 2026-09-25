"""Grava log de DMA/VRAM/CGRAM do menu-título até a seleção de fase (Battle)."""
import sys; sys.path.insert(0,'.')
from dbgemu import *
e=DEmu(); e.load(open(OUT+'/my_titlemenu.bin','rb').read())
e.log_open(OUT+'/menus.log', OUT+'/menus.bin')
ims=[]
def step(tag, btn=None, player=0, wait=60):
    e.mark(tag)
    if btn: e.tap(btn, player=player, hold=4, after=wait)
    else: e.run(wait)
    ims.append(frame_img(e))
step('title->battle','A',wait=120)
step('vs->ffa','A',wait=90)
step('ffa->players','A',wait=90)
step('players->rules','A',wait=90)
step('rules->charsel','A',wait=150)
open(OUT+'/my_charsel.bin','wb').write(e.save())
for p in range(5): step(f'char p{p}','A',player=p,wait=40)
step('->stagesel',None,wait=150)
open(OUT+'/my_stagesel.bin','wb').write(e.save())
for k in range(10): step(f'stage right {k}','RIGHT',wait=40)
e.log_close()
mosaic(ims, OUT+'/shots/_tour_menus.png', cols=6, scale=0.5)
