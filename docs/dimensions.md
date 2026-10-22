# Linear dimensions from native model geometry

`drawing_dimension` annotates one `drawing_part_view` with a vector dimension
line, extension lines, arrowheads, and a numeric label. A request selects either
named geometry provided by its source model or an inferred view extent. Values
come from that geometry in model mm; no independent numeric or text override can
drift from the model.

## Authoring intent

Dimensions nest under a part view. Use explicit boolean presets for the overall
size of its selected geometry:

```tsx
<assembly.drawing.partview
  partRef=".tube"
  name="end"
  direction="z+"
  width="90mm"
  height="90mm"
>
  <assembly.drawing.dimension widthOfView offset="10mm" precision={1} />
  <assembly.drawing.dimension heightOfView offset="10mm" />
</assembly.drawing.partview>
```

For a particular feature, reference a named edge actually provided by the model:

```tsx
<assembly.drawing.partview
  partRef=".tube"
  name="rounded-end"
  direction="z+"
  width="90mm"
  height="90mm"
>
  <assembly.drawing.dimension widthOfView offset="10mm" />
  <assembly.drawing.dimension
    edgeRef=".tube > .outer_top"
    orientation="horizontal"
    offset="23mm"
  />
</assembly.drawing.partview>
```

Select exactly one of `edgeRef`, `widthOfView`, or `heightOfView`.
The booleans request inferred extents, not imaginary named edges; an arbitrary
`overall_width` string is not a bounds request. Props #953 rejects conflicting
targets and explicit orientation with a true view preset. False booleans do not
select a target. Core registration, selector resolution, and dimension emission
remain future integration work. The exporter reads resolved Circuit JSON and
does not interpret TSX selectors.

## Native geometry ownership

Edges are not defined as endpoint pairs in drawing configuration or modelprinter.
A source model owns its native geometry and names: a JSCAD path can contain lines
and arcs, STEP can carry topology and native labels, and glTF producers can carry
named geometry metadata. There is no universal topology schema here, and mesh
indices do not automatically become stable edge names. STEP and glTF reader
adapters remain follow-up work.

The JSCAD model names its native construction features in Fiber TSX. The geometry
helper returns unnamed shapes; the component chooses stable feature names:

```tsx
import jscad from "@jscad/modeling";
import { Custom } from "jscad-fiber/headless";
import { renderToJscadModel } from "jscad-fiber/model";
import { createRectangularTubeConstruction } from "jscad-electronics";

function TubeModel() {
  const {
    solid,
    outer: outerProfile,
    topPath,
  } = createRectangularTubeConstruction({
    width: 40,
    height: 20,
    wallThickness: 3,
    length: 80,
    outerRadius: 3,
    innerRadius: 1,
  });
  return (
    <>
      <Custom geometry={solid} />
      <Custom name="outer_profile" geometry={outerProfile} reference />
      {topPath && <Custom name="outer_top" geometry={topPath} reference />}
    </>
  );
}

const tube = renderToJscadModel(<TubeModel />, jscad);
```

A `reference` marker names existing geometry and contributes no visible solid.
`renderToJscadModel` returns `{ geometries, referenceFeatures }`: the first is the
rendered native geometry, and each named reference contains `{ geometry, matrix }`.
The native feature can be `Geom2`, `Path2`, or `Geom3`; `matrix` is its complete
4×4 column-major ancestor transform in CAD mm, +Z up. Readers interpret the
native type for their task. An edge reader can accept a planar path or profile
and explicitly reject an unsupported solid reference.

Names belong in the model's TSX, not in an author-built `namedEdges` map. The
`createRectangularTubeModel(parameters)` convenience constructor renders the same
registered `RectangularTube` component through this collector. The isolated
`jscad-fiber/model` entry point needs no viewer. Native `Custom` geometry uses this
collector; the pure JSON headless renderer reports unsupported native `Custom`
geometry explicitly rather than silently discarding it.

The model-aware reader samples the retained native geometry. `outer_top` is the
straight feature between rounded-corner tangencies, measuring
`40 - 2 × 3 = 34`mm. `outer_profile` is the closed rounded contour spanning the
actual 40mm width. No artificial 40mm envelope edge is created.

Modelprinter continues to own parameter strings, schemas, defaults, dimensions,
and validation; it does not duplicate named feature geometry. The earlier
modelprinter endpoint metadata proposal is superseded by names declared on
native features in the model's TSX.

## Circuit JSON associations

An edge request records only the owning model and its opaque native name:

```ts
{
  type: "drawing_dimension",
  drawing_dimension_id: "end_top_feature",
  drawing_part_view_id: "end",
  cad_component_id: "cad_tube",
  edge_name: "outer_top",
  orientation: "horizontal",
  offset: 23,
  precision: 1,
}
```

The referenced CAD component already describes how to obtain and place its model.
The dimension does not duplicate the edge's shape, curve, endpoints, or topology.

An inferred extent references only the part view:

```ts
{
  type: "drawing_dimension",
  drawing_dimension_id: "end_width",
  drawing_part_view_id: "end",
  width_of_view: true,
  offset: 10,
  precision: 1,
}
```

