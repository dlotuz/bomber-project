import mt, sys, mount_lib as M
from PIL import Image
e=mt.new()
def test(t):
    if t is None:
        e.load(open(mt.EST+'st_arena01.bin','rb').read()); e.run(1); M.clear_soft(e)
    else: M.mount(e,t)
    # player em (32,48); fogo 2 casas. blocos em (48,48)=adjacente e (64,48)
    e.w8(0x344,3)  # fogo 3 -> alcance 5
    e.w16(M.cell(64,48),0xCC80); e.w16(M.cell(96,48),0xCC80)
    e.run(3,p0=['A']); e.run(2)
    for f in range(20): e.run(1,p0=['DOWN'])
    for f in range(20): e.run(1,p0=['RIGHT'])  # sai do raio (48,64)? pilar... vai p/ (32,80)
    res=[]
    for f in range(160):
        e.run(1)
        if f in (100,105,110): e.shot(mt.OUT+'_tmp.png'); res.append(Image.open(mt.OUT+'_tmp.png').crop((16,24,176,72)))
    return [hex(e.r16(M.cell(x,48))) for x in (48,64,80,96,112)], res, M.pl(e)
for t in [None,3]:
    g,ims,p=test(t)
    print('tipo',t,'grade linha1 x=48..112:',g,'P1',hex(p['rt']),p['x'],p['y'])
    m=Image.new('RGB',(160,48*3))
    for i,im in enumerate(ims): m.paste(im,(0,48*i))
    m.resize((320,288),Image.NEAREST).save(mt.OUT+f'bombtype_{t}.png')
