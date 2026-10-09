"""Export the chest anatomy used by public/breast-reconstruction-atlas from Z-Anatomy.

Usage (Blender as a Python module, `pip install bpy`):
    python export_z_anatomy.py -- --blend /path/to/Z-Anatomy/Startup.blend --out ./out/

Writes chest.glb (decimated meshes, Y-up, meters) and meta.json (vessel/nerve curves and landmarks).
Source: https://github.com/Z-Anatomy/Models-of-human-anatomy (CC BY-SA 4.0, derived from BodyParts3D).
"""
import bpy, sys, json, bmesh, math
BLEND=sys.argv[sys.argv.index('--blend')+1]
bpy.ops.wm.open_mainfile(filepath=BLEND)
OUT=sys.argv[sys.argv.index('--out')+1] if '--out' in sys.argv else './out/'
import os
if not OUT.endswith('/'): OUT += '/'
os.makedirs(OUT, exist_ok=True)
objs=bpy.data.objects
def get(n):
    o=objs.get(n)
    if o is None: print('MISSING',n)
    return o
LR=['l','r']
ribs=['First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth','Tenth','Eleventh','Twelfth']
cart=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth']
groups={}  # out name -> (list of source names, target tris, layer)
def add(out, srcs, tris, layer): groups[out]=(srcs,tris,layer)
for s in LR:
    for i,r in enumerate(ribs): add(f'rib{i+1}_{s}',[f'{r} rib.{s}'],900,'bone')
    for i,c in enumerate(cart): add(f'cart{i+1}_{s}',[f'Costal cartilage of {c} rib.{s}'],300,'cartilage')
    add(f'clavicle_{s}',[f'Clavicle.{s}'],700,'bone')
    add(f'scapula_{s}',[f'Scapula.{s}'],1400,'bone')
    add(f'humerus_{s}',[f'Humerus.{s}'],1200,'bone')
    add(f'hip_{s}',[f'Hip bone.{s}'],1600,'bone')
    add(f'pecmaj_{s}',[f'Clavicular head of pectoralis major muscle.{s}',f'Sternocostal head of pectoralis major muscle.{s}',f'(Abdominal part of pectoralis major muscle).{s}'],3500,'muscle')
    add(f'pecmin_{s}',[f'Pectoralis minor muscle.{s}'],1000,'muscle')
    add(f'serratus_{s}',[f'Serratus anterior muscle.{s}'],3000,'muscle')
    add(f'lat_{s}',[f'Latissimus dorsi muscle.{s}'],4000,'muscle')
    add(f'rectus_{s}',[f'Rectus abdominis muscle.{s}'],3000,'muscle')
    add(f'extobl_{s}',[f'External abdominal oblique muscle.{s}'],3500,'muscle')
    add(f'deltoid_{s}',[f'Clavicular part of deltoid muscle.{s}',f'Acromial part of deltoid muscle.{s}',f'Spinal part of deltoid muscle.{s}'],2000,'muscle')
    add(f'teres_{s}',[f'Teres major muscle.{s}'],600,'muscle')
    add(f'intercostal_{s}',[f'External intercostal muscles.{s}'],4000,'muscle')
    add(f'femur_{s}',[f'Femur.{s}'],1200,'bone')
    add(f'glutmax_{s}',[f'Gluteus maximus muscle.{s}'],3000,'muscle')
    add(f'gracilis_{s}',[f'Gracilis muscle.{s}'],1200,'muscle')
    add(f'vastlat_{s}',[f'Vastus lateralis muscle.{s}'],2500,'muscle')
    add(f'rectfem_{s}',[f'Rectus femoris muscle.{s}'],1500,'muscle')
    add(f'sartorius_{s}',[f'Sartorius muscle.{s}'],1200,'muscle')
    add(f'tfl_{s}',[f'Tensor fasciae latae.{s}'],800,'muscle')
    add(f'addlong_{s}',[f'Adductor longus.{s}'],1000,'muscle')
    add(f'intobl_{s}',[f'Internal abdominal oblique muscle.{s}'],2500,'muscle')
add('sternum',['Manubrium of sternum','Body of sternum','Xiphoid process'],1500,'bone')
add('spine',[f'Vertebra T{i}' for i in range(1,13)]+[f'Vertebra L{i}' for i in range(1,6)]+['Sacrum'],5000,'bone')
add('linea_alba',['Linea alba'],200,'fascia')
add('omentum',['Greater omentum'],1800,'omentum')
add('stomach',['Stomach'],900,'viscera')
add('colon',['Transverse colon'],500,'viscera')
add('liver',['Liver'],1500,'viscera')

