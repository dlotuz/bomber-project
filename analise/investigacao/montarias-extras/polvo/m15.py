from plib import *
from m4 import setup
for tag, sc in (('RIGHT desde 8', {0: ['Y'], **{f: ['RIGHT'] for f in range(8, 20)}}), ('Y em 13', {0: ['Y'], 13: ['Y']}), ('Y em 12', {0: ['Y'], 12: ['Y']})):
    e = setup()
    print('==', tag); print(compress(trace(e, sc, 20)))
