import onnx, numpy as np, sys
from onnx import numpy_helper as nh, helper as h, TensorProto as T
src,dst=sys.argv[1],sys.argv[2]; MIN=int(sys.argv[3]) if len(sys.argv)>3 else 4096
m=onnx.load(src)
g=m.graph
# lift big float Constant nodes into initializers
keep=[]
for n in g.node:
    if n.op_type=='Constant' and len(n.attribute)==1 and n.attribute[0].name=='value' and n.attribute[0].t.data_type==1 and np.prod(n.attribute[0].t.dims)>=MIN:
        t=n.attribute[0].t; t.name=n.output[0]; g.initializer.append(t)
    else: keep.append(n)
del g.node[:]; g.node.extend(keep)
cons={}
for n in g.node:
    for k,i in enumerate(n.input): cons.setdefault(i,[]).append((n.op_type,k))
new_init=[]; dq=[]; nq=0; before=0; after=0
for t in list(g.initializer):
    a=nh.to_array(t)
    if a.dtype!=np.float32 or a.size<MIN or a.ndim<2:
        new_init.append(t); continue
    uses=cons.get(t.name,[])
    axis=a.ndim-1 if any(op=='MatMul' and k==1 for op,k in uses) else 0
    red=tuple(i for i in range(a.ndim) if i!=axis)
    mx=np.abs(a).max(axis=red); sc=np.where(mx>0,mx/127.0,1.0).astype(np.float32)
    shp=[1]*a.ndim; shp[axis]=-1
    q=np.clip(np.round(a/sc.reshape(shp)),-127,127).astype(np.int8)
    new_init += [nh.from_array(q,t.name+'_q'), nh.from_array(sc,t.name+'_s'), nh.from_array(np.zeros_like(sc,dtype=np.int8),t.name+'_z')]
    dq.append(h.make_node('DequantizeLinear',[t.name+'_q',t.name+'_s',t.name+'_z'],[t.name],axis=axis,name=t.name+'_dq'))
    nq+=1; before+=a.nbytes; after+=q.nbytes+sc.nbytes*2
del g.initializer[:]; g.initializer.extend(new_init)
nodes=list(g.node); del g.node[:]; g.node.extend(dq+nodes)
onnx.save(m,dst)
print(dst.split('/')[-1], 'quantized', nq, 'tensors', round(before/1e6,1),'MB ->',round(after/1e6,1),'MB')
