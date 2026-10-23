# circuit-json-to-drawing

Render configured Circuit JSON drawing pages and part views with PoppyGL outline
rendering: orthographic black edges, white occluding surfaces, optional dashed
hidden edges and hatched section cuts.

## Drawing configuration

`drawing_page` describes paper layout for `<assembly.drawing.page>`.
`drawing_part_view` describes a view of selected assembly geometry for
`<assembly.drawing.partview>`. Circuit JSON contains configuration only: no image
URLs, embedded images, or generated output elements.

```ts
import { convertCircuitJsonToDrawingSvg } from "@tscircuit/circuit-json-to-drawing";

const circuitJson = [
  {
    type: "drawing_page",
    drawing_page_id: "page_housing",
    name: "Housing and bracket",
    width: 210,
    height: 150,
  },
  {
    type: "drawing_part_view",
    drawing_part_view_id: "view_housing",
    drawing_page_id: "page_housing",
    source_component_ids: ["source_housing"],
    direction: "z_positive",
    center: { x: -48, y: 5 },
    width: 85,
    height: 90,
    show_hidden_edges: true,
  },
  {
    type: "drawing_part_view",
    drawing_part_view_id: "view_bracket_section",
    drawing_page_id: "page_housing",
    source_component_ids: ["source_bracket"],
    direction: "x_positive",
    center: { x: 48, y: 5 },
    width: 85,
    height: 90,
    section: { axis: "x", offset: 5, keep_side: "less", hatch_spacing: 1 },
  },
] as const;

const svg = await convertCircuitJsonToDrawingSvg(circuitJson, {
  resolveScene: async (partView, elements) => {
    // Use your circuit-to-glTF pipeline to resolve the geometry selected by
    // partView.source_group_id / source_component_ids from elements.
    return getSelectedPartScene(partView, elements);
  },
});
await Bun.write("drawing.svg", svg);
```

`resolveScene` is called for each part view and returns a PoppyGL `GLTFScene` in
glTF coordinates, +Y up, units mm. Different views on one page can select different
parts or assemblies. Model loading, source selection and caching are owned by the
caller. Drawing configuration does not reference rendered assets or model images.
Without source selectors, a view represents the entire assembly. TSX target
selectors must be resolved to source IDs by core; core emission is follow-up work.

## Multiple pages

```ts
import { convertCircuitJsonToDrawingPages } from "@tscircuit/circuit-json-to-drawing";

const pages = await convertCircuitJsonToDrawingPages(circuitJson, {
  resolveScene,
});
for (const page of pages) {
  await Bun.write(`${page.drawingPageId}.svg`, page.svg);
}
```

The return value is exporter output (`{ drawingPageId, svg }`), never Circuit JSON
records. SVG pages contain embedded rasterized geometry views and require no
external assets after rendering. This implementation is a raster illustration in
an SVG page, not vector CAD/B-rep output. Drawing inputs and scene meshes are not
mutated. Repeated conversion produces the same pages from the same input/scenes.

The single-page SVG API requires one page, or `drawingPageId` to select one.
The pages API renders all pages in document order by default. Duplicate IDs,
dangling page references and viewports outside their pages are rejected.

## Coordinates and scale

Paper dimensions/coordinates are mm. Origin is page center, +X right/+Y up.
CAD geometry uses right-handed mm with +Z up. Directions use snake_case:
`x_positive`, `x_negative`, `y_positive`, `y_negative`, `z_positive`, `z_negative`,
and `isometric`. The camera sits on the named axis side, looking toward the part
center. X/Y views have +Z paper up; Z views have +Y paper up. Isometric observes
from positive X/Y/Z.

The boundary rotation from CAD to glTF is `(x, y, z) -> (x, z, -y)`.
CAD Y section offsets are negated and the retained side is reversed on glTF Z.
CAD X/Z offsets retain their signs. Hatch spacing defaults to 1 model mm.
Cavities stay empty; open contours are uncapped. PoppyGL caps primitives independently.

`scale` is the model-to-paper ratio: 0.5 is 1:2. Omission auto-fits with a margin.
Explicit scale clips excess geometry instead of refitting it. Physical SVG `mm`
dimensions preserve scale when printed. Hidden edges default to omitted. There
is no style enum. Leave caption space below viewports and 12mm at page bottom
for the title block.

## Options

| Option             | Default                      | Meaning                                                                                                   |
| ------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `drawingPageId`    | all pages                    | Select a configured page                                                                                  |
| `pixelsPerMm`      | 4                            | Positive finite view raster resolution; does not change physical scale                                    |
| `supersampling`    | 2                            | Positive integer antialiasing factor                                                                      |
| `maxRasterPixels`  | 16,000,000                   | Supersampled pixel limit per view, checked before scene resolution                                        |
| `resolveScene`     | required to render           | Resolve configured part geometry into a PoppyGL scene                                                     |
| `showEdgeNames` | `false` | Show small gray native feature names; dimension lines are unaffected |
| `resolveModelEdges` | optional | Enumerate named model features for labels when `showEdgeNames` is enabled |

## Install and development

```sh
bun add github:tscircuit/circuit-json-to-drawing
bun install
bun test
bun run typecheck
bun run format:check
bun examples/render-page.ts drawing.svg
```

Follows the handbook bootstrap: source-only GitHub installation (`module:
lib/index.ts`, `files: ["lib"]`), disabled/ignored lockfile, and plop Bun
check workflows. Public imports have no native rasterizer dependency; visual test
rasterization is dev-only. Preview dependency pins are temporary until upstream
schema and packaging PRs are released.

