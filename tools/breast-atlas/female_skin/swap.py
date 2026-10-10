# 以 Blender 把 chest.glb 的皮膚換成 MakeHuman 女性皮膚(CC0)
import bpy, sys
src, out, trunk = sys.argv[-3:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o.name.split('.')[0] in ('skin', 'skin_arm'): bpy.data.objects.remove(o, do_unlink=True)
for path, name, lv in ((trunk, 'skin', 2),):
    bpy.ops.wm.obj_import(filepath=path, forward_axis='Y', up_axis='Z')  # 檔案已是 Blender 座標(Z 向上)
    ob = bpy.context.selected_objects[0]; ob.name = name; ob.data.name = name
    m = ob.modifiers.new('s', 'SUBSURF'); m.levels = lv; m.render_levels = lv
    sm = ob.modifiers.new('m', 'SMOOTH'); sm.factor = 0.5; sm.iterations = 3
    for p in ob.data.polygons: p.use_smooth = True
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_apply=True, export_yup=True, export_normals=True, export_materials='NONE', export_texcoords=False)
print('done')
