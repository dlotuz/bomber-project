from mec import *
e=Dbg("st_stage00"); e.run(1)
e.run(2,p0=['A']); f0=e.nframes
while e.nframes-f0 < 672: e.run(1)
for f in (672,680,690,700,706,710):
    while e.nframes-f0 < f: e.run(1)
    e.shot(OUT+f'intro_{f}.png')
