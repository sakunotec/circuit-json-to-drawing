import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { rectangularTubeDrawing } from "./fixtures/rectangular-tube-drawing"

test("modelprinter view presets produce a dimensioned rectangular stock tube sheet", async () => {
  const fixture = rectangularTubeDrawing()
  const original = JSON.stringify(fixture.input)
  const svg = await convertCircuitJsonToDrawingSvg(fixture.input, {
    pixelsPerMm: 4,
    supersampling: 2,
    resolveScene: () => fixture.scene,
  })
  expect(svg.match(/data-drawing-dimension-id=/g)).toHaveLength(3)
  const measured = (drawing: string) =>
    [...drawing.matchAll(/data-measured-value="([^"]+)"/g)].map((match) =>
      Number(match[1]),
    )
  measured(svg).forEach((value, index) =>
    expect(value).toBeCloseTo([40, 20, 80][index]!, 3),
  )
  expect(svg).toContain("40.0</text>")
  expect(
    fixture.dimensions.every((dimension) => !dimension.cad_named_edge_id),
  ).toBe(true)
  expect(JSON.stringify(fixture.input)).toBe(original)
  const resized = rectangularTubeDrawing(60, 30, 4, 100)
  const resizedSvg = await convertCircuitJsonToDrawingSvg(resized.input, {
    pixelsPerMm: 1,
    supersampling: 1,
    resolveScene: () => resized.scene,
  })
  measured(resizedSvg).forEach((value, index) =>
    expect(value).toBeCloseTo([60, 30, 100][index]!, 3),
  )
  expect(resized.metadata.namedEdges.map((edge) => edge.name)).toEqual(
    fixture.metadata.namedEdges.map((edge) => edge.name),
  )
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
