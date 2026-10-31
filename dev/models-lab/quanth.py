import onnx,numpy as np,sys
from onnx import numpy_helper as nh, helper as h, TensorProto as TP
src,dst,bits=sys.argv[1],sys.argv[2],int(sys.argv[3]) if len(sys.argv)>3 else 8
m=onnx.load(src);g=m.graph
inits={t.name:t for t in g.initializer}
qmax=2**(bits-1)-1
SKIP=set(sys.argv[4].split(',')) if len(sys.argv)>4 else set()
new_nodes=[];removed=0;saved=0
for nd in list(g.node):
    if nd.op_type=='Cast' and nd.input[0] in inits:
        w=nh.to_array(inits[nd.input[0]]).astype(np.float32)
        if w.ndim<2 or w.size<4096 or nd.input[0] in SKIP: new_nodes.append(nd);continue
        C=w.shape[0]
        if w.ndim==4 and w.shape[2]*w.shape[3]>1 and w.shape[1]>1: ax=(2,3)
        else: ax=tuple(range(1,w.ndim))
        s=np.abs(w).max(axis=ax,keepdims=True)/qmax;s[s==0]=1e-8
        q=np.clip(np.round(w/s),-qmax,qmax).astype(np.int8)
        base=nd.input[0]+'_q'
        g.initializer.remove(inits[nd.input[0]])
        g.initializer.append(nh.from_array(q,base))
        g.initializer.append(nh.from_array(s.astype(np.float32),base+'_s'))
        new_nodes.append(h.make_node('Cast',[base],[base+'_f'],to=TP.FLOAT))
        new_nodes.append(h.make_node('Mul',[base+'_f',base+'_s'],[nd.output[0]]))
        removed+=1
    else: new_nodes.append(nd)
del g.node[:];g.node.extend(new_nodes)
onnx.checker.check_model(m);onnx.save(m,dst);print('quantized',removed)