Test files contain one test and one visual SVG snapshot each. They cover
caller-supplied GLB geometry without drawing image fields, independent part
selections, multiple pages, six axis directions, hidden edges, section planes,
physical scale/clipping, dimensions and configuration validation.

Schema: https://github.com/tscircuit/circuit-json/pull/918

TSX props: https://github.com/tscircuit/props/pull/951

PoppyGL runtime dependency fix: https://github.com/tscircuit/poppygl/pull/54

## Standard references

Named sheet sizes use `iso_a0`–`iso_a4` and `ansi_a`–`ansi_e`, with `landscape` (default) or `portrait` orientation. Custom pages retain explicit width and height. Dimensions are always mm; ANSI inch dimensions are converted exactly using 25.4 mm/in (ANSI A is 279.4 × 215.9 mm in landscape).

- [ISO 5457:1999](https://www.iso.org/standard/29017.html): drawing-sheet sizes and layout.
- [ASME Y14.1](https://www.asme.org/codes-standards/find-codes-standards/drawing-sheet-size-and-format): metric and decimal-inch drawing sheets.
- [Autodesk Fusion sheet-size reference](https://help.autodesk.com/cloudhelp/ENU/Fusion-Drawing/files/DWG-REF-SHEET-SIZE.htm): interoperable ISO A0–A4 and ANSI A–E dimensions.
- [ISO 7200:2004](https://www.iso.org/standard/35446.html): title-block and document-header data fields.

These references guide sizes and metadata terminology. This proposal does not claim complete ISO/ASME template compliance or prescribe a projection method. Sheet orientation does not rotate model views.

A `drawing_page` retains resolved numeric `width`/`height` and optional `page_size`/`orientation`; supplied dimensions must match the named size. `getDrawingPageDimensions("iso_a4", "landscape")` returns `{width: 297, height: 210}`. Omitting page_size preserves custom-page compatibility; orientation without page_size is rejected.

A separate optional `drawing_page_title_block` references `drawing_page_id` and has its own `drawing_page_title_block_id`. It requires `title`; optional fields are `legal_owner`, `identification_number`, `revision_index`, `date_of_issue`, `creator`, `approval_person`, `sheet_number`, and `number_of_sheets`. No images or generated assets are stored in it. Dates are caller-authored strings. Sheet numbers/counts are positive integers; a supplied number cannot exceed its total.

The converter renders at most one explicit title block per page, 180 × 40 mm, inset 5 mm from the bottom-right edge. It validates duplicate IDs, dangling page references and a minimum page size of 190 × 50 mm before resolving geometry. No title block is invented when the element is absent. Position part views above this reserved region to avoid overlap. The layout is a renderer convention, not a standard-mandated template; per-view scales remain in view captions.

## Install from jscdn

```sh
bun add -D https://jscdn.tscircuit.com/@tscircuit/circuit-json-to-drawing/0.0.2.tgz
```

```ts
import { convertCircuitJsonToDrawingSvg } from "@tscircuit/circuit-json-to-drawing";
```

Releases publish the source-only package to GitHub Packages; jscdn serves the
versioned tarballs without requiring consumer credentials. The release workflow
runs tests and typechecking before publishing, and serializes releases to avoid
version collisions. Versions are bumped explicitly in package.json; the workflow
does not write repository contents or create version commits. No build or native runtime dependency is required.

## Resolved dimension lines

`drawing_dimension_line` contains the final paper-space endpoints and preformatted
text to render. The producer measures native geometry and chooses placement before
exporting Circuit JSON. The exporter draws exactly those positions and text:

```ts
{
  type: "drawing_dimension_line",
  drawing_dimension_line_id: "outside_width",
  drawing_part_view_id: "end",
  start: { x: -105, y: 55 },
  end: { x: -65, y: 55 },
  text: "40.0",
  edge_ref_start: { x: -105, y: 45 },
  edge_ref_end: { x: -65, y: 45 },
  edge_ref_name: "outer_top",
}
```

All line and witness coordinates are paper mm from page center, +X right and +Y
up. Each witness is optional independently. There are no orientation, offset,
precision, model targets or inferred-view flags on this record. Arrow direction
and readable text rotation follow the supplied line. Changing a part view does
not move or remeasure already resolved annotations.

Use `showEdgeNames: true` for small gray feature-name labels. Without a model
reader, labels use each line's `edge_ref_name` near its witness midpoint (or its
line midpoint). Optional `resolveModelEdges(view, input)` enumerates all named
native features, even without dimension records. It returns `{name, points,
closed}` runtime samples in CAD world mm, +Z up. The exporter projects these
labels with the actual raster camera and stacks coincident names. The callback
is never called when labels are disabled.

[Resolved-line coordinates, optional witnesses and native readers](docs/dimensions.md)
explains the producer/exporter boundary. The real JSCAD tube examples calculate
measurements upstream: 40 mm outside width and 34 mm bore width, using closed
extrusion outlines named `outer_top` and `inner_top`. Native geometry and topology
remain with STEP/glTF/JSCAD readers, outside Circuit JSON.

![Resolved dimension lines on a rectangular tube](tests/__snapshots__/named-edge-dimensions.snap.svg)

![Bore width and outside width](tests/__snapshots__/view-extent-dimensions.snap.svg)

This proposal consumes the schema preview from
[Circuit JSON #922](https://github.com/tscircuit/circuit-json/pull/922) and native
JSCAD drawing fixtures from
[jscad-electronics #504](https://github.com/tscircuit/jscad-electronics/pull/504).
[Props #953](https://github.com/tscircuit/props/pull/953) defines the higher-level
TSX authoring intent; eventual core support must resolve it into paper lines.
