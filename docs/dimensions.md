# Named-edge linear dimensions

`drawing_dimension` annotates a `cad_named_edge` in a particular
`drawing_part_view`. The exporter adds vector extension lines, arrowheads and a
numeric label over the view's rendered geometry. Values come from geometry in
model mm; there is no independent value override that can drift from the model.

The proposed authoring form nests dimensions under their part view:

```tsx
<assembly.drawing.partview partRef=".stock" name="end" direction="z+"
  width="90mm" height="90mm">
  <assembly.drawing.dimension edgeRef="overall_width"
    orientation="horizontal" offset="10mm" precision={1} />
  <assembly.drawing.dimension edgeRef="overall_height"
    orientation="vertical" offset="10mm" />
  <assembly.drawing.dimension edgeRef="wall_thickness"
    orientation="vertical" offset="-50mm" />
</assembly.drawing.partview>
```

Props #953 defines this TSX intent. Core registration, name resolution, and Circuit
JSON emission are future integration work. This exporter consumes the resolved
records directly; it does not interpret TSX or guess which mesh edge was intended.

## Modelprinter references

The companion modelprinter proposal supplies analytic reference segments and
suggested view/dimension intents:

```ts
import { mp } from "@tscircuit/modelprinter"

const drawing = mp
  .string("rectangulartube_w40mm_h20mm_wall3mm_l80mm")
  .drawing()!
// drawing.namedEdges: overall_width, overall_height, overall_length, wall_thickness
// drawing.views: end/side directions and dimensions referring to those names
```

These are stable, authored reference segments. A reference can be an actual
straight feature edge or a nominal-envelope measurement datum for rounded parts.
They are not mesh indices, B-rep topology, or a promise of automatic topological
naming. Changing width from 40 to 60 updates endpoint coordinates while retaining
`overall_width` as the reference name.

Modelprinter points are model-local, right-handed CAD mm, +Z up. A future core
resolver transforms both endpoints through the part's placement into CAD world
coordinates, assigns a `cad_named_edge_id`, and resolves each dimension's
`edgeRef` within the view's selected part. It must reject an ambiguous reference.
The fixture's tube placement is identity; its model-local and world points agree.

```ts
{
  type: "cad_named_edge",
  cad_named_edge_id: "tube_width",
  cad_component_id: "cad_tube",
  name: "overall_width",
  start: { x: -20, y: 10, z: 0 },
  end: { x: 20, y: 10, z: 0 },
}
{
  type: "drawing_dimension",
  drawing_dimension_id: "end_width",
  drawing_part_view_id: "end",
  cad_named_edge_id: "tube_width",
  orientation: "horizontal",
  offset: 10,
  precision: 1,
}
```

The edge's `cad_component_id` must resolve to a CAD record carrying its
`source_component_id`. That source must belong to the part view's selected source
components/group. If both selection fields are present, both constraints apply.
The exporter rejects missing references, duplicate IDs, duplicate edge names on
one CAD part, and edges outside the selected geometry before invoking the scene
resolver. Named references do not modify or add mesh geometry.

## Measurement and layout

- `aligned` (default) labels the true 3D reference-segment length, even in an
  isometric view. Its line follows the projected segment.
- `horizontal` and `vertical` measure the segment's component along the view's
  orthonormal right/up directions in model mm, before drawing scale is applied.
- `offset` defaults to 8, in signed paper mm. Positive follows the left normal
  of the oriented dimension line. Horizontal endpoints are ordered left to right
  (positive above); vertical endpoints bottom to top (positive left). Aligned
  dimensions preserve the authored start-to-end direction. Zero is permitted.
- `precision` defaults to 1 and accepts integers 0–6. Labels use fixed decimal
  places and drawing units are mm.

The renderer projects endpoints using the exact camera returned by PoppyGL for
the raster, including auto-fit, explicit scale, sections and nonzero world
placement. It converts CAD +Z-up points to glTF +Y-up only at that boundary.
Dimension values are independent of raster resolution and model-to-paper scale.
Edges viewed end-on or with zero extent on the chosen axis are errors. Numerical
overflow and annotation geometry extending outside the sheet are rejected.

Arrowheads, line widths and text sizes remain physical paper sizes. Short spans
use outside arrows and a leader rather than squeezing text between their ends.
Offsets are authored layout choices: automatic dimension placement, collision
avoidance, diameter/radius, angle dimensions, tolerances, and standard-certified
dimension styles remain follow-up work.

The rectangular-tube snapshot shows a genuine open stock profile, side elevation,
isometric view, and dimensions generated from modelprinter metadata. A second
snapshot verifies identical 40.0 measurements at 1:1 and 1:2, and the tests verify
parameter changes, transformed points, true isometric lengths, selection errors,
short spans, signed/zero offsets, and finite page bounds.

References: [Autodesk linear dimension guide](https://help.autodesk.com/cloudhelp/2025/ENU/AutoCAD-MAC-Core/files/GUID-42FD07E0-B6D8-4BCD-A621-EDDC94B8864B.htm)
and [FreeCAD TechDraw length dimensions](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/TechDraw_LengthDimension.md).
These describe conventional dimension concepts; this implementation does not
claim complete ISO/ASME drafting compliance.
