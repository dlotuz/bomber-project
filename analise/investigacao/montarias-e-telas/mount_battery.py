"""Bateria de testes de cada montaria no Battle (fase 1, blocos macios removidos da grade lógica)."""
import mt, sys, mount_lib as M, objlist, json
from PIL import Image
types=[int(x,16) for x in sys.argv[1].split(',')]
e=mt.new()
out={}
def objs_new(before):
    return [(hex(o['a']),hex(o['rt']),o['x'],o['y']) for o in objlist.objs(e) if (o['a'],o['rt']) not in before]
for t in types:
    r={}
    seq=M.mount(e,t)
    r['frames_montar']=len(seq)
    base=e.save()
    # T1 velocidade
    xs=[]
    for f in range(120): e.run(1,p0=['RIGHT']); xs.append(M.pl(e)['x'])
    r['vel_px_por_frame']=round((xs[119]-xs[39])/80,3); r['x_seq_0_12']=xs[:12]
    # subpixel
    # T2 bloco macio em (64,48)
    e.load(base); e.w16(M.cell(64,48),0xCC80)
    for f in range(60): e.run(1,p0=['RIGHT'])
    p=M.pl(e); r['T2_softblock_x_final']=p['x']; r['T2_cell_after']=hex(e.r16(M.cell(64,48)))
    # T2b com botão B/Y segurado
    for b in ['B','Y','X','R']:
        e.load(base); e.w16(M.cell(64,48),0xCC80)
        for f in range(60): e.run(1,p0=['RIGHT',b])
        p=M.pl(e); r[f'T2_{b}_x']=p['x']; r[f'T2_{b}_cell']=hex(e.r16(M.cell(64,48)))
    # T3 pilar: de (48,48) descer
    e.load(base)
    for f in range(16): e.run(1,p0=['RIGHT'])
    for f in range(40): e.run(1,p0=['DOWN'])
    p=M.pl(e); r['T3_pilar_xy']=(p['x'],p['y'])
    # T4 bomba: põe bomba em (32,48), anda p/ direita 48px, volta
    e.load(base)
    e.run(3,p0=['A']); e.run(2)
    for f in range(48): e.run(1,p0=['RIGHT'])
    before=[(o['a'],o['rt']) for o in objlist.objs(e)]
    tr=[]
    for f in range(40): e.run(1,p0=['LEFT']); tr.append(M.pl(e)['x'])
    r['T4_bomba_x_seq']=tr[::4]; r['T4_grid_32_48']=hex(e.r16(M.cell(32,48))); r['T4_grid_16_48']=hex(e.r16(M.cell(16,48)))
    # T5 botões parados e andando
    for b in ['B','Y','X','L','R']:
        e.load(base)
        before=[(o['a'],o['rt']) for o in objlist.objs(e)]
        rts=[]; pos=[]
        for f in range(50):
            e.run(1,p0=(['RIGHT'] if f<30 else [])+([b] if f in (5,6,7) else []))
            p=M.pl(e); pos.append((p['x'],p['y']))
            if not rts or rts[-1]!=hex(p['rt']): rts.append(hex(p['rt']))
        r[f'T5_{b}']=dict(rts=rts, pos10=pos[::10], novos=objs_new(before)[:3])
    # T6 atingido: fica em cima da própria bomba
    e.load(base)
    e.run(3,p0=['A'])
    hist=[]
    for f in range(400):
        e.run(1); p=M.pl(e)
        hist.append((f,hex(p['rt']),p['r5d'],p['t5c'],p['i96'],p['e8'],p['x'],p['y']))
    ch=[]
    for h in hist:
        if not ch or ch[-1][1:6]!=h[1:6]: ch.append(h)
    r['T6_hit']=ch[:14]
    out[hex(t)]=r
    print(hex(t), json.dumps(r)[:3000]); sys.stdout.flush()
json.dump(out,open(f'mount_battery_{sys.argv[1].replace(",","_")}.json','w'),indent=1)
