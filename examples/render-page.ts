import { convertCircuitJsonToDrawingSvg } from "../lib"
import type { GLTFScene } from "poppygl"

// Example geometry supplied by the application, outside drawing configuration.
const scene: GLTFScene = {
  gltf: { asset: { version: "2.0" } },
  drawCalls: [
    {
      positions: new Float32Array([
        -10, -5, -7, 10, -5, -7, 10, 5, -7, -10, 5, -7, -10, -5, 7, 10, -5, 7,
        10, 5, 7, -10, 5, 7,
      ]),
      indices: new Uint32Array([
        4, 5, 6, 4, 6, 7, 1, 0, 3, 1, 3, 2, 0, 4, 7, 0, 7, 3, 5, 1, 2, 5, 2, 6,
        7, 6, 2, 7, 2, 3, 0, 1, 5, 0, 5, 4,
      ]),
      normals: null,
      uvs: null,
      model: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
      material: { baseColorFactor: [1, 1, 1, 1], baseColorTexture: null },
    },
  ],
}
const svg = await convertCircuitJsonToDrawingSvg(
  [
    {
      type: "drawing_page",
      drawing_page_id: "page_1",
      name: "Part configuration example",
      width: 150,
      height: 100,
    },
    {
      type: "drawing_part_view",
      drawing_part_view_id: "part_view_1",
      drawing_page_id: "page_1",
      source_component_ids: ["part_1"],
      direction: "isometric",
      center: { x: 0, y: 5 },
      width: 100,
      height: 65,
      show_hidden_edges: true,
    },
  ],
  { resolveScene: () => scene },
)
const path = Bun.argv[2] ?? "drawing.svg"
await Bun.write(path, svg)
console.log(path)