trunk=['Infraclavicular fossa','Inframammary region','Mammary region','Pectoral region','Presternal region','Deltopectoral triangle','Lateral region of thorax','Epigastric region','Umbilical region','Umbilicus','Hypochondriac region','Hypogastric region','Inguinal region','Lateral region of abdomen','Lumbar region','Sacral region','Infrascapular region','Interscapular region','Scapular region','Triangle of auscultation','Vertebral region','Axillary region','Deltoid region','Gluteal region','Anterior region of thigh','Posterior region of thigh','Gluteal fold','Femoral triangle','Hip region','Anal region']
skin_src=[f'{t}.{s}' for t in trunk for s in LR]

coll=bpy.data.collections.new('EXPORT'); bpy.context.scene.collection.children.link(coll)
dg=bpy.context.evaluated_depsgraph_get()
meta={'parts':{},'missing':[]}
def mesh_from(srcs):
    bm=bmesh.new()
    for n in srcs:
        o=objs.get(n)
        if o is None or o.type!='MESH': meta['missing'].append(n); continue
        oe=o.evaluated_get(dg); me=oe.to_mesh()
        me.transform(o.matrix_world)
        if o.matrix_world.determinant() < 0: me.flip_normals()
        bm.from_mesh(me); oe.to_mesh_clear()
    return bm
for out,(srcs,tris,layer) in groups.items():
    bm=mesh_from(srcs)
    if len(bm.verts)==0: bm.free(); continue
    bmesh.ops.triangulate(bm, faces=bm.faces)
    nt=len(bm.faces)
    me=bpy.data.meshes.new(out); bm.to_mesh(me); bm.free()
    ob=bpy.data.objects.new(out, me); coll.objects.link(ob)
    if nt>tris:
        m=ob.modifiers.new('d','DECIMATE'); m.ratio=tris/nt
    meta['parts'][out]={'layer':layer,'src':srcs,'srcTris':nt}
# skin
bm=mesh_from(skin_src)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.009)
bm.normal_update()
import mathutils
C=mathutils.Vector((0,0.0,1.22))
for f in bm.faces:
    o=f.calc_center_median()-C
    if f.normal.dot(o)<0: f.normal_flip()
bm.normal_update()
me=bpy.data.meshes.new('skin'); bm.to_mesh(me); bm.free()
ob=bpy.data.objects.new('skin', me); coll.objects.link(ob)
m=ob.modifiers.new('s','SUBSURF'); m.levels=2; m.render_levels=2
meta['parts']['skin']={'layer':'skin','src':skin_src}
for o in coll.objects:
    for p in o.data.polygons: p.use_smooth=True
# select and export
bpy.ops.object.select_all(action='DESELECT')
for o in coll.objects: o.select_set(True)
bpy.context.view_layer.objects.active=coll.objects[0]
bpy.ops.export_scene.gltf(filepath=OUT+'chest.glb', use_selection=True, export_apply=True, export_yup=True, export_normals=True, export_materials='NONE', export_texcoords=False, export_draco_mesh_compression_enable=False)
# curves
curves={}
want=['Superior gluteal artery','Inferior gluteal artery','Lateral circumflex femoral artery','Medial circumflex femoral artery','Deep femoral artery','Perforating femoral arteries','Femoral artery','Posterior intercostal arteries','Musculophrenic artery','Lumbar arteries','External iliac artery','Internal thoracic artery','Internal thoracic veins','Superior epigastric artery','Superior epigastric veins','Inferior epigastric artery','Inferior epigastric vein','Thoracodorsal artery','Thoracodorsal vein','Thoracodorsal nerve','Subscapular artery','Lateral thoracic artery','Superficial epigastric artery']
names=[f'{w}.{s}' for w in want for s in LR]+['Right gastro-omental vein','Left gastro-omental vein','Descending branch of lateral circumflex femoral artery','Descending branch of lateral circumflex femoral artery.l']
for n in names:
    o=objs.get(n)
    if o is None or o.type!='CURVE': meta['missing'].append(n); continue
    pts=[]
    for sp in o.data.splines:
        seq=sp.bezier_points if sp.type=='BEZIER' else sp.points
        line=[]
        for p in seq:
            co=p.co
            v=o.matrix_world @ (co.xyz if hasattr(co,'xyz') and len(co)==4 else co)
            line.append([round(v.x,4),round(v.z,4),round(-v.y,4)])
        pts.append(line)
    curves[n]=pts
# landmarks
def bbox(n):
    o=objs[n]; P=[o.matrix_world@v.co for v in o.data.vertices]
    mn=[min(p[i] for p in P) for i in range(3)]; mx=[max(p[i] for p in P) for i in range(3)]
    c=[(mn[i]+mx[i])/2 for i in range(3)]
    return {'min':[mn[0],mn[2],-mn[1]],'max':[mx[0],mx[2],-mx[1]],'center':[c[0],c[2],-c[1]]}
meta['landmarks']={n:bbox(n) for n in ['Mammary region.l','Mammary region.r','Inframammary region.l','Inframammary region.r','Umbilicus.l','Xiphoid process','Body of sternum']}
meta['curves']=curves
json.dump(meta, open(OUT+'meta.json','w'))
print('done', len(meta['parts']), 'missing', meta['missing'])
