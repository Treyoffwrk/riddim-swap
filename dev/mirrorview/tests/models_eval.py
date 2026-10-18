import json,sys,numpy as np
D=json.load(open(sys.argv[1]))
def arr(name):
    F=D[name]['frames'];T=np.array([f[0] for f in F]);P=np.full((len(F),33,3),np.nan)
    for i,f in enumerate(F):
        if f[1]:P[i]=np.array(f[1])
    return T,P
T,H=arr('heavy-640')
torso=np.nanmedian(np.hypot((H[:,11,0]+H[:,12,0])/2-(H[:,23,0]+H[:,24,0])/2,(H[:,11,1]+H[:,12,1])/2-(H[:,23,1]+H[:,24,1])/2))
groups={'hips':[23,24],'knees':[25,26],'ankles':[27,28],'wrists':[15,16],'shoulders':[11,12]}
# pelvis relative to shoulders: the hip "whine" signal
def pelvis_rel(P):
    return np.stack([(P[:,23,0]+P[:,24,0])/2-(P[:,11,0]+P[:,12,0])/2,(P[:,23,1]+P[:,24,1])/2-(P[:,11,1]+P[:,12,1])/2],1)
# aspect: x normalized to width, y to height (frame 576x1024) -> convert to pixels for distances
W,Hh=576,1024
def px(P):Q=P.copy();Q[...,0]*=W;Q[...,1]*=Hh;return Q
Hp=px(H);torso_px=np.nanmedian(np.hypot(((Hp[:,11,:2]+Hp[:,12,:2])/2-(Hp[:,23,:2]+Hp[:,24,:2])/2)[:,0],((Hp[:,11,:2]+Hp[:,12,:2])/2-(Hp[:,23,:2]+Hp[:,24,:2])/2)[:,1]))
print(f'torso length (heavy) {torso_px:.0f} px of a 1024 px tall frame; heavy found a pose on {np.mean(~np.isnan(H[:,0,0]))*100:.0f}% of frames, {D["heavy-640"]["msPerFrame"]:.0f} ms/frame here')
speed=np.r_[0,np.nanmean(np.hypot(*np.moveaxis(np.diff(Hp[:,[23,24,27,28,15,16],:2],axis=0),-1,0)),axis=1)]*30/torso_px
fast=speed>np.nanpercentile(speed,75)
rows=[]
def errs(P):
    Pp=px(P);out={}
    for g,j in groups.items():
        e=np.nanmean(np.hypot(Pp[:,j,0]-Hp[:,j,0],Pp[:,j,1]-Hp[:,j,1]),axis=1)/torso_px
        out[g]=(np.nanmedian(e),np.nanmedian(e[fast]))
    pr=pelvis_rel(P);ph=pelvis_rel(H);c=np.corrcoef(*[np.where(np.isnan(x),0,x) for x in (pr[:,0]-np.nanmean(pr[:,0]),ph[:,0]-np.nanmean(ph[:,0]))])[0,1]
    # lag of hip x vs heavy (frames)
    hx=np.nan_to_num(Pp[:,23,0]+Pp[:,24,0]-np.nanmean(Pp[:,23,0]+Pp[:,24,0]));rx=np.nan_to_num(Hp[:,23,0]+Hp[:,24,0]-np.nanmean(Hp[:,23,0]+Hp[:,24,0]))
    lags=range(-6,7);cc=[np.sum(hx[max(0,l):len(hx)+min(0,l)]*rx[max(0,-l):len(rx)+min(0,-l)]) for l in lags]
    jit=np.nanmedian(np.hypot(*np.moveaxis(np.diff(Pp[:,[23,24],:2],2,axis=0),-1,0)))/torso_px
    return out,c,list(lags)[int(np.argmax(cc))],jit,np.mean(~np.isnan(P[:,0,0]))
print(f'{"setting":18} {"found":>5}  hips err (all/fast)  ankles  knees  wrists   hip-sway corr  lag  hip jitter  ms/frame')
for name in D:
    if name=='heavy-640':continue
    T2,P=arr(name);o,c,lag,jit,found=errs(P)
    print(f'{name:18} {found*100:4.0f}%  {o["hips"][0]:.3f}/{o["hips"][1]:.3f}        {o["ankles"][0]:.3f}/{o["ankles"][1]:.3f} {o["knees"][0]:.3f} {o["wrists"][0]:.3f}/{o["wrists"][1]:.3f}  {c:5.2f}        {lag:+d}   {jit:.3f}      {D[name]["msPerFrame"]:.0f}')
# MirrorView default pipeline: lite 320 IMAGE sampled at 24/s then linear interpolation to every frame
T2,P=arr('lite-320-image');ts=np.arange(0,T2[-1],1/24);Pi=np.full_like(P,np.nan)
idx=np.round(ts*30).astype(int);S=P[idx]
for i,t in enumerate(T2):
    k=np.searchsorted(ts,t)
    if 0<k<len(ts):u=(t-ts[k-1])*24;Pi[i]=S[k-1]*(1-u)+S[k]*u
o,c,lag,jit,found=errs(Pi)
print(f'{"MV default (24/s)":18} {found*100:4.0f}%  {o["hips"][0]:.3f}/{o["hips"][1]:.3f}        {o["ankles"][0]:.3f}/{o["ankles"][1]:.3f} {o["knees"][0]:.3f} {o["wrists"][0]:.3f}/{o["wrists"][1]:.3f}  {c:5.2f}        {lag:+d}   {jit:.3f}')
print('errors are distances to the heavy model, in torso lengths (0.1 = a tenth of the shoulder-to-hip distance); fast = top 25% of limb speed')
