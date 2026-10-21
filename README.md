# circuit-json-to-drawing

Render proposed Circuit JSON `drawing` / `drawing_view` records into standard
engineering drawing artifacts with PoppyGL: orthographic black outlines, white
occluding surfaces, optional dashed hidden edges and hatched section cuts.

## Install

```sh
bun add github:tscircuit/circuit-json-to-drawing
```

This follows the [handbook bootstrapping guide](https://github.com/tscircuit/handbook/blob/main/guides/bootstrapping-repos.md):
source-only GitHub installation (`module: lib/index.ts`, `files: ["lib"]`), no
lockfile, and Bun test/typecheck/format workflows copied from `@tscircuit/plop`.
No build step or native rendering dependency is required by the public package.
The native SVG rasterizer is used only by the visual test matcher.

The dependencies currently pin preview builds of the proposed Circuit JSON
schemas and PoppyGL outline renderer. Replace these pins with released versions
once the corresponding PRs merge. The PoppyGL preview also includes the runtime
packaging fix in https://github.com/tscircuit/poppygl/pull/54.

## Render a sheet

```ts
import { convertCircuitJsonToDrawingSvg } from "circuit-json-to-drawing"

const circuitJson = [
  {
    type: "drawing",
    drawing_id: "drawing_housing",
    name: "Housing",
    width: 210,
    height: 150,
    model_glb_url: "https://example.com/housing.glb",
  },
  {
    type: "drawing_view",
    drawing_view_id: "view_plan",
    drawing_id: "drawing_housing",
    direction: "z_positive",
    center: { x: -48, y: 5 },
    width: 85,
    height: 90,
    show_hidden_edges: true,
  },
  {
    type: "drawing_view",
    drawing_view_id: "view_section",
    drawing_id: "drawing_housing",
    direction: "x_positive",
    center: { x: 48, y: 5 },
    width: 85,
    height: 90,
    section: { axis: "x", offset: 5, keep_side: "less", hatch_spacing: 1 },
  },
] as const

const svg = await convertCircuitJsonToDrawingSvg(circuitJson)
await Bun.write("housing.svg", svg)
```

Each sheet SVG embeds its view PNGs as data URIs and needs no remote assets after
conversion. SVG width/height use physical `mm`, so explicit scale survives printing.
These are raster model views inside an SVG sheet, not vector CAD/B-rep drawings.
A simple border, drawing title, per-view captions and scale labels are included.
Leave space below each viewport for its caption and 12mm at the bottom for the title
block. Viewport geometry outside the sheet is rejected.

## Artifacts and multiple sheets

```ts
import { convertCircuitJsonToDrawingArtifacts } from "circuit-json-to-drawing"

const artifacts = await convertCircuitJsonToDrawingArtifacts(circuitJson)
for (const artifact of artifacts) {
  // element is a proposed drawing_artifact Circuit JSON record.
  // content is SVG text for a sheet or Uint8Array PNG bytes for a view.
  await Bun.write(`${artifact.element.drawing_artifact_id}.${artifact.element.format}`, artifact.content)
}
```

The returned records contain deterministic IDs, drawing/view references, format,
data URI and (for PNG views) pixel dimensions. Callers may upload content and replace
`url` with the resulting asset URL. Regeneration ignores previous artifact content;
replace existing artifacts with the same IDs instead of appending duplicates.
Inputs and model draw calls are not mutated. A model URL is fetched once per sheet.

`convertCircuitJsonToDrawingSvg` requires one sheet or an explicit `drawingId`.
`convertCircuitJsonToDrawingArtifacts` renders all sheets by default, in document
order, or one selected `drawingId`. IDs must be unique and references must resolve.

## Geometry and coordinate contract

Drawing intent uses CAD world coordinates, mm with +Z up. Paper origin is the sheet
center, +X right/+Y up. Directions are `x_positive`, `x_negative`, `y_positive`,
`y_negative`, `z_positive`, `z_negative`, or `isometric`. The signed side names
where the camera sits; it looks toward the selected model's center. X/Y views use
+Z paper up; Z views use +Y paper up. Isometric observes from positive X/Y/Z.

PoppyGL scenes use glTF +Y-up coordinates in mm. Conversion is the rigid rotation
`(x, y, z) -> (x, z, -y)`. In particular, CAD Y section offsets are negated and
`keep_side` is reversed when mapped to glTF Z. X/Z section offsets retain their signs.
Hatch spacing defaults to 1 model mm. Cavities are preserved; open contours remain
uncapped. PoppyGL's current section builder caps each primitive independently.

`model_glb_url` must already contain exactly the drawing's selected geometry and
use glTF coordinates in mm. It can point to a GLB or self-contained glTF model.
The renderer does not guess source IDs from GLB node names or apply CAD transforms
twice. If the drawing selects source IDs instead of a pre-exported model, provide
`resolveScene(drawing, circuitJson)` to integrate your circuit-to-glTF pipeline.
That callback receives the source selection and full document and must return a
PoppyGL `GLTFScene` for exactly that selection. It is called once per sheet.
Raw PCB/footprint conversion is deliberately delegated to that existing pipeline.

```ts
const svg = await convertCircuitJsonToDrawingSvg(circuitJson, {
  resolveScene: async (drawing, elements) => {
    // Resolve drawing.source_group_id / source_component_ids, then export the
    // selected geometry through your circuit-json-to-gltf integration.
    return await loadSelectedScene(drawing, elements)
  },
})
```

TSX registration and emission of drawing records from `<assembly.drawing>` and
`<assembly.drawingview>` still require downstream core integration.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `drawingId` | all sheets | Select a sheet; required by the SVG convenience API when there are multiple |
| `pixelsPerMm` | 4 | Positive finite view raster resolution; does not change physical scale |
| `supersampling` | 2 | Positive integer antialiasing factor |
| `maxRasterPixels` | 16,000,000 | Maximum supersampled pixels per view; checked before model loading |
| `fetchImpl` | global fetch | Custom PoppyGL-compatible model/resource fetch |
| `resolveScene` | model URL loader | Supply an already-selected glTF scene instead of loading the drawing URL |

`drawing_view.scale` is the model-to-paper ratio: 0.5 means 1:2, 1 means 1:1.
Omission auto-fits with a margin. Explicit scale clips excess geometry instead of
refitting it. Sections and hatches follow model-to-paper scale. Every view uses
outline style; there is no style enum.

## Development

```sh
bun install
bun test
bun run typecheck
bun run format:check
```

There is exactly one test per test file and one visual SVG snapshot per test.
Tests cover real GLB loading, six axis directions, hidden-edge occlusion, transformed
section planes and cap areas, physical scale/viewport clipping, input validation,
multiple sheets, artifact regeneration and model caching per sheet. Fixtures use
small deterministic JSCAD meshes and the PoppyGL enclosure GLB fixture.

A runnable GLB example writes the sheet and PNG artifacts into `out/`:

```sh
bun examples/render-enclosure.ts https://example.com/housing.glb 5
```

Schema proposal: https://github.com/tscircuit/circuit-json/pull/918

Outline renderer: https://github.com/tscircuit/poppygl/pull/53
