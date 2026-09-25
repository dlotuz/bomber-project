import mt, mount_lib as M
e=mt.new()
M.mount(e,0xE)
e.w16(0x512,48); e.w16(0x516,48)
e.run(1,p0=['RIGHT']); e.run(2,p2=['LEFT']); e.run(2,p2=['RIGHT'])
e.run(3,p0=['Y'])
# desce P3 (coluna 3 tem pilar em y=64? usa x=48 -> pilar). Anda para a esquerda/direita alternando
xs=[]
for f in range(140):
    d='RIGHT' if (f//20)%2==0 else 'LEFT'
    e.run(1,p2=[d]); w=e.wram(); xs.append((f,e.r16(0x512),w[0x5e4],w[0x5e6]))
for f,x,a,b in xs[::5]: print(f,x,a,b)
