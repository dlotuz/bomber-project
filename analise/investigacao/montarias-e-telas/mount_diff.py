import mt, sys, mount_lib as M
t=int(sys.argv[1],16); held=sys.argv[2].split(',') if len(sys.argv)>2 else []
e=mt.new()
seq=M.mount(e,t)
base=e.save()
def run(btn, n=40, extra=[]):
    e.load(base)
    snaps=[]
    for f in range(n):
        e.run(1,p0=(btn if f<20 else [])+extra); snaps.append(e.wram()[0x300:0x400])
    return snaps, e.wram()
s0,w0=run([],extra=held)
for b in ['A','B','Y','X','L','R']:
    s1,w1=run([b],extra=held)
    d=set()
    for a,b_ in zip(s0,s1):
        for i in range(0x100):
            if a[i]!=b_[i]: d.add(i)
    wd=[hex(i) for i in range(0x800,0x2000) if w0[i]!=w1[i]]
    print(b,'player fields differ:',[hex(i) for i in sorted(d)][:30],'| wram 0800-1fff diffs',len(wd), wd[:12])
