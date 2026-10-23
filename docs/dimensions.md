# Resolved paper dimension lines

The exporter renders `drawing_dimension_line` records. Each record contains the
finished dimension line in paper coordinates and the exact text to display.
Measuring native models, selecting features, converting units, formatting values,
and choosing layout belong to the producer, such as future core drawing support.

## Circuit JSON contract

```ts
{
  type: "drawing_dimension_line",
  drawing_dimension_line_id: "bore_width",
  drawing_part_view_id: "end",
  start: { x: -102, y: 52 },
  end: { x: -68, y: 52 },
  text: "34.0",
  name: "bore-width",
  edge_ref_start: { x: -102, y: 42 },
  edge_ref_end: { x: -68, y: 42 },
  edge_ref_name: "inner_top",
}
```

`start` and `end` are distinct, finite paper points. Their origin is page center;
+X points right, +Y points up, and units are mm. These are final arrow-line
positions, independent of the referenced view's center, scale or orientation.
`text` is required and displayed as supplied, including units, decimal places or
other producer-authored notation. The exporter escapes XML without modifying the
text. `name` is an optional stable annotation identity.

Each witness point is optional independently. `edge_ref_start` draws an extension
stroke toward `start`; `edge_ref_end` draws one toward `end`. A witness need not
be present merely because the other one is. Witness coordinates are also resolved
paper points, not native model geometry or edge definitions. The optional
`edge_ref_name` carries a producer-authored native feature name for labeling.

The record has no orientation, offset, precision, dimension value, model target,
or inferred-view flags. Tangent direction, arrowheads and readable text rotation
follow the provided endpoints. Fixed paper sizes preserve annotation weight
across view scales. Short spans use outside arrows and a leader. Missing views,
duplicate line IDs, invalid coordinates and annotations outside the page are
rejected. Changing a view does not silently move endpoints or recompute text.

## Native geometry belongs to the model reader

STEP, glTF and JSCAD readers retain their own native feature geometry and topology.
Circuit JSON does not define model edges as start/end pairs, vertex IDs, curves or
boundary representations. A producer reads the native geometry and emits only
the resulting dimension line and optional witness metadata.

The JSCAD proposal declares outlines where the model is constructed:

```tsx
<Subtract repair>
  <ExtrudeLinear height={80}
    topOutlineName="outer_top" bottomOutlineName="outer_bottom">
    <Polygon points={outerProfile} />
  </ExtrudeLinear>
  <ExtrudeLinear height={80}
    topOutlineName="inner_top" bottomOutlineName="inner_bottom">
    <Polygon points={innerProfile} />
  </ExtrudeLinear>
</Subtract>
```

These are complete closed cap outlines at Z=80 or Z=0. The model reader preserves
all their samples and placement. A 40 × 20 mm tube with 3 mm walls has a 34 mm
bore; that 34 mm measurement is the bore width, not a straight portion of a
rounded outside edge. The checked-in sheet prepares 40.0 outside width, 34.0 bore
width, 20.0 height and 80.0 length from the actual collected JSCAD solid/outlines.
Its views use explicit 1:1 paper scale and the shared indexed-mesh converter.

The preparation code lives in test fixtures, outside the exporter library. It
represents upstream work that core can eventually perform for TSX authoring such
as `<assembly.drawing.dimension edgeRef=".tube > .inner_top" />`. Higher-level
TSX helpers are not serialized as exporter measurement instructions.

## Optional edge-name labels

`showEdgeNames` defaults to false. Enabling it adds small gray labels and does
not change dimension endpoints or text. Without a reader callback, each unique
`edge_ref_name` is labeled near its available witness point(s), falling back to
the dimension-line midpoint when no witness is supplied.

An optional callback can enumerate every named native feature independently of
whether it has a dimension:

```ts
const svg = await convertCircuitJsonToDrawingSvg(input, {
  resolveScene: (view) => selectedScene(view),
  showEdgeNames: true,
  resolveModelEdges: (view) => selectedNativeFeatures(view).map((feature) => ({
    name: feature.name,
    points: feature.worldSamples,
    closed: feature.closed,
  })),
})
```

Runtime feature samples use CAD world mm with +Z up, matching the selected model's
placement. They are labeling inputs, never Circuit JSON topology. The exporter
uses the same camera as the raster to project their path midpoints, including
closed contours. Exact duplicate names are shown once per view, metadata provides
fallbacks for names missing from enumeration, and coincident cap names are stacked
readably. XML-sensitive names are escaped. When labels are disabled, the callback
is not invoked.

## Validation examples

Every test file has one test and one visual SVG snapshot. Resolved-line tests
cover horizontal, vertical, diagonal and reversed endpoint order; independently
optional witnesses; exact preformatted text; short spans; paper bounds; and
input immutability. Integration tests verify that changing geometry or view scale
does not modify supplied lines. A section example explicitly prepares a new 40.0
length for a tube cut at Z=40; retaining the original line deliberately retains
its original 80.0 text. The producer remains responsible for updating dimensions.

The feature-label test covers disabled callbacks, metadata fallbacks, XML escaping,
coincident names, and native labels when there are no dimension records.

Related proposals: [Circuit JSON #922](https://github.com/tscircuit/circuit-json/pull/922),
[props #953](https://github.com/tscircuit/props/pull/953), and
[jscad-electronics #504](https://github.com/tscircuit/jscad-electronics/pull/504).
