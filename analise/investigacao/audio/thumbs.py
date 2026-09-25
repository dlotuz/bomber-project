import glob, os, sys
from PIL import Image, ImageDraw
D='/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad/rom-audio/'
pat, out = sys.argv[1], sys.argv[2]; lo = int(sys.argv[3]) if len(sys.argv) > 3 else 0; hi = int(sys.argv[4]) if len(sys.argv) > 4 else 10**9
ps = [p for p in sorted(glob.glob(D + pat)) if lo <= int(p[-9:-4]) <= hi]
ims = []
for p in ps:
    im = Image.open(p).resize((128, 112)); ImageDraw.Draw(im).text((2, 100), p[-9:-4], fill=(255, 0, 255)); ims.append(im)
cols = 10; rows = (len(ims) + cols - 1) // cols; m = Image.new('RGB', (128 * cols, 112 * rows))
for i, im in enumerate(ims): m.paste(im, ((i % cols) * 128, (i // cols) * 112))
m.save(D + out)
