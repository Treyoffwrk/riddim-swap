"""Harder song benchmark with known beats: the things that fool beat trackers in dancehall, reggae and club music.
  - off-beat chord stabs ("skank") on every "and"
  - syncopated bass that rarely lands on the beat
  - reggae one-drop: kick + snare only on beat 3
  - vocal-like melody with legato notes, reverb, noise
Writes media/bench/<name>.wav and <name>.json with the true beat and downbeat times."""
import numpy as np, wave, json, os
SR=44100
import sys
OUT=sys.argv[1] if len(sys.argv)>1 else 'media/bench'
os.makedirs(OUT,exist_ok=True)

def tone(f,dur,a,rng,kind='saw'):
    t=np.arange(int(dur*SR))/SR
    if kind=='saw': s=2*((t*f)%1)-1
    elif kind=='sine': s=np.sin(2*np.pi*f*t)
    else: s=np.sign(np.sin(2*np.pi*f*t))
    return a*s

def env(n,att,dec):
    e=np.ones(n); na=max(1,int(att*SR)); e[:na]=np.linspace(0,1,na)
    e*=np.exp(-np.arange(n)/SR*dec); return e

def place(x,t,s):
    i0=int(t*SR)
    if i0>=len(x): return
    n=min(len(s),len(x)-i0); x[i0:i0+n]+=s[:n]

def kick(a,rng):
    tt=np.arange(int(0.3*SR))/SR; return a*np.sin(2*np.pi*(45+90*np.exp(-tt*28))*tt)*np.exp(-tt*8)
def snare(a,rng):
    tt=np.arange(int(0.18*SR))/SR; return a*((rng.random(len(tt))*2-1)*0.8+0.3*np.sin(2*np.pi*190*tt))*np.exp(-tt*22)
def hat(a,rng):
    tt=np.arange(int(0.04*SR))/SR; return a*(rng.random(len(tt))*2-1)*np.exp(-tt*110)
def stab(f,a,rng,dur=0.12):   # chord stab: three saw tones, short
    s=sum(tone(f*r,dur,1,rng) for r in (1,1.26,1.5))/3; return a*s*env(len(s),0.003,18)
def lowpass(x,alpha):
    y=np.zeros_like(x); acc=0.0
    for i in range(len(x)): acc+=alpha*(x[i]-acc); y[i]=acc
    return y

def song(name,bpm,style,seed,dur=32.0,swing=0.0):
    rng=np.random.default_rng(seed); p=60/bpm; n=int(dur*SR); x=np.zeros(n)
    beats=[]; t=0.4+rng.random()*0.3; i=0
    roots=[55,49,52,46]   # bass roots (Hz)
    while t<dur-0.4:
        beats.append(round(t,4)); bar=i//4; pos=i%4; root=roots[bar%4]
        sw=lambda frac: t+p*frac+(swing*p*0.17 if abs(frac-0.5)<1e-6 else 0)
        if style=='dembow':
            if pos in (0,2): place(x,t,kick(0.75,rng))
            place(x,sw(0.75) if pos%2==0 else sw(0.5),snare(0.35,rng))
            place(x,sw(0.5),stab(220*(root/55),0.22,rng))            # skank on every "and"
            if pos in (1,3): place(x,sw(0.5),tone(root,0.35,0.35,rng,'sine')*env(int(0.35*SR),0.005,5))  # bass on the "and"
        if style=='onedrop':
            if pos==2: place(x,t,kick(0.8,rng)); place(x,t,snare(0.4,rng))   # only beat 3
            place(x,sw(0.5),stab(196*(root/55),0.28,rng))            # skank on the "and"
            place(x,t+p*0.25,tone(root,0.5,0.3,rng,'sine')*env(int(0.5*SR),0.01,3))  # bass pushed off the beat
            place(x,sw(0.5),hat(0.12,rng))
        if style=='jersey':
            place(x,t,kick(0.7,rng))
            if pos==3: place(x,t+p/3,kick(0.5,rng)); place(x,t+2*p/3,kick(0.5,rng))
            if pos in (1,3): place(x,t,snare(0.3,rng))
            if rng.random()<0.6: place(x,t+p*0.5,stab(330,0.18,rng,0.08))   # vocal-chop-like stabs on the "and"
        if style=='house':
            place(x,t,kick(0.7,rng)); place(x,sw(0.5),hat(0.25,rng))
            place(x,sw(0.5),tone(root*2,0.18,0.35,rng,'saw')*env(int(0.18*SR),0.004,12))   # off-beat bass
        if style=='afro':
            if pos in (0,2): place(x,t,kick(0.6,rng))
            if pos==1: place(x,t+p*0.5,kick(0.45,rng))
            for frac in (0.0,0.75): place(x,t+p*frac,hat(0.15,rng))
            if pos in (1,3): place(x,t,snare(0.25,rng))
            if pos==0: place(x,t+p*0.5,stab(262,0.2,rng)); place(x,t+p*1.5,stab(262,0.2,rng))
        t+=p; i+=1
    # vocal-like legato melody (formant-ish), not aligned to the beat
    tm=0.5
    while tm<dur-1:
        d=p*rng.choice([1.5,2,3]); f=rng.choice([294,330,392,440]); s=tone(f,d,0.08,rng,'saw')
        s=lowpass(s,0.08)*env(len(s),0.08,0.8); place(x,tm+rng.random()*0.1,s); tm+=d
    # reverb + noise
    ir=(rng.random(int(0.6*SR))*2-1)*np.exp(-np.arange(int(0.6*SR))/SR*7)*0.04
    x=x+np.convolve(x,ir)[:n]
    x+=0.01*(rng.random(n)*2-1)
    x=x/np.max(np.abs(x))*0.9
    with wave.open(f'{OUT}/{name}.wav','wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x*32767).astype(np.int16).tobytes())
    json.dump({'bpm':bpm,'beats':beats,'downbeats':beats[0::4],'style':style},open(f'{OUT}/{name}.json','w'))

cases=[('dembow_95',95,'dembow',1),('dembow_102',102,'dembow',2),('onedrop_76',76,'onedrop',3),('onedrop_84',84,'onedrop',4),
       ('jersey_140',140,'jersey',5),('jersey_145',145,'jersey',6),('house_124',124,'house',7),('afro_104',104,'afro',8),
       ('dembow_swing_98',98,'dembow',9,0.6),('house_swing_122',122,'house',10,0.7)]
if OUT!='media/bench':   # held-out set: tempos and seeds never used while tuning
    cases=[('dembow_88',88,'dembow',21),('dembow_110',110,'dembow',22,0.4),('onedrop_70',70,'onedrop',23),('onedrop_90',90,'onedrop',24,0.5),
       ('jersey_135',135,'jersey',25),('jersey_150',150,'jersey',26),('house_118',118,'house',27,0.3),('house_128',128,'house',28),
       ('afro_96',96,'afro',29),('afro_112',112,'afro',30,0.5)]
for c in cases:
    name,bpm,style,seed=c[:4]; sw=c[4] if len(c)>4 else 0.0
    song(name,bpm,style,seed,swing=sw); print('wrote',name)