Select exactly one target: the complete `cad_component_id` + `edge_name` pair,
`width_of_view: true`, or `height_of_view: true`. There is no target enum or
default target. View flags forbid either edge-target field. False flags do not
select a target and are omitted from canonical parsed output. Both true flags,
mixed targets, incomplete owner/name pairs, and missing targets are errors.
Orientation defaults to aligned for a model-edge reference, horizontal for width,
and vertical for height. Canonical Circuit JSON accepts a matching explicit view
orientation and rejects a conflicting one. No named edge record is produced.

For an edge request, the owning CAD record must exist and its source component
must belong to the view's selected source components/group. If both selection
fields are supplied, both constraints apply. Duplicate IDs, missing owners,
missing views, and out-of-selection owner references are errors. Unknown native
names or unsupported native geometry must be rejected by the model reader rather
than replaced with inferred bounds.

## Reading model geometry

`DrawingOptions.resolveModelEdge(dimension, view, input)` may return synchronously
or asynchronously. It resolves the owning model and samples that named geometry
for projection:

```ts
import { readJscadNamedEdge } from "jscad-electronics";

const svg = await convertCircuitJsonToDrawingSvg(circuitJson, {
  resolveScene: () => tubeScene,
  resolveModelEdge: (dimension) => {
    if (dimension.cad_component_id !== "cad_tube") {
      throw new Error("The requested model is not loaded");
    }
    // The reader applies each reference feature's complete Fiber matrix.
    // This example's outer CAD-component placement is identity.
    return readJscadNamedEdge(tube, dimension.edge_name!);
  },
});
```

The callback result is `{ points: readonly { x, y, z }[], closed: boolean }`.
This is a temporary sampling adapter for renderer use, outside Circuit JSON;
it is not the model's topology definition. Curves remain native to the model.
The adapter must supply finite CAD world-space points in mm (+Z up) after the
same instance scale, rotation, and translation used by the rendered model.
`readJscadNamedEdge` applies the full collected Fiber `matrix` to every sample;
its caller then applies any outer CAD-component placement exactly once. The
callback must report whether the path is closed. The exporter converts CAD points to
glTF +Y-up for projection and does not reapply the model's placement. Cache model
loading and native reader results in the caller when several dimensions share a
model.

Horizontal and vertical dimensions measure the full sampled path's span on the
camera's right/up axes. A closed `outer_profile` therefore measures 40mm wide;
using only its first and last point would incorrectly collapse a closed contour.
For this initial linear annotation, aligned dimensions accept only a straight,
open edge. Closed paths and noncollinear curves must fail rather than silently
turning into an endpoint chord. Radius, diameter, arc-length, and angular
annotations remain future work.

## Measurement and paper layout

- `aligned` measures a supported straight edge's true 3D length, including in an
  isometric view; its dimension line follows the projected edge.
- `horizontal` and `vertical` measure the native geometry's span along the view's
  orthonormal right/up model axes, using all sampled points.
- `width_of_view` and `height_of_view` measure the selected rendered geometry after
  model/world transforms. Section views use retained cut geometry. Viewport size,
  paper scale, and raster allocation do not supply the measured value.
- `offset` defaults to 8 signed paper mm. Positive follows the left normal in
  paper +Y-up coordinates: horizontal above, vertical left. Negative inferred
  offsets choose the bottom or right bounding side. Aligned edges retain native
  direction. Zero is allowed.
- `precision` defaults to 1 and accepts integer decimal places 0–6. Values are
  shown in model mm.

Annotations use the same camera as the PoppyGL raster, including auto-fit,
explicit scale, sections, and nonzero world placement. Model values remain
independent of paper scale and raster resolution: a 40mm extent still labels
40.0 at 1:1 or 1:2. End-on edges, zero extents, numerical overflow, and annotation
geometry extending outside the page are errors. Arrowheads, strokes, and text
retain physical paper sizes; short spans use outside arrows and a leader.
Automatic collision avoidance, diameter/radius and angular annotations,
tolerances, and certified drafting styles remain follow-up work.

## Demonstrations

The sharp 40 × 20 × 80mm tube uses width/height presets for its overall end and
side dimensions. Its isometric and section views come from the same native model.
The rounded profile with `outerRadius = 3`mm demonstrates the distinction between
a real 34.0mm `outer_top` feature, a 40.0mm closed native `outer_profile` span, and
an inferred overall width of 40.0mm. A section at Z=40 retains a 40.0mm side-view
height. Tests also exercise changed parameters, world placement, scale, invalid
references, unsupported curves, short spans, signed offsets, and page bounds.
The companion jscad-electronics tests inspect the native model/paths; these SVGs
inspect the rendered drawing annotations:

![Inferred overall tube dimensions](../tests/__snapshots__/named-edge-dimensions.snap.svg)

![Native rounded-tube feature dimensions](../tests/__snapshots__/view-extent-dimensions.snap.svg)

References: [Autodesk linear dimension guide](https://help.autodesk.com/cloudhelp/2025/ENU/AutoCAD-MAC-Core/files/GUID-42FD07E0-B6D8-4BCD-A621-EDDC94B8864B.htm)
and [FreeCAD TechDraw length dimensions](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/TechDraw_LengthDimension.md).
These provide conventional drafting terminology; this implementation does not
claim complete ISO/ASME drafting compliance.

The TSX-declared native features, reader, and four-view model snapshot are proposed in
[jscad-electronics #504](https://github.com/tscircuit/jscad-electronics/pull/504).

The `Custom name/reference` declarations and native collector are proposed in
[jscad-fiber #142](https://github.com/tscircuit/jscad-fiber/pull/142).
