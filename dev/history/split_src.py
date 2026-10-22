"""One-time split of the patched single file into source files. build_src.py puts them back together."""
import pathlib
s=pathlib.Path('/home/claude/riddim-swap.html').read_text()
D=pathlib.Path('/home/claude/src')
def cut(a,b,frm=0):
    i=s.index(a,frm)+len(a); j=s.index(b,i); return i,j
i1,j1=cut('<style>','</style>')
k=j1; i2,j2=cut('<script>','</script>',k)
i3,j3=cut('<script>','</script>',j2)
i4,j4=cut('<script>','</script>',j3)
parts={'head.html':s[:i1],'style.css':s[i1:j1],'markup.html':s[j1:i2],'analysis.js':s[i2:j2],'between1.html':s[j2:i3],'body.js':s[i3:j3],'between2.html':s[j3:i4],'app.js':s[i4:j4],'tail.html':s[j4:]}
for n,t in parts.items(): (D/n).write_text(t)
print({n:len(t) for n,t in parts.items()})
