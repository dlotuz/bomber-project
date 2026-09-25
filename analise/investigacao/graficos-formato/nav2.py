import sys; sys.path.insert(0,'.')
from dbgemu import *
e=DEmu(); (e.loadst(sys.argv[1]) if not sys.argv[1].startswith("my_") else e.load(open(OUT+"/"+sys.argv[1]+".bin","rb").read())); ims=[]
for s in sys.argv[2].split(','):
    if s.startswith('w'): e.run(int(s[1:]))
    else: e.tap(s.split('+'), hold=4, after=30)
    ims.append(frame_img(e))
mosaic(ims, OUT+'/shots/_nav.png', cols=6, scale=0.5)
if len(sys.argv)>3: open(OUT+'/'+sys.argv[3]+'.bin','wb').write(e.save())
