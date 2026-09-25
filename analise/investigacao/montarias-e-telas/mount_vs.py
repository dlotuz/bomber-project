"""Habilidade (botão) de uma montaria contra um alvo (P3) a dx pixels à direita, na linha y=48."""
import mt, sys, mount_lib as M, objlist
from PIL import Image
t=int(sys.argv[1],16); btn=sys.argv[2]; tx=int(sys.argv[3]); nfr=int(sys.argv[4]) if len(sys.argv)>4 else 120
e=mt.new()
M.mount(e,t)
e.w16(0x512,tx); e.w16(0x516,48)
e.run(1,p0=['RIGHT']); e.run(2,p2=['LEFT']); e.run(2,p2=['RIGHT'])
frames=[]; prev=None
for f in range(nfr):
    e.run(1,p0=([btn] if f in (0,1,2) else []))
    p=M.pl(e); q=M.pl(e,0x500)
    ob=[(hex(o['rt']),o['x'],o['y']) for o in objlist.objs(e) if 0x800<=o['a']<0x1400 and o['rt']!=0xC34EE6]
    k=(hex(p['rt']),p['r5d'],hex(q['rt']),q['x'],q['y'],q['i96'])
    if k!=prev: print(f,'P1',hex(p['rt']),p['x'],p['y'],'mont',p['r5d'],'| P3',hex(q['rt']),q['x'],q['y'],'96=',q['i96'],'e8=',q['e8'],'|',ob[:2]); prev=k
    if f%4==0:
        e.shot(mt.OUT+'_tmp.png'); frames.append(Image.open(mt.OUT+'_tmp.png').crop((16,24,240,72)))
cols=3
m=Image.new('RGB',(224*cols,48*((len(frames)+cols-1)//cols)))
for i,im in enumerate(frames): m.paste(im,((i%cols)*224,(i//cols)*48))
m.save(mt.OUT+f'vs_{t:X}_{btn}_{tx}.png')
