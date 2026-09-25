import sys
from emu import Emu
from PIL import Image
def grid(paths,out,cols=4):
    ims=[Image.open(p) for p in paths]; w,h=ims[0].size
    rows=(len(ims)+cols-1)//cols
    m=Image.new('RGB',(w*cols,h*rows))
    for i,im in enumerate(ims): m.paste(im,((i%cols)*w,(i//cols)*h))
    m.save(out)
