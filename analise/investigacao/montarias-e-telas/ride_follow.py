import mt, sys
sys.path.insert(0, mt.BASE+'/ferramentas'); from nav import grid
from PIL import Image
e = mt.new(mt.OUT+'st_ride_battle.bin')
# retrocede? não dá; segue em frente
shots=[]
for k in range(16):
    e.run(4)
    p=mt.OUT+f'ride_{k:02d}.png'; e.shot(p); shots.append(p)
    w=e.wram(); b=0x400
    print(k, 'rt',w[b:b+3][::-1].hex(),'x',e.r16(b+0x12),'y',e.r16(b+0x16),'5c',w[b+0x5c],'5d',w[b+0x5d],'51',hex(w[b+0x51]),'5e',w[b+0x5e])
# recorte 2x
ims=[Image.open(s).crop((140,160,256,224)).resize((232,128),Image.NEAREST) for s in shots]
m=Image.new('RGB',(232*4,128*4))
for i,im in enumerate(ims): m.paste(im,((i%4)*232,(i//4)*128))
m.save(mt.OUT+'g_ride.png')
