"""Does a setting flatten or delay fast moves? Compare limb speeds and timing against a reference run."""
import json,sys,numpy as np
from analyse import pick_track,centre
def series(fn):
    D=json.load(open(fn));asp=D['H']/D['W'];tr=pick_track(D['frames'],asp)
    out={}
    for name,j in [('wrist L',15),('wrist R',16),('ankle L',27),('ankle R',28),('hip L',23)]:
        xy=np.array([k[j,:2]/centre(k)[2] if k is not None else [np.nan,np.nan] for k in tr])
        out[name]=xy
    return out
A=series(sys.argv[1]);B=series(sys.argv[2])
for n in A:
    va=np.linalg.norm(np.diff(A[n],axis=0),axis=1)*30;vb=np.linalg.norm(np.diff(B[n],axis=0),axis=1)*30
    m=~(np.isnan(va)|np.isnan(vb))
    a=va[m]-va[m].mean();bests=[]
    for L in range(-5,6):
        b=np.roll(vb,L)[m]-vb[m].mean();bests.append(((a*b).sum()/np.sqrt((a*a).sum()*(b*b).sum()),L))
    c,L=max(bests)
    print(f'{n:8s} 95th-pct speed {np.percentile(va[m],95):.2f} vs {np.percentile(vb[m],95):.2f} torso/s · peaks kept {np.percentile(vb[m],95)/np.percentile(va[m],95)*100:.0f}% · timing {L:+d} frames (r={c:.2f})')
