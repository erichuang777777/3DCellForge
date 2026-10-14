"""Nonadjacent noncoplanar triangle intersection test on anterior chest ROI.
AABB spatial hashing broad phase; segment/triangle exact narrow phase (1e-9).
Does not certify coplanar overlaps or the entire body mesh.
"""
import sys,json,itertools,os
import numpy as np
from collections import defaultdict
label=sys.argv[1];root='/tmp/3dcell-qa';j=json.load(open(f'{root}/{label}.json'));p=np.array(j['positions']).reshape(-1,3);f=np.array(j['indices']).reshape(-1,3);alltri=p[f]
roi_ymin=float(os.getenv('ROI_YMIN','1.10'));lo=alltri.min(1);hi=alltri.max(1); roi=(hi[:,1]>roi_ymin)&(lo[:,1]<1.40)&(hi[:,2]>.03)&(lo[:,0]<.19)&(hi[:,0]>-.19)
ids=np.flatnonzero(roi);t=alltri[roi];lo=t.min(1);hi=t.max(1);grid=defaultdict(list)
for i,(a,b) in enumerate(zip(np.floor(lo/.01).astype(int),np.floor(hi/.01).astype(int))):
 for cell in itertools.product(*[range(a[k],b[k]+1) for k in range(3)]):grid[cell].append(i)
pairs=set()
for vs in grid.values():
 for a,b in itertools.combinations(vs,2):pairs.add((a,b))
pa=np.array(list(pairs),dtype=np.int32); del pairs,grid
pa=pa[np.all(lo[pa[:,0]]<=hi[pa[:,1]]+1e-10,axis=1)&np.all(lo[pa[:,1]]<=hi[pa[:,0]]+1e-10,axis=1)]
# Weld coincident vertices for adjacency exclusion, including mesh seams.
_,weld=np.unique(np.round(p,7),axis=0,return_inverse=True);wf=weld[f[roi]]
adj=np.any(wf[pa[:,0],:,None]==wf[pa[:,1],None,:],axis=(1,2));pa=pa[~adj]
print('candidates',len(pa),flush=True)
def segment_hit(a,b,v):
 dr=b-a;e1=v[:,1]-v[:,0];e2=v[:,2]-v[:,0];h=np.cross(dr,e2);det=np.sum(e1*h,axis=1);ok=np.abs(det)>1e-14; inv=np.divide(1.,det,out=np.zeros_like(det),where=ok);s=a-v[:,0];u=inv*np.sum(s*h,1);q=np.cross(s,e1);vv=inv*np.sum(dr*q,1);tt=inv*np.sum(e2*q,1)
 return ok&(u>=-1e-8)&(vv>=-1e-8)&(u+vv<=1+1e-8)&(tt>1e-8)&(tt<1-1e-8)
hits=[]
for start in range(0,len(pa),50000):
 pp=pa[start:start+50000];a=t[pp[:,0]];b=t[pp[:,1]];hit=np.zeros(len(pp),bool)
 for k in range(3):hit|=segment_hit(a[:,k],a[:,(k+1)%3],b)|segment_hit(b[:,k],b[:,(k+1)%3],a)
 hits.extend(ids[pp[hit]].tolist())
r={'label':label,'roi_ymin':roi_ymin,'tested_roi_triangles':len(t),'nonadjacent_aabb_candidates':len(pa),'intersecting_pairs':len(hits),'face_pairs':hits,'limits':'Anterior chest ROI only (y minimum recorded above; maximum 1.40 m). Shared-vertex adjacency excluded after 1e-7 m welding; noncoplanar edge/triangle intersections only, not a global manifold/coplanar certificate.'};json.dump(r,open(f'{root}/{label}-intersections'+('-wide' if roi_ymin<1.1 else '')+'.json','w'),indent=2);print(json.dumps(r))
