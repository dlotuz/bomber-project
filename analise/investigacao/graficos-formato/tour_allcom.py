import sys, time; sys.path.insert(0,'.')
from dbgemu import *
e=DEmu(); ims=[]
(e.load(open(sys.argv[1],'rb').read()) if '/' in sys.argv[1] else e.loadst(sys.argv[1])); name=sys.argv[2]; N=int(sys.argv[3])
e.log_open(OUT+f'/{name}.log', OUT+f'/{name}.bin')
t=time.time()
for i in range(N):
    e.mark(f'i{i}')
    if i%2==1: e.tap('A',hold=4,after=146)
    else: e.run(150)
    ims.append(frame_img(e).resize((128,112)))
    if i%20==0: open(OUT+f'/{name}_{i:03d}.st','wb').write(e.save())
e.log_close()
mosaic(ims, OUT+f'/shots/_tour_{name}.png', cols=16)
print(time.time()-t)
