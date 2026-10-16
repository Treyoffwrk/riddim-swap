"""Harder dance-video benchmark with known hit times.
Variants: small dancer, camera shake, a second person moving in the background, grainy + heavily compressed.
Writes media/bench/<name>.webm and <name>.json (hits)."""
import numpy as np, subprocess, json, os
W,H,FPS,DUR=360,640,30,12.0
os.makedirs('media/bench',exist_ok=True)

def make(name,seed,SC=1.0,shake=0.0,sway=0.0,distract=False,noise=0.0,bitrate='1500k',bpm=140,every=2,irregular=False):
    rng=np.random.default_rng(seed)
    bg=(rng.random((H//8,W//8))*90+60).repeat(8,0).repeat(8,1).astype(np.float32)
    bgp=np.pad(bg,20,mode='edge')
    if irregular:
        hits=[];t=0.6
        while t<DUR-0.6: hits.append(round(t,4)); t+=rng.choice([0.6,0.85,1.1,0.43])*1.0
    else:
        hits=[round(0.6+i*60/bpm*every,4) for i in range(40) if 0.6+i*60/bpm*every<DUR-0.5]
    dirs=[(1,0),(0,1),(-1,0),(0,-1),(0.7,0.7),(-0.7,0.7),(0.7,-0.7),(-0.7,-0.7)]
    A=55*SC; targets=[(0,0)]
    for i in range(len(hits)): d=dirs[(i//2)%8]; targets.append((d[0]*A,d[1]*A) if i%2==0 else (0,0))
    def pos(t):
        prev=0.0
        for i,h in enumerate(hits):
            if t<=h:
                u=(t-prev)/(h-prev); a,b=targets[i],targets[i+1]; e=u*u
                return W/2+a[0]+(b[0]-a[0])*e, H/2+a[1]+(b[1]-a[1])*e
            prev=h
        return W/2+targets[-1][0],H/2+targets[-1][1]
    p=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','gray','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-c:v','libvpx','-b:v',bitrate,'-pix_fmt','yuv420p',f'media/bench/{name}.webm'],stdin=subprocess.PIPE)
    dph=rng.random()*6
    for f in range(int(DUR*FPS)):
        t=f/FPS
        # camera shake: slow sway + jitter, applied to the whole frame
        ox=int(round(shake*(np.sin(t*1.7+dph)*0.7+rng.normal()*0.35))); oy=int(round(shake*(np.cos(t*1.3)*0.7+rng.normal()*0.35)))
        ox+=int(round(sway*np.sin(t*2.1+dph))); oy+=int(round(sway*0.6*np.sin(t*1.6)))   # smooth hand sway
        img=bgp[20+oy:20+oy+H,20+ox:20+ox+W].copy()
        if distract:   # a second, smaller person drifting and waving off the beat
            dx=W*0.22+40*np.sin(t*0.9); dy=H*0.78+25*np.sin(t*1.4)
            arm=int(30*np.sin(t*5.3))
            img[int(dy-40):int(dy+40),int(dx-12):int(dx+12)]=200
            img[int(dy-25+arm/3):int(dy-15+arm/3),int(dx-35):int(dx+35)]=190
        x,y=pos(t); x+=ox; y+=oy
        def R(a,b,c,d,v): img[max(0,int(y+a*SC)):max(0,int(y+b*SC)),max(0,int(x+c*SC)):max(0,int(x+d*SC))]=v
        R(-80,80,-25,25,235); R(-110,-80,-18,18,250); R(-60,-40,-60,60,220); R(80,140,-25,-10,210); R(80,140,10,25,210)
        if noise: img=img+rng.normal(0,noise,img.shape)
        p.stdin.write(np.clip(img,0,255).astype(np.uint8).tobytes())
    p.stdin.close(); p.wait()
    json.dump({'hits':hits},open(f'media/bench/{name}.json','w'))
    print('wrote',name,len(hits),'hits')

import sys
ONLY=sys.argv[1:] or None
_make=make
def make(name,*a,**k):
    if ONLY is None or name in ONLY: _make(name,*a,**k)
make('v_clean',1)
make('v_small',2,SC=0.6)
make('v_shake',3,shake=4)
make('v_distract',4,distract=True)
make('v_grainy',5,noise=14,bitrate='250k')
make('v_irregular',6,irregular=True)
make('v_hard',7,SC=0.75,shake=3,distract=True,noise=8,bitrate='400k')
make('v_sway',8,sway=10)
