import glob,json,numpy as np,librosa,mir_eval,os
Fs=[];tok=0;rows=[]
for f in sorted(glob.glob('media/bench/*.wav')):
    t=json.load(open(f.replace('.wav','.json'))); y,sr=librosa.load(f,sr=22050)
    tempo,bt=librosa.beat.beat_track(y=y,sr=sr,units='time'); tempo=float(np.atleast_1d(tempo)[0])
    ref=np.array(t['beats'][1:-1]); Fv=mir_eval.beat.f_measure(ref,np.array(bt),0.07); Fs.append(Fv); ok=abs(tempo/t['bpm']-1)<0.04; tok+=ok
    rows.append('%-18s true %5.1f  librosa %6.1f  tempoOK %-5s F %.3f'%(os.path.basename(f)[:-4],t['bpm'],tempo,ok,Fv))
print('\n'.join(rows)); print('LIBROSA SUMMARY mean beat F=%.3f · tempo right %d/%d'%(np.mean(Fs),tok,len(Fs)))
