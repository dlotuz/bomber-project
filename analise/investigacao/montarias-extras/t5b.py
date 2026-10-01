from lib import *
e = new(); mount(e, 5, clear=False)
e.run(1, p0=['Y']); a = None; seq = []
for f in range(200):
    e.run(1, p0=['Y'] if f == 0 else [])
    os_ = [o for o in objs(e) if o['rt'] in (0xc16a5f,)]
    if os_: a = os_[0]['a']
    if a is None: continue
    seq.append((f, e.r16(a + 0x12) // 2, e.r16(0x90), e.r8(0x9e) & 3, hex(e.r16(a) | e.r8(a + 2) << 16)))
    if not os_: break
print(seq[:12]); print(seq[-5:])
