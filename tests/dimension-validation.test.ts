import { expect, test } from "bun:test"
import "bun-match-svg"
import type { DrawingDocument } from "../lib"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { rectangularTubeDrawing } from "./fixtures/rectangular-tube-drawing"

test("resolved lines validate paper data and view associations without resolving model references", async () => {
  const fixture = rectangularTubeDrawing()
  const patch = (changes: object) =>
    fixture.input.map((record) =>
      record.type === "drawing_dimension_line"
        ? { ...record, ...changes }
        : record,
    )
  const invalid: DrawingDocument[] = [
    patch({ drawing_part_view_id: "missing" }),
    patch({ start: { x: NaN, y: 0 } }),
    patch({ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }),
    patch({ text: "" }),
    [...fixture.input, fixture.dimensions[0]!],
    [
      ...fixture.input,
      { type: "drawing_dimension", drawing_dimension_id: "obsolete" },
    ],
  ]
  let resolutions = 0
  for (const input of invalid) {
    const rejected = expect(
      convertCircuitJsonToDrawingSvg(input, {
        resolveScene: () => {
          resolutions++
          return fixture.scene
        },
      }),
    ).rejects
    if (input.some((record) => record.type === "drawing_dimension"))
      await rejected.toThrow("drawing_dimension_line")
    else await rejected.toThrow()
  }
  expect(resolutions).toBe(0)
  const first = fixture.dimensions[0]!
  const input = fixture.input.map((record) =>
    record === first
      ? {
          ...first,
          edge_ref_start: undefined,
          edge_ref_name: "opaque & unresolved model name",
        }
      : record,
  )
  const svg = await convertCircuitJsonToDrawingSvg(input, {
    resolveScene: () => fixture.scene,
    resolveModelEdges: () => {
      throw new Error("Labels are disabled; this reader must not be called")
    },
  })
  expect(svg).toContain("40.0</text>")
  expect(svg).not.toContain("opaque &amp; unresolved")
  expect(svg.match(/data-dimension-role="extension"/g)).toHaveLength(5)
  expect(svg.match(/data-drawing-dimension-line-id=/g)).toHaveLength(3)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
