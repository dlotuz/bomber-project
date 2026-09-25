import mt, sys, mount_lib as M
e=mt.new()
for t in [0x2,0x3,0xA,0xC,0xD,0xE,0xF]:
    M.mount(e,t)
    e.run(1,p0=['RIGHT'])
    mt.watch(e, wlo=0x40, whi=0x43)
    e.run(3,p0=['Y']); e.run(2)
    lg=mt.log(e)
    pcs=[]
    for pc,k,a,v in lg:
        if 0xC20000<=pc<0xC30000 or 0xC10000<=pc<0xC20000:
            pcs.append((hex(pc),hex(a),hex(v)))
    # só as escritas em $40-$42 feitas pelo código do jogador (banco C2)
    print(hex(t), [p for p in pcs if p[0].startswith('0xc2')][:8])
