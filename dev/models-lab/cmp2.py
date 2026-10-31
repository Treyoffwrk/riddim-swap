import onnxruntime as ort,numpy as np,glob,sys
from PIL import Image
R=ort.InferenceSession(sys.argv[1]);mods=[ort.InferenceSession(p) for p in sys.argv[2:]]
mean=np.array([123.675,116.28,103.53]);std=np.array([58.395,57.12,57.375])
def run(S,x):
    o=S.run(None,{S.get_inputs()[0].name:x});sx,sy=o[0][0],o[1][0]
    return sx.argmax(1)/2.0,sy.argmax(1)/2.0,np.minimum(sx.max(1),sy.max(1))
bins=[(0.3,0.5),(0.5,0.7),(0.7,9)];res=[[[] for _ in bins] for _ in mods]
import os
FR=[('frames/'+x.strip()) for x in open(os.environ['SUB'])] if os.environ.get('SUB') else sorted(glob.glob('frames/*.png'))
for f in FR:
    im=np.asarray(Image.open(f).convert('RGB')).astype(np.float32);x=((im-mean)/std).transpose(2,0,1)[None].astype(np.float32)
    rx,ry,rs=run(R,x)
    for k,S in enumerate(mods):
        bx,by,_=run(S,x);d=np.hypot(rx-bx,ry-by)
        for j,(lo,hi) in enumerate(bins):
            sel=(rs>=lo)&(rs<hi);res[k][j]+=list(d[sel])
for k,p in enumerate(sys.argv[2:]):
    print(p.split('/')[-1],' | '.join(f'score {lo}-{hi}: n={len(a)} >3px {np.mean(np.array(a)>3)*100:.2f}% >10px {np.mean(np.array(a)>10)*100:.2f}%' for (lo,hi),a in zip(bins,res[k])))
