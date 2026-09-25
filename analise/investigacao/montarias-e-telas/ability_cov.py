import mt, sys, mount_lib as M, re
e=mt.new()
def covrun(t, btn):
    M.mount(e,t); e.run(1,p0=['RIGHT'])
    e.lib.mt_set(1,0,1,0,1); e.lib.mt_reset_cov()
    e.run(3,p0=[btn] if btn else []); e.run(6)
    b=mt.cov(e); e.lib.mt_set(1,0,1,0,0)
    return {m.start() for m in re.finditer(rb'[\x01-\xff]', b)}
def ranges(s):
    s=sorted(s); out=[]; st=None; pv=None
    for a in s:
        if st is None: st=a
        elif a-pv>4: out.append((st,pv)); st=a
        pv=a
    if st is not None: out.append((st,pv))
    return ' '.join('%06X-%04X'%(a,b&0xffff) for a,b in out)
for t in [int(x,16) for x in sys.argv[1].split(',')]:
    for btn in sys.argv[2].split(','):
        c0=covrun(t,None); c1=covrun(t,btn)
        print(hex(t),btn,'novo:',ranges(c1-c0)[:600])
