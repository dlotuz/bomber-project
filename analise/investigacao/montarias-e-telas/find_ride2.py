import mt, sys, random
from PIL import Image
e = mt.new()
random.seed(1)
BT = ['UP','DOWN','LEFT','RIGHT','A','B','Y','X','L','R']
order='st_cpu5,st_cpu5b,st_allcom,st_cp00'.split(',')
shots=[]
for st in order:
    e.load(open(mt.EST + st + '.bin', 'rb').read())
    left = 8000
    while left > 0:
        n = random.randint(4, 30)
        held = {f'p{p}': random.sample(BT, random.randint(0, 2)) for p in range(5)}
        if st=='st_cp00':
            for f in range(n):
                t=8000-left
                if t==3300:
                    mt.watch(e, wlo=0x451, whi=0x451)
                    open(mt.OUT+'st_ride_pre.bin','wb').write(e.save())
                e.run(1, **held); left-=1
                if 3300<=t<3445 and t%6==0:
                    p=mt.OUT+f'pre_{t}.png'; e.shot(p); shots.append(p)
            if 8000-left>3445: break
        else:
            e.run(n, **held); left -= n
    if st=='st_cp00': break
print([(hex(pc),hex(a),v) for pc,k,a,v in mt.log(e)])
ims=[Image.open(s).crop((140,150,256,224)).resize((232,148),Image.NEAREST) for s in shots]
cols=6; m=Image.new('RGB',(232*cols,148*((len(ims)+cols-1)//cols)))
for i,im in enumerate(ims): m.paste(im,((i%cols)*232,(i//cols)*148))
m.save(mt.OUT+'g_pre.png')
