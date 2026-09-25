"""uso: hold_test.py <estado> <botão> <tile_cursor_hex> [player] [n] — segura o botão e registra posição do cursor"""
import mt, scr, sys
e=mt.new(); e.load(open(mt.OUT+sys.argv[1],'rb').read()); e.run(1)
b=sys.argv[2]; tile=int(sys.argv[3],16); pl=int(sys.argv[4]) if len(sys.argv)>4 else 0; n=int(sys.argv[5]) if len(sys.argv)>5 else 120
st={}; scr.sfx_poll(e,st)
prev=None; out=[]
for f in range(n):
    e.run(1,**{f'p{pl}':[b]})
    s,m=scr.sfx_poll(e,st)
    cur=[(o['x'],o['y']) for o in scr.oam(e) if o['tile']==tile]
    pos=cur[0] if cur else None
    if pos!=prev or s: out.append((f,pos,s)); prev=pos
print(out)
