"""Ground-truth media: a dancer-like figure that hits (stops sharply) at known times, and a dembow track."""
import numpy as np, subprocess, json, wave
W,H,FPS,DUR=360,640,30,12.0
rng=np.random.default_rng(3)
bg=(rng.random((H//8,W//8))*90+60).repeat(8,0).repeat(8,1).astype(np.uint8)   # static texture
hits=[round(0.6+i*60/140*2,4) for i in range(13) if 0.6+i*60/140*2<DUR-0.5]       # every 2 beats at 140 BPM
dirs=[(1,0),(0,1),(-1,0),(0,-1),(1,1),(-1,1),(1,-1),(-1,-1)]
def pos_at(t):
    # between hits the figure travels along a direction, easing in and stopping dead at the hit
    x,y=W/2,H/2
    prev=0.0
    for i,h in enumerate(hits+[DUR+1]):
        d=dirs[i%8]; seg_end=min(h,t); span=h-prev
        if seg_end>prev:
            u=(seg_end-prev)/span; dist=70*min(1,u)**2   # accelerate into the hit, then stop
            x+=d[0]*dist*(1 if i%2==0 else -1); y+=d[1]*dist*(1 if i%2==0 else -1)
        if t<=h: break
        prev=h
    return x,y
p=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','gray','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-c:v','libvpx','-b:v','1500k','-pix_fmt','yuv420p','media/dance_hits.webm'],stdin=subprocess.PIPE)
for f in range(int(DUR*FPS)):
    t=f/FPS; img=bg.copy(); x,y=pos_at(t); x=int(np.clip(x,60,W-60)); y=int(np.clip(y,90,H-90))
    img[y-80:y+80,x-25:x+25]=235          # torso
    img[y-110:y-80,x-18:x+18]=250         # head
    img[y-60:y-40,x-60:x+60]=220          # arms
    img[y+80:y+140,x-25:x-10]=210; img[y+80:y+140,x+10:x+25]=210   # legs
    p.stdin.write(img.tobytes())
p.stdin.close(); p.wait()
json.dump({'hits':hits},open('media/dance_hits.json','w'))
# dembow 100 BPM, 30 s
SR=44100; bpm=100; per=60/bpm; n=int(30*SR); x=np.zeros(n)
def kick(t,a):
    i0=int(t*SR); tt=np.arange(int(0.25*SR))/SR; s=a*np.sin(2*np.pi*(50+80*np.exp(-tt*30))*tt)*np.exp(-tt*9); x[i0:i0+len(s)]+=s[:max(0,n-i0)]
def snare(t,a):
    i0=int(t*SR); tt=np.arange(int(0.15*SR))/SR; s=a*(rng.random(len(tt))*2-1)*np.exp(-tt*25); x[i0:i0+len(s)]+=s[:max(0,n-i0)]
beats=[]; t=0.5; i=0
while t<29.5:
    beats.append(round(t,4))
    if i%2==0: kick(t,0.8); snare(t,0.3); snare(t+per*0.75,0.45)
    else: snare(t+per*0.5,0.45)
    t+=per; i+=1
x+=0.02*(rng.random(n)*2-1); x=np.clip(x,-1,1)
with wave.open('media/dembow100.wav','wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x*32767).astype(np.int16).tobytes())
json.dump({'beats':beats,'bpm':bpm},open('media/dembow100.json','w'))
print('hits',len(hits),'beats',len(beats))
