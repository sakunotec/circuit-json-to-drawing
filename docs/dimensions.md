# Linear dimensions from model geometry

`drawing_dimension` annotates one `drawing_part_view` with a vector dimension
line, extension lines, arrowheads, and a numeric label. The measurement request
explicitly chooses an actual model-defined edge or an inferred view extent.
Values come from model geometry in mm. There is no independent numeric or text
override that can drift from the model.

## Authoring intent

Dimensions nest under the part view. The overall dimensions of a selected part
use explicit view presets:

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

To measure a particular feature, select a named edge actually defined by the
model. A scoped selector makes the model association explicit:

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

Choose exactly one of `edgeRef`, `widthOfView`, or `heightOfView` per dimension.
`widthOfView` and `heightOfView` are boolean presets. They are not named edges,
and an arbitrary name such as `overall_width` does not request inferred bounds.
Props #953 defines this intent. Core registration, selector resolution, and
Circuit JSON dimension emission remain future integration work. This exporter
consumes the resolved records directly and does not interpret TSX selectors.

## Modelprinter feature definitions

The companion modelprinter proposal exposes explicit analytic model edges and
suggested view/dimension intents:

```ts
import { mp } from "@tscircuit/modelprinter";

const sharp = mp
  .string("rectangulartube_w40mm_h20mm_wall3mm_l80mm_outerr0mm")
  .drawing()!;
// sharp.namedEdges: outer_top, outer_left, outer_right_longitudinal
// sharp.views: end widthOfView/heightOfView, side heightOfView

const rounded = mp
  .string("rectangulartube_w40mm_h20mm_wall3mm_l80mm_outerr3mm")
  .drawing()!;
// rounded outer_top: (-17, 10, 0) to (17, 10, 0), length 34 mm
// end-view widthOfView: 40 mm
```

The rounded profile's straight `outer_top` feature stops at the corner tangency
points. Its length is `40 - 2 × 3 = 34` mm, while the entire end profile remains
40 mm wide. No artificial envelope edge is published to make those values agree.
The explicit edge name remains stable as parameters change, with endpoints
recomputed by the model definition. These are analytic feature definitions,
independent of mesh vertex numbering, not automatic B-rep topological naming.

Modelprinter points are model-local, right-handed CAD mm, with +Z up. Eventual
core support must resolve the model-defined selector and transform both endpoints
as points through the same scale, rotation, and translation as the owning model.
It then assigns `cad_named_edge_id` and emits world-space points. The exporter
must not reapply the CAD model transform. The stock-tube fixtures use identity
placement, so their local and world points agree; projection tests separately
exercise transformed geometry.

## Circuit JSON records

Edge dimensions retain an actual named-edge association:

```ts
{
  type: "cad_named_edge",
  cad_named_edge_id: "tube_outer_top",
  cad_component_id: "cad_tube",
  name: "outer_top",
  start: { x: -17, y: 10, z: 0 },
  end: { x: 17, y: 10, z: 0 },
}
{
  type: "drawing_dimension",
  drawing_dimension_id: "end_top_feature",
  drawing_part_view_id: "end",
  measurement: "edge",
  cad_named_edge_id: "tube_outer_top",
  orientation: "horizontal",
  offset: 23,
  precision: 1,
}
```

Inferred extents reference only the part view:

```ts
{
  type: "drawing_dimension",
  drawing_dimension_id: "end_width",
  drawing_part_view_id: "end",
  measurement: "view_width",
  offset: 10,
  precision: 1,
}
```

`measurement` is `edge` (default), `view_width`, or `view_height`. Edge mode
requires `cad_named_edge_id`; view presets forbid it. Presets normalize orientation
to horizontal for width and vertical for height. A matching explicit orientation
is accepted; a conflicting one is rejected. They do not generate synthetic
`cad_named_edge` records.

For an edge dimension, the edge's `cad_component_id` must resolve to a CAD record
carrying its `source_component_id`. That source must belong to the part view's
selected source components/group. If both selection fields are present, both
constraints apply. The exporter rejects missing references, duplicate IDs,
duplicate edge names on one CAD part, and out-of-selection edges before invoking
the scene resolver. Named edges describe the model and add no mesh geometry.

## Measurement and layout

- `aligned` edge dimensions label the true 3D endpoint distance, including in an
  isometric view. Their dimension line follows the projected segment.
- `horizontal` and `vertical` edge dimensions measure the absolute component along
  the view's orthonormal camera right/up directions in model mm.
- `view_width` and `view_height` measure the extents of the selected rendered
  geometry after its model/world transforms, projected onto the camera right/up
  model axes. Section views use the retained cut geometry, not the uncut model.
  The paper viewport's width/height and fitted raster size are not measurements.
- `offset` defaults to 8 signed paper mm. Positive follows the left normal of the
  dimension line in paper +Y-up coordinates. Horizontal endpoints are ordered
  left-to-right (positive above); vertical endpoints bottom-to-top (positive
  left). Inferred presets start from the outer boundary on that side: width below
  for negative offsets, height to the right for negative offsets. Aligned edges
  preserve authored start-to-end order. Zero is permitted.
- `precision` defaults to 1 and accepts integer decimal places 0–6. Drawing
  measurement units are model mm.

The renderer uses the exact PoppyGL raster camera for annotation projection,
including auto-fit, explicit scale, section cuts, and nonzero world placement.
CAD +Z-up points are converted to glTF +Y-up at that boundary. Numeric measurements
remain in model mm when paper scale or raster resolution changes. A 40 mm extent
therefore still labels 40.0 at 1:1 or 1:2.

Edges viewed end-on and zero extents on the chosen axis are errors. Numerical
overflow and annotation geometry extending outside the sheet are rejected.
Arrowheads, line widths, and text sizes retain physical paper sizes. Short spans
use outside arrows and a leader. Offsets are authored layout choices; automatic
annotation placement, collision avoidance, diameter/radius, angular dimensions,
tolerances, and certified drafting styles remain follow-up work.

## Demonstrations

The sharp stock-tube sheet shows a real open 40 × 20 mm profile and 80 mm side
length, plus an isometric view. Its three overall dimensions are inferred view
presets and read 40.0, 20.0, and 80.0. None uses a named envelope edge.

The rounded-profile sheet uses `outerRadius = 3` mm. The actual `outer_top` edge
reads 34.0 while the end-view width preset reads 40.0. Sectioning the 80 mm tube
at Z=40 changes the retained side-view extent to 40.0. Additional tests cover
parameter changes, transformed geometry, independent model/paper scale, invalid
selection/measurement combinations, short spans, signed offsets, and page bounds.

References: [Autodesk linear dimension guide](https://help.autodesk.com/cloudhelp/2025/ENU/AutoCAD-MAC-Core/files/GUID-42FD07E0-B6D8-4BCD-A621-EDDC94B8864B.htm)
and [FreeCAD TechDraw length dimensions](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/TechDraw_LengthDimension.md).
These describe conventional linear-dimension concepts. This implementation does
not claim complete ISO/ASME drafting compliance.
