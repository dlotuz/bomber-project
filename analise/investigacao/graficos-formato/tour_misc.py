"""Grava logs: boot->título, fim de partida->placar->vitória."""
import sys; sys.path.insert(0,'.')
from dbgemu import *
which=sys.argv[1]
e=DEmu(); ims=[]
if which=='boot':
    e.loadst('st_boot'); e.log_open(OUT+'/boot.log', OUT+'/boot.bin')
    for i in range(60):
        e.mark(f'i{i}'); e.run(30); ims.append(frame_img(e))
elif which=='end':
    e.loadst('st_matchend'); e.log_open(OUT+'/end.log', OUT+'/end.bin')
    for i in range(60):
        e.mark(f'i{i}')
        if i%4==3: e.tap('A',hold=4,after=26)
        else: e.run(30)
        ims.append(frame_img(e))
elif which=='draw':
    e.loadst('st_ev00'); e.log_open(OUT+'/draw.log', OUT+'/draw.bin')
    for i in range(30):
        e.mark(f'i{i}')
        if i%4==3: e.tap('A',hold=4,after=26)
        else: e.run(30)
        ims.append(frame_img(e))
e.log_close()
mosaic(ims, OUT+f'/shots/_tour_{which}.png', cols=10, scale=0.4)
