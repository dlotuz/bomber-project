"""uso: flow_step.py <estado_in> <estado_out> <seq> <nframes> <tag>
seq: 'DOWN:2,A:2' ... (botão:frames_segurado[:p]) separados por vírgula, cada um seguido de 8 frames de espera
Grava linha do tempo (brilho/sfx/música) e quadros a cada 10 frames até nframes."""
import mt, scr, sys
e=mt.new(); e.load(open(mt.OUT+sys.argv[1],'rb').read()); e.run(1)
seq=[s for s in sys.argv[3].split(',') if s]; N=int(sys.argv[4]); tag=sys.argv[5]
every=int(sys.argv[6]) if len(sys.argv)>6 else 10
st={}; scr.sfx_poll(e,st)
for s in seq[:-1]:
    parts=s.split(':'); b=parts[0]; h=int(parts[1]); p=int(parts[2]) if len(parts)>2 else 0
    e.run(h,**{f'p{p}':[b]}); e.run(8); scr.sfx_poll(e,st)
ev=[]; shots=[]; labels=[]; pb=scr.bright(e)
last=seq[-1].split(':'); b=last[0]; h=int(last[1]); p=int(last[2]) if len(last)>2 else 0
for f in range(N):
    e.run(1, **({f'p{p}':[b]} if f<h else {}))
    s,m=scr.sfx_poll(e,st)
    if s: ev.append((f,'sfx',s))
    if m is not None: ev.append((f,'music',m))
    bb=scr.bright(e)
    if bb!=pb: ev.append((f,'bright',bb)); pb=bb
    if f%every==every-1:
        pp=mt.OUT+f'fl_{tag}_{f+1:04d}.png'; e.shot(pp); shots.append(pp); labels.append(f'+{f+1}')
open(mt.OUT+sys.argv[2],'wb').write(e.save())
print(scr.compress_ev(ev))
scr.sheet(shots, mt.OUT+f'g_{tag}.png', cols=min(8,len(shots)), labels=labels)
