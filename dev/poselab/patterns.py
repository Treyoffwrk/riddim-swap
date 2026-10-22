"""Hip pattern labels from per-frame tilt/sway/thrust. Prototype + checks on synthetic patterns with real-sized noise."""
import numpy as np, json
FPS=30
def ac(x,lo,hi):
    """period from the first repeat: the autocorrelation must dip below -0.1 (it swings back) and then peak again"""
    x=x-np.nanmean(x);x=np.nan_to_num(x);d=np.dot(x,x)
    if d<=0:return 0,0
    r=[1.0]+[np.dot(x[:-L],x[L:])/d*len(x)/(len(x)-L) for L in range(1,hi+2)]
    dip=next((L for L in range(1,hi) if r[L]<-0.1),None)
    if dip is None:return 0,0
    for L in range(max(dip,lo),hi+1):
        if r[L]>=r[L-1] and r[L]>=r[L+1]:return r[L],L
    return 0,0
def corr(a,b):
    a=a-a.mean();b=b-b.mean();d=np.sqrt((a*a).sum()*(b*b).sum());return float((a*b).sum()/d) if d>0 else 0
def window_label(tilt,sway,thrust):
    at,as_=np.nanstd(tilt),np.nanstd(sway)
    if at<2.0 and as_<0.025:return 'still'
    rt,Lt=ac(tilt,5,30);rs,Ls=ac(sway,5,30)
    r,L=(rt,Lt) if rt*at/3>=rs*as_/0.04 else (rs,Ls)
    if r<0.35:return 'free'
    q=max(1,round(L/4));circ=0;zero=0
    for X in [tilt,thrust]:
        if X is None or np.all(np.isnan(X)):continue
        X=np.nan_to_num(X-np.nanmean(X));s=np.nan_to_num(sway-np.nanmean(sway))
        c=max(abs(corr(s[:-q],X[q:])),abs(corr(s[q:],X[:-q])));z=abs(corr(s,X))
        if c>circ:circ,zero=c,z
    if as_>0.03 and circ>0.5 and zero<0.5 and circ-zero>0.2:return 'circle'
    if L<=11:return 'pulse'   # under ~0.37 s per cycle: quicker than 2.7 per second
    if at>=3 and at/3>=as_/0.04:return 'tilt'
    if as_>=0.04:return 'sway'
    return 'tilt' if at>=3 else 'free'
def label_series(tilt,sway,thrust,win=45,hop=8):
    n=len(tilt);labs=[]
    for s in range(0,n-win+1,hop):
        labs.append((s,s+win,window_label(tilt[s:s+win],sway[s:s+win],None if thrust is None else thrust[s:s+win])))
    return labs
rng=np.random.default_rng(3)
def synth(kind,secs=6):
    t=np.arange(int(secs*FPS))/FPS;f={'circle':1.6,'tilt':1.7,'pulse':3.3,'sway':1.2}.get(kind,1.5)
    nz=lambda s:rng.normal(0,s,len(t))
    if kind=='still':return 0.4*np.sin(2*np.pi*0.3*t)+nz(0.5),0.01*np.sin(2*np.pi*.2*t)+nz(0.006),nz(0.03)
    if kind=='circle':return 6*np.sin(2*np.pi*f*t+1.6)+nz(0.6),0.08*np.sin(2*np.pi*f*t)+nz(0.008),0.08*np.cos(2*np.pi*f*t)+nz(0.05)
    if kind=='tilt':return 9*np.sin(2*np.pi*f*t)+nz(0.6),0.02*np.sin(2*np.pi*f*t)+nz(0.008),nz(0.05)
    if kind=='pulse':return 5*np.sin(2*np.pi*f*t)+nz(0.6),0.02*np.sin(2*np.pi*f*t)+nz(0.008),nz(0.05)
    if kind=='sway':return 1.5*np.sin(2*np.pi*f*t)+nz(0.6),0.09*np.sin(2*np.pi*f*t)+nz(0.008),nz(0.05)
    if kind=='free':
        x=np.cumsum(nz(1.2));y=np.cumsum(nz(0.01));return x-x.mean(),y-y.mean(),nz(0.05)
kinds=['still','circle','tilt','pulse','sway','free']
conf={k:{} for k in kinds}
for k in kinds:
    for rep in range(40):
        T,Sw,Th=synth(k);labs=[l for _,_,l in label_series(T,Sw,Th)]
        for l in labs:conf[k][l]=conf[k].get(l,0)+1
for k in kinds:
    tot=sum(conf[k].values());print(f'{k:7s} -> '+', '.join(f'{l} {v/tot*100:.0f}%' for l,v in sorted(conf[k].items(),key=lambda x:-x[1])))
# real clips
for c in ['u3','u1']:
    D=json.load(open(f'{c}-CLEAN-3.json'));H=np.array([f['hips'] for f in D['frames']],dtype=float)
    labs=label_series(H[:,0],H[:,2],H[:,5]);from collections import Counter
    print(c,'real clip windows:',dict(Counter(l for _,_,l in labs)))
