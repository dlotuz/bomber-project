"""uso: probe_screen.py <estado> <tag> [botões] [player]  — testa cada botão numa tela"""
import mt, scr, sys
stp=sys.argv[1]; tag=sys.argv[2]
btns=(sys.argv[3] if len(sys.argv)>3 else 'UP,DOWN,LEFT,RIGHT,A,B,X,Y,START,SELECT,L,R').split(',')
pl=int(sys.argv[4]) if len(sys.argv)>4 else 0
n=int(sys.argv[5]) if len(sys.argv)>5 else 120
e=mt.new()
base=open(stp if stp.startswith('/') else mt.OUT+stp,'rb').read()
for b in btns:
    r=scr.probe(e,base,b,player=pl,n=n,shot=mt.OUT+f'pr_{tag}_{b}_p{pl}.png')
    mv=scr.oam_moves(r['o0'],r['o1'])
    print(f'{b:6s} 1ª mudança f={r["first_change"]} ev={scr.compress_ev(r["ev"])} oam_moves={mv[:4]}')
