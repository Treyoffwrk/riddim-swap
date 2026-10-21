import json,sys
for fn in sys.argv[1:]:
    D=json.load(open(fn));s=[]
    for f in D['frames'][::20]:s.append(str(round((f['poses'][0]['k'][23][0]+f['poses'][0]['k'][24][0])/2,2)) if f['poses'] else '-')
    print(fn.split('/')[-1],' '.join(s))
