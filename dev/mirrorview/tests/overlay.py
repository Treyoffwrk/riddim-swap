import json,sys,numpy as np
from PIL import Image,ImageDraw
D=json.load(open(sys.argv[1]));F=D['heavy-640']['frames'];L=D['lite-320-image']['frames']
P=np.array([f[1] if f[1] else [[np.nan]*3]*33 for f in F])
pel=((P[:,23,:2]+P[:,24,:2])/2)-((P[:,11,:2]+P[:,12,:2])/2)
v=np.r_[0,np.hypot(*np.diff(pel,axis=0).T)]
idx=np.argsort(-np.nan_to_num(v))
pick=[];[pick.append(i) for i in idx if all(abs(i-j)>12 for j in pick) and len(pick)<4]
pick=sorted(pick)
E=[(11,12),(11,23),(12,24),(23,24),(23,25),(25,27),(24,26),(26,28),(11,13),(13,15),(12,14),(14,16),(27,31),(28,32)]
tiles=[]
for i in pick:
    for k in (i-1,i,i+1):
        im=Image.open(f'/home/claude/mv/run/fr2/{k+1:05d}.jpg').convert('RGB');d=ImageDraw.Draw(im);W,H=im.size
        for pts,col in ((L[k][1],(255,80,80)),(F[k][1],(80,255,120))):
            if not pts:continue
            for a,b in E:d.line([(pts[a][0]*W,pts[a][1]*H),(pts[b][0]*W,pts[b][1]*H)],fill=col,width=4)
            for j in (23,24):d.ellipse([pts[j][0]*W-7,pts[j][1]*H-7,pts[j][0]*W+7,pts[j][1]*H+7],outline=col,width=3)
        d.text((8,8),f'{k/30:.2f}s',fill=(255,255,0))
        tiles.append(im.resize((288,512)))
S=Image.new('RGB',(288*3,512*len(pick)))
for n,t in enumerate(tiles):S.paste(t,((n%3)*288,(n//3)*512))
S.save(sys.argv[2]);print('frames',[p/30 for p in pick])
