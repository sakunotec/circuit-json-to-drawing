import { mkdir } from "node:fs/promises"
import { convertCircuitJsonToDrawingArtifacts } from "../lib"
import type { DrawingDocument } from "../lib"

const modelUrl = Bun.argv[2]
if (!modelUrl)
  throw new Error(
    "Usage: bun examples/render-enclosure.ts <model.glb URL> [section X offset in mm]",
  )
const offset = Number(Bun.argv[3] ?? 0)
const input: DrawingDocument = [
  {
    type: "drawing",
    drawing_id: "housing",
    name: "Housing",
    width: 210,
    height: 150,
    model_glb_url: modelUrl,
  },
  {
    type: "drawing_view",
    drawing_view_id: "isometric",
    drawing_id: "housing",
    name: "ISOMETRIC",
    direction: "isometric",
    center: { x: -48, y: 5 },
    width: 85,
    height: 90,
    show_hidden_edges: true,
  },
  {
    type: "drawing_view",
    drawing_view_id: "section",
    drawing_id: "housing",
    name: "SECTION A-A",
    direction: "x_positive",
    center: { x: 48, y: 5 },
    width: 85,
    height: 90,
    section: { axis: "x", offset, keep_side: "less", hatch_spacing: 1 },
  },
]
const artifacts = await convertCircuitJsonToDrawingArtifacts(input)
await mkdir("out", { recursive: true })
for (const { element, content } of artifacts) {
  const path = `out/${element.drawing_artifact_id}.${element.format}`
  await Bun.write(path, content)
  console.log(path)
}
