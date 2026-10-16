import sys,json,numpy as np,librosa,mir_eval
y,sr=librosa.load(sys.argv[1],sr=22050,mono=True)
tempo,bt=librosa.beat.beat_track(y=y,sr=sr,units='time')
js=json.load(open(sys.argv[2])); est=np.array(js['beats']); ref=np.array(bt)
R=mir_eval.beat.trim_beats(ref); E=mir_eval.beat.trim_beats(est)
f=mir_eval.beat.f_measure(R,E,f_measure_threshold=0.07)
per=np.median(np.diff(est)); fh=mir_eval.beat.f_measure(R,mir_eval.beat.trim_beats(est+per/2),0.07)
c=mir_eval.beat.continuity(R,E)
d=[np.min(np.abs(ref-e)) for e in E]
print(json.dumps({'librosa_bpm':round(float(np.atleast_1d(tempo)[0]),2),'js_bpm':round(js['bpm'],2),'F_70ms':round(f,3),'F_halfbeat_shift_control':round(fh,3),'CMLt':round(c[1],3),'AMLt':round(c[3],3),'median_offset_ms':round(1000*float(np.median(d)),1)}))
