"""Riddim benchmark: songs with KNOWN kick and snare times, plus the things that fool a drum detector.
  - bass notes (low, like a kick), off-beat chord stabs (mid-high, like a snare), hi-hats, a vocal-like line
  - slow tempo drift (a live-played or DJ-pitched track), so a fixed metronome would fall behind
  - a drum break (2 bars with no drums): cues should stop there
Writes <out>/<name>.wav and <name>.json  {kick:[t], snare:[t], beats:[t], down:[t], break:[t0,t1]}"""
import numpy as np, wave, json, os, sys
SR=44100
OUT=sys.argv[1] if len(sys.argv)>1 else 'media/riddim'
os.makedirs(OUT,exist_ok=True)

def tone(f,dur,a,kind='saw'):
    t=np.arange(int(dur*SR))/SR
    return a*((2*((t*f)%1)-1) if kind=='saw' else np.sin(2*np.pi*f*t))
def env(n,att,dec):
    e=np.ones(n); na=max(1,int(att*SR)); e[:na]=np.linspace(0,1,na); return e*np.exp(-np.arange(n)/SR*dec)
def place(x,t,s):
    i0=int(t*SR)
    if 0<=i0<len(x): n=min(len(s),len(x)-i0); x[i0:i0+n]+=s[:n]
def kick(a): tt=np.arange(int(0.3*SR))/SR; return a*np.sin(2*np.pi*(45+90*np.exp(-tt*28))*tt)*np.exp(-tt*8)
def snare(a,rng): tt=np.arange(int(0.18*SR))/SR; return a*((rng.random(len(tt))*2-1)*0.8+0.3*np.sin(2*np.pi*190*tt))*np.exp(-tt*22)
def rim(a,rng): tt=np.arange(int(0.05*SR))/SR; return a*((rng.random(len(tt))*2-1)*0.6+0.5*np.sin(2*np.pi*1700*tt))*np.exp(-tt*70)
def hat(a,rng): tt=np.arange(int(0.04*SR))/SR; return a*(rng.random(len(tt))*2-1)*np.exp(-tt*110)
def stab(f,a,dur=0.12): s=sum(tone(f*r,dur,1) for r in (1,1.26,1.5))/3; return a*s*env(len(s),0.003,18)

# per style: drum slots in a bar of 16 sixteenths -> 'k' kick, 's' snare, 'r' rim (counts as snare)
STYLES={
 'dembow':   {'k':[0,8],          's':[3,6,11,14]},        # boom-ch-boom-chk (3-3-2 feel)
 'dembow332':{'k':[0,3,6,8,11,14],'s':[4,12]},             # kick on the 3-3-2
 'onedrop':  {'k':[8],            's':[8],'r':[]},         # kick + snare on beat 3 only
 'steppers': {'k':[0,4,8,12],     's':[8],'r':[6,14]},
 'afro':     {'k':[0,6,8],        's':[4,12],'r':[3,10]},
}
def song(name,bpm0,style,seed,dur=40.0,drift=0.012,brk=(8,10),skank=True,bass=True,hats=True):
    rng=np.random.default_rng(seed); n=int(dur*SR); x=np.zeros(n)
    st=STYLES[style]; kicks=[]; snares=[]; basses=[]; beats=[]; down=[]
    t=0.5; beat=0
    roots=[55,49,52,46]; brk_t=None
    while t<dur-1:
        bpm=bpm0*(1+drift*min(1,t/dur)); p=60/bpm   # tempo creeps up by `drift` over the song
        bar=beat//4; pos=beat%4; beats.append(round(t,4))
        if pos==0: down.append(round(t,4))
        inbreak = brk[0]<=bar<brk[1]
        if inbreak and pos==0 and bar==brk[0]: brk_t=[round(t,4),None]
        if (not inbreak) and brk_t and brk_t[1] is None and bar==brk[1] and pos==0: brk_t[1]=round(t,4)
        for q in range(4):
            slot=pos*4+q; ts=t+p*q/4 + rng.normal(0,0.003)   # 3 ms human timing wobble
            if not inbreak:
                if slot in st['k']: place(x,ts,kick(0.75)); kicks.append(round(ts,4))
                if slot in st['s']: place(x,ts,snare(0.4,rng)); snares.append(round(ts,4))
                if slot in st.get('r',[]): place(x,ts,rim(0.35,rng)); snares.append(round(ts,4))
                if hats and q in (0,2): place(x,ts,hat(0.08,rng))
        root=roots[bar%4]
        if skank: place(x,t+p*0.5,stab(220*(root/55),0.22))                     # chord on every "and", even in the break
        if bass and pos in (1,3): place(x,t+p*0.5,tone(root,0.35,0.35,'sine')*env(int(0.35*SR),0.005,5)); basses.append(round(t+p*0.5,4))
        t+=p; beat+=1
    tm=0.6
    while tm<dur-1.5:                                                             # vocal-ish line off the grid
        d=rng.choice([0.7,1.1,1.6]); f=rng.choice([294,330,392,440]); s=tone(f,d,0.09)
        acc=0.0; y=np.zeros_like(s)
        for i in range(len(s)): acc+=0.08*(s[i]-acc); y[i]=acc
        place(x,tm+rng.random()*0.15,y*env(len(y),0.06,0.9)); tm+=d
    ir=(rng.random(int(0.5*SR))*2-1)*np.exp(-np.arange(int(0.5*SR))/SR*8)*0.03
    x=x+np.convolve(x,ir)[:n]+0.01*(rng.random(n)*2-1); x=x/max(1e-9,np.abs(x).max())*0.9
    with wave.open(f'{OUT}/{name}.wav','wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x*32767).astype(np.int16).tobytes())
    json.dump({'bass':basses,'kick':kicks,'snare':sorted(snares),'beats':beats,'down':down,'break':brk_t,'bpm':bpm0,'style':style},open(f'{OUT}/{name}.json','w'))
    print(name,'kicks',len(kicks),'snares',len(snares),'break',brk_t)

song('dembow-96',96,'dembow',1)
song('dembow332-100',100,'dembow332',2)
song('onedrop-75',75,'onedrop',3,drift=0.008)
song('steppers-140',140,'steppers',4,drift=0.0,brk=(12,14))
song('afro-108',108,'afro',5)
song('dembow-104-nofx',104,'dembow',6,skank=False,bass=False,hats=False)
