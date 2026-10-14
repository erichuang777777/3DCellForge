# Breast atlas v0.25: parametric envelope and independent nipple relief

This is an educational geometry revision, not a patient-specific surface fit,
clinical measurement tool, or validated prediction of a surgical result.
The existing atlas UI, anatomy assets, layer controls and surgical scenario
catalog remain in place.

## Shape pipeline

1. `surface.js` defines a smooth radial envelope with a fixed chest-wall boundary.
   The upper/lower support radii remain separate. A smooth lower-pole displacement
   creates fullness and a return toward the inframammary attachment (IMF).
2. Gravity and lower-pole fullness use material coordinates, independently of
   nipple relief and resection dents. The IMF does not slide with the ptosis
   control. Material anchors for quadrants, lesions and fat placement are not
   displaced twice.
3. An exact triangle-based front-chest chart follows the source torso at each
   displaced point. Hidden source sheets with the same projected coordinates
   are excluded from deformation. Skin, fat/gland shells and internal markers
   share the chest-following correction. Wrapped implant scenarios deliberately retain the legacy profile,
   support patch, placement, gravity, nipple detail and wrapping solver; this
   first revision does not rebuild or certify implant appearance.
4. For the rebuilt natural envelope, nipple relief is a separate final Gaussian
   displacement along the completed
   skin's outward normal. A fixed-forward bump can self-intersect on a hanging
   surface, even when the underlying envelope is smooth.

The volume label explicitly describes a rough envelope integral. It is not a
closed-mesh volume or a clinical measurement. Distance inputs position the
pre-descent envelope; the UI now explains this interpretation.

## Verification

- `npm run lint`, `npm test` (46 tests), `npm run build` and JavaScript syntax checks.
- New tests cover finite values, radial depth monotonicity, lower return,
  smooth attachment, fixed IMF across cup/ptosis controls, independent detail,
  downward-facing nipple relief, and exact sloped chest-chart interpolation.
- Offline QA executes the actual runtime geometry functions against `chest.glb`,
  preserving 103,523 skin vertices and 206,656 triangles. Front, side, oblique and
  inferior views use identical cameras before/after.
- An anterior torso ROI (y 0.8–1.4 m) nonadjacent noncoplanar triangle test finds
  297 intersecting pairs already in the prepared source mesh. Default, A/ptosis0,
  F/ptosis0, C/ptosis3 and F/ptosis3 retain those same pairs with no added pairs.
  This is a regression result, **not** a claim that the original mesh is
  watertight or intersection-free.

See `tools/breast-atlas/qa/README.md` for reproducible mesh exports, renders and
intersection checks. QA reports uncovered chest-chart queries; it does not
invent or extrapolate missing anatomy.

## Remaining verification limits

Browser/WebGL interaction and shader regression testing could not run in the
available execution environment. The review images are software-rendered actual
skin meshes, not browser screenshots. They omit areola shader color and other
anatomy layers. The test is not an exhaustive check of all measurement inputs,
intermediate animations, lesions, implant sizes or surgical combinations, and
it does not detect coplanar overlap or certify global manifoldness. Clinical
review and a live atlas walkthrough remain necessary before clinical use.
