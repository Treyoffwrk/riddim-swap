"""Compare tracker settings on the same clip: person switches, left/right flips, jitter, hip-tilt noise, lag.
python3 analyse.py clip-IMAGE-1.json clip-IMAGE-3.json ...  (one table per clip)"""
import json, sys, math
import numpy as np

L_R = [(11,12),(13,14),(15,16),(23,24),(25,26),(27,28),(29,30),(31,32),(17,18),(19,20),(21,22),(1,4),(2,5),(3,6),(7,8),(9,10)]
SWAP = list(range(33))
for a,b in L_R: SWAP[a],SWAP[b]=b,a

def centre(k):
    k=np.asarray(k); sh=(k[11,:2]+k[12,:2])/2; hp=(k[23,:2]+k[24,:2])/2
    return sh,hp,np.linalg.norm(sh-hp)

def pick_track(frames, aspect):
    """follow one person: start with the biggest, then the nearest each frame"""
    out=[]; prev=None
    for f in frames:
        P=[np.asarray(p['k'])*[1,aspect,1,1] for p in f['poses']]
        if not P: out.append(None); continue
        if prev is None:
            i=max(range(len(P)),key=lambda i:centre(P[i])[2]*P[i][[11,12,23,24],3].mean())
        else:
            psh,php,pt=centre(prev)
            d=[ (np.linalg.norm(centre(p)[1]-php)+np.linalg.norm(centre(p)[0]-psh))/max(pt,1e-3) for p in P]
            i=int(np.argmin(d))
            if d[i]>1.2: out.append(None); continue   # nobody near the last position: treat as lost
        prev=P[i]; out.append(P[i])
    return out

def first_only(frames, aspect):
    return [np.asarray(f['poses'][0]['k'])*[1,aspect,1,1] if f['poses'] else None for f in frames]

def metrics(track, name):
    n=len(track); have=[k is not None for k in track]
    jumps=0; swaps=0; acc={g:[] for g in ['hips','knees','ankles','wrists','shoulders']}
    groups={'hips':[23,24],'knees':[25,26],'ankles':[27,28],'wrists':[15,16],'shoulders':[11,12]}
    tilt=[]; sway=[]
    for i in range(n):
        k=track[i]
        if k is None: tilt.append(np.nan); sway.append(np.nan); continue
        sh,hp,T=centre(k)
        a2,b2=(k[23,:2],k[24,:2]) if k[23,0]<k[24,0] else (k[24,:2],k[23,:2]); d=b2-a2; tilt.append(math.degrees(math.atan2(-d[1],d[0])))
        sway.append((hp[0]-sh[0])/max(T,1e-3))
        j0=next((j for j in range(i-1,max(-1,i-6),-1) if track[j] is not None),None)
        if j0 is not None and np.linalg.norm(hp-centre(track[j0])[1])/max(centre(track[j0])[2],1e-3)>0.5+0.15*(i-j0-1): jumps+=1
        if i>0 and track[i-1] is not None:
            a=track[i-1]; _,hp0,T0=centre(a)
            legs=[23,24,25,26,27,28]
            c0=sum(np.linalg.norm(k[j,:2]-a[j,:2]) for j in legs); c1=sum(np.linalg.norm(k[SWAP[j],:2]-a[j,:2]) for j in legs)
            if c1<0.5*c0 and c0/max(T,1e-3)>0.3: swaps+=1
        if 0<i<n-1 and track[i-1] is not None and track[i+1] is not None:
            a,c=track[i-1],track[i+1]; _,_,T=centre(k)
            for g,js in groups.items():
                for j in js: acc[g].append(np.linalg.norm(a[j,:2]-2*k[j,:2]+c[j,:2])/max(T,1e-3))
    tilt=np.array(tilt); dt=np.abs(np.diff(tilt)); dt=dt[~np.isnan(dt)]
    # tilt wobble: second difference, which a real smooth tilt barely has
    t2=np.abs(tilt[:-2]-2*tilt[1:-1]+tilt[2:]); t2=t2[~np.isnan(t2)]
    return dict(name=name,frames=n,missing=n-sum(have),person_jumps=jumps,lr_flips=swaps,
                **{f'acc_{g}':float(np.median(v)) if v else float('nan') for g,v in acc.items()},
                tilt_wobble_deg=float(np.median(t2)) if len(t2) else float('nan'),
                tilt_range_deg=float(np.nanpercentile(tilt,95)-np.nanpercentile(tilt,5))), tilt, np.array(sway)

def lag(a,b,maxlag=6):
    m=~(np.isnan(a)|np.isnan(b)); a=a.copy(); b=b.copy(); a[~m]=0; b[~m]=0
    a=a-a[m].mean(); b=b-b[m].mean(); best=(0,-1)
    for L in range(-maxlag,maxlag+1):
        x=np.roll(b,L); c=(a*x).sum()/math.sqrt((a*a).sum()*(x*x).sum()+1e-12)
        if c>best[1]: best=(L,c)
    return best

if __name__=='__main__':
    rows=[]; series={}
    for fn in sys.argv[1:]:
        D=json.load(open(fn)); asp=D['H']/D['W']
        tr=pick_track(D['frames'],asp)
        m,tilt,sway=metrics(tr,fn.split('/')[-1].replace('.json',''))
        multi=sum(1 for f in D['frames'] if len(f['poses'])>1); m['multi_frames']=multi; m['ms']=round(D['ms'])
        rows.append(m); series[m['name']]=(tilt,sway)
        if '-1' in fn: pass
    keys=['name','frames','missing','multi_frames','person_jumps','lr_flips','acc_hips','acc_knees','acc_ankles','acc_wrists','tilt_wobble_deg','tilt_range_deg','ms']
    print(' | '.join(keys))
    for r in rows: print(' | '.join(f'{r[k]:.3f}' if isinstance(r[k],float) else str(r[k]) for k in keys))
    names=list(series)
    img=[n for n in names if 'IMAGE' in n]; vid=[n for n in names if 'VIDEO' in n]
    for a in img:
        for b in vid:
            if a.split('-')[-1]==b.split('-')[-1]:
                L,c=lag(series[a][1],series[b][1]); print(f'lag of {b} behind {a} (hip sway): {L} frames, r={c:.3f}')
