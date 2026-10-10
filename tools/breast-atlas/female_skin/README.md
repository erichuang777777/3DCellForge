# Female skin for the breast atlas

Builds the `skin` mesh of `public/breast-reconstruction-atlas/chest.glb` from the MakeHuman base mesh
(MPFB2, CC0 1.0: https://github.com/makehumancommunity/mpfb2) and fits it to the Z-Anatomy skeleton.

Steps (Python with numpy + scipy; the last step runs Blender as a module, `pip install bpy`):

1. `MPFB_DATA=path/to/mpfb2/src/mpfb/data ATLAS_GLB=chest.glb python fit.py`
   Adult female (Asian young, flat chest; the breast is procedural in `app.js`). Arms are re-posed onto the
   humerus axis, the body is scaled by the sternal-notch-to-navel height and each slice is fitted to the
   Z-Anatomy trunk depth and half of its width.
2. `ATLAS_GLB=chest.glb python poke.py` pushes the skin outward wherever Z-Anatomy muscles or bones would
   show through, and writes `skin_trunk.obj` (trunk and arms, three.js Y-up coordinates).
3. Convert the OBJ to Blender coordinates (x, -z, y), then
   `python swap.py -- chest.glb chest_new.glb skin_trunk_b.obj` replaces the `skin` mesh (subdivided twice).
