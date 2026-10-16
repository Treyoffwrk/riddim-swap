"""Ground-truth dance video: the figure moves out from centre and back, accelerating into each hit and stopping dead on it.
Never touches the frame edge, so the only stops are the true hits. SC scales the figure and its travel."""
import numpy as np, subprocess, json, os
W,H,FPS,DUR=360,640,30,12.0; SC=float(os.environ.get('SC','1')); OUT=os.environ.get('OUT','media/v.webm')
rng=np.random.default_rng(3); bg=(rng.random((H//8,W//8))*90+60).repeat(8,0).repeat(8,1).astype(np.uint8)
hits=[round(0.6+i*60/140*2,4) for i in range(13) if 0.6+i*60/140*2<DUR-0.5]
dirs=[(1,0),(0,1),(-1,0),(0,-1),(0.7,0.7),(-0.7,0.7),(0.7,-0.7),(-0.7,-0.7)]
A=55*SC
targets=[(0,0)]
for i in range(len(hits)): d=dirs[(i//2)%8]; targets.append((d[0]*A,d[1]*A) if i%2==0 else (0,0))
def pos(t):
    prev=0.0
    for i,h in enumerate(hits):
        if t<=h:
            u=(t-prev)/(h-prev); a,b=targets[i],targets[i+1]; e=u*u
            return W/2+a[0]+(b[0]-a[0])*e, H/2+a[1]+(b[1]-a[1])*e
        prev=h
    return W/2+targets[-1][0],H/2+targets[-1][1]
p=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','gray','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-c:v','libvpx','-b:v','1500k','-pix_fmt','yuv420p',OUT],stdin=subprocess.PIPE)
for f in range(int(DUR*FPS)):
    t=f/FPS; img=bg.copy(); x,y=pos(t)
    def R(a,b,c,d,v): img[max(0,int(y+a*SC)):int(y+b*SC),max(0,int(x+c*SC)):int(x+d*SC)]=v
    R(-80,80,-25,25,235); R(-110,-80,-18,18,250); R(-60,-40,-60,60,220); R(80,140,-25,-10,210); R(80,140,10,25,210)
    p.stdin.write(img.tobytes())
p.stdin.close(); p.wait()
json.dump({'hits':hits},open(OUT.replace('.webm','.json'),'w'))
