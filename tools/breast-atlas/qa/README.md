# Offline skin-mesh QA

These scripts evaluate selected **authored runtime functions** from `app.js`
using Node VM, load the actual `chest.glb` with Three.js, and run
`flattenMaleNipples → fleshOut → prepBreastRegions → updateBreasts` for
`BASE_STATE` and default `PROFILE`. They do not rebuild the deformation formula
in Python. Local geometry module imports are loaded from the working tree;
revision exports should only be used when that revision has no such import or
its modules match the working tree. The GLB is taken from the working tree.

Run from the repository root:

    node tools/breast-atlas/qa/export-skin.mjs d6ec4d3 baseline
    node tools/breast-atlas/qa/export-skin.mjs working revised
    python tools/breast-atlas/qa/render-skin.py baseline
    python tools/breast-atlas/qa/render-skin.py revised
    python tools/breast-atlas/qa/check-intersections.py baseline
    python tools/breast-atlas/qa/check-intersections.py revised

Outputs go to `/tmp/3dcell-qa`. Python requires NumPy and Pillow. Node requires
Three.js and Acorn (already present in the repository's installed dependencies).

## Rendering

Four identical orthographic cameras: front (+Z), side (+X), oblique (+X/+Z),
and inferior (−Y/+Z). All center on `(0, 1.245, 0.045)` metres and span 0.50 m.
A barycentric software rasterizer uses per-pixel depth and interpolated vertex
lighting. It renders the actual skin mesh only, without nipples/areola shader
color, other layers, UI, WebGL, runtime interactions, or the application's GLSL.
Visible open neck/arm geometry is inherited from the source skin asset. These
images are geometric review artifacts, **not browser screenshots**.

## Diagnostics

- Nonfinite positions and zero-area faces (<1e−12 m²).
- Normal rotation relative to prepared base. A >90° rotation can be a legitimate
  overhang, so it is not alone an inversion verdict.
- Nonadjacent noncoplanar triangle intersections in an anterior-chest ROI:
  y 1.10–1.40 m, z >0.03 m, x −0.19–0.19 m. Spatial-hashed AABB broad phase,
  segment/triangle narrow phase, shared vertices excluded after 1e−7 m welding.
  This does not certify coplanar overlaps, whole-body manifoldness, implant
  containment, or all profile/scenario extremes.
- Interpret intersections against the prepared base, not as newly introduced
  defects by default: the current GLB/preprocessing already contains overlap.

PROFILE_JSON merges a JSON object into PROFILE. STATE_JSON patches side/state parameters; NO_AREOLA disables nipple relief for diagnostic isolation. Renderer accepts optional view names after the label.

## Final-runtime stress cases

The chosen natural-breast runtime uses the shared surface, lower fullness coefficient 0.32,
immutable chest-chart correction, front-chart membership, and final mesh-normal
nipple relief. It does not use the exploratory gravity caps or weighting overrides.

Use `ROI_YMIN=.8` for the wider stress-test ROI, spanning y 0.8–1.4 m. This
writes `*-intersections-wide.json`. Compare **face-pair identities**, not only
counts, against an export whose positions are the prepared base positions.
The base asset contains pre-existing overlapping geometry.

Representative commands:

    PROFILE_JSON='{"cup":"F","pt":3,"full":0.35,"ver":1}' node tools/breast-atlas/qa/export-skin.mjs working final-f-pt3
    ROI_YMIN=.8 python tools/breast-atlas/qa/check-intersections.py final-f-pt3
    STATE_JSON='{"R":{"P":0.003,"shape":"flat","areola":false}}' node tools/breast-atlas/qa/export-skin.mjs working scenario-flat
    STATE_JSON='{"R":{"defect":0.015,"dq":"uoq"}}' node tools/breast-atlas/qa/export-skin.mjs working scenario-defect
    STATE_JSON='{"R":{"sc":1.2},"L":{"sc":0.8}}' node tools/breast-atlas/qa/export-skin.mjs working scenario-asymmetry
    STATE_JSON='{"R":{"shape":"round"},"L":{"shape":"round"}}' node tools/breast-atlas/qa/export-skin.mjs working scenario-round
    python tools/breast-atlas/qa/compare-renders.py baseline rebuilt

`IMPLANT_JSON` enables actual `computeTargets` with the GLB pectoralis meshes
and metadata, then patches the implant/augmentation state. This only checks the
resulting skin geometry; it does not validate implant containment, muscle
draping, visibility, or the complete reconstruction scene. Wrapped implants retain the isolated legacy geometry pipeline; compare their
vertices directly against the same baseline state, rather than expecting the
legacy source overlaps to disappear. Geometry stress checks do not establish
anatomical/clinical realism of extreme settings.

The exporter records app source SHA-256 and active state/profile overrides.
Region chartMisses values expose uncovered chart samples (both regions share
the same sampler, so these are shared counts, not additive side counts).
