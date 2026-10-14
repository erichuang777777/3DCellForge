"""Orthographic z-buffer software renders of exported actual runtime skin meshes.
Does not reproduce GLSL, UI, layers, lighting, or WebGL and is not browser QA.
"""
import json,sys,os
import numpy as np
from PIL import Image,ImageDraw
label=sys.argv[1]; root='/tmp/3dcell-qa'
d=json.load(open(f'{root}/{label}.json')); p=np.array(d['positions']).reshape(-1,3); base=np.array(d['base']).reshape(-1,3); f=np.array(d['indices']).reshape(-1,3); n=np.array(d['normals']).reshape(-1,3)
S=960; span=.50; center=np.array([0,1.245,.045]); views={'front':[0,0,1],'side':[1,0,0],'oblique':[.8,0,1],'inferior':[0,-.8,1]}
tri=p[f]; cross=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]); area=np.linalg.norm(cross,axis=1)/2
btri=base[f]; bc=np.cross(btri[:,1]-btri[:,0],btri[:,2]-btri[:,0]); ba=np.linalg.norm(bc,axis=1)/2
roi=(tri.mean(1)[:,1]>1.10)&(tri.mean(1)[:,1]<1.40)&(tri.mean(1)[:,2]>.03)&(np.abs(tri.mean(1)[:,0])<.19)
metrics={'label':label,'vertices':len(p),'triangles':len(f),'nonfinite':int((~np.isfinite(p)).sum()),'zero_area_faces_1e-12_m2':int((area<1e-12).sum()),'base_zero_area_faces_1e-12_m2':int((ba<1e-12).sum()),'breast_roi_faces':int(roi.sum()),'breast_roi_zero_area_faces':int((roi&(area<1e-12)).sum()),'breast_roi_normal_rotation_over_90deg':int((roi&((cross*bc).sum(1)<0)).sum()),'max_displacement_mm':float(np.max(np.linalg.norm(p-base,axis=1))*1000),'limits':'Normal rotation is diagnostic, not proof of an inversion. Software skin-only renderer; no WebGL/UI/shader pass.'}
json.dump(metrics,open(f'{root}/{label}-metrics.json','w'),indent=2)
for view,cv in views.items():
 if len(sys.argv)>2 and view not in sys.argv[2:]: continue
 z=np.array(cv,dtype=float);z/=np.linalg.norm(z);x=np.cross([0,1,0],z);x/=np.linalg.norm(x);y=np.cross(z,x); basis=np.stack([x,y,z],axis=1)
 q=(p-center)@basis; q[:,:2]=q[:,:2]*S/span+S/2;q[:,1]=S-q[:,1]
 depth=np.full((S,S),-np.inf);rgb=np.full((S,S,3),[239.,235.,229.]);vn=n@basis
 light=np.array([-.45,.62,.8]);light/=np.linalg.norm(light)
 shades=.42+.58*np.maximum(vn@light,0);colors=np.array([215,166,142])[None,:]*shades[:,None]
 # Faces are rasterized with barycentric interpolation and a per-pixel depth test.
 for ids in f:
  a,b,c=q[ids]; lo=np.maximum(np.floor(np.min([a[:2],b[:2],c[:2]],0)).astype(int),0);hi=np.minimum(np.ceil(np.max([a[:2],b[:2],c[:2]],0)).astype(int),S-1)
  if np.any(hi<lo):continue
  den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<1e-8:continue
  xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1)+.5,np.arange(lo[1],hi[1]+1)+.5)
  u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den;v=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;w=1-u-v
  zz=u*a[2]+v*b[2]+w*c[2]; ds=depth[lo[1]:hi[1]+1,lo[0]:hi[0]+1]; mask=(u>=-1e-7)&(v>=-1e-7)&(w>=-1e-7)&(zz>ds)
  ds[mask]=zz[mask]; col=u[:,:,None]*colors[ids[0]]+v[:,:,None]*colors[ids[1]]+w[:,:,None]*colors[ids[2]];rs=rgb[lo[1]:hi[1]+1,lo[0]:hi[0]+1];rs[mask]=col[mask]
 im=Image.fromarray(np.uint8(np.clip(rgb,0,255)));draw=ImageDraw.Draw(im);draw.rectangle((0,0,S,53),fill='#182733');draw.text((20,12),f'{label.upper()} | {view.upper()} | actual deformed skin mesh',fill='white');draw.text((20,32),'Offline orthographic software render. Skin only; not a WebGL screenshot.',fill='#c3cdd6');im.save(f'{root}/{label}-{view}.png');print(view,flush=True)
print(json.dumps(metrics),flush=True)
