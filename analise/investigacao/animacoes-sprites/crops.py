from rec import *
from PIL import Image, ImageDraw
SC = "/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad/rom-animacoes/"
def crops(e, n, held, box, every=2, path=SC + 'crops.png', cols=16, scale=2, p=0):
    ims = []
    for k in range(n):
        h = held(k) if callable(held) else held
        e.run(1, **h)
        if k % every == 0:
            e.shot(SC + '_c.png'); im = Image.open(SC + '_c.png').crop(box).convert('RGBA')
            s = pstate(e.wram(), p); d = ImageDraw.Draw(im); d.text((1, 1), f'{k}', fill=(255, 255, 0, 255))
            d.text((1, im.height - 10), f"{s['anim'] & 0xFFFF:04X}.{s['idx']}", fill=(255, 255, 255, 255))
            ims.append(im)
    w, hh = ims[0].size; rows = (len(ims) + cols - 1) // cols
    m = Image.new('RGBA', (w * cols, hh * rows), (0, 0, 0, 255))
    for i, im in enumerate(ims): m.paste(im, ((i % cols) * w, (i // cols) * hh))
    m = m.resize((m.width * scale, m.height * scale), Image.NEAREST); m.save(path); return path
