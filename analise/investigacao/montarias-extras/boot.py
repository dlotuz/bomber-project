from lib import *
e = new()
for i in range(6):
    e.run(150, p0=['START'] if i in (2, 4) else [])
save(e, 'mx_title')
e.tap('DOWN'); e.tap('DOWN'); e.shot(OUT + 'pw_0.png')
e.tap('A', after=120); e.shot(OUT + 'pw_1.png')
save(e, 'mx_password')
