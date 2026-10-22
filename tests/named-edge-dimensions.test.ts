import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { rectangularTubeDrawing } from "./fixtures/rectangular-tube-drawing"

test("modelprinter reference segments produce a dimensioned rectangular stock tube sheet", async () => {
  const fixture = rectangularTubeDrawing()
  const original = JSON.stringify(fixture.input)
  const svg = await convertCircuitJsonToDrawingSvg(fixture.input, {
    pixelsPerMm: 4,
    supersampling: 2,
    resolveScene: () => fixture.scene,
  })
  expect(svg.match(/data-drawing-dimension-id=/g)).toHaveLength(4)
  for (const value of [40, 20, 3, 80])
    expect(svg).toContain(`data-measured-value="${value}"`)
  expect(svg).toContain("40.0</text>")
  expect(svg).toContain("3.0</text>")
  expect(JSON.stringify(fixture.input)).toBe(original)
  const resized = rectangularTubeDrawing(60, 30, 4, 100)
  const resizedSvg = await convertCircuitJsonToDrawingSvg(resized.input, {
    pixelsPerMm: 1,
    supersampling: 1,
    resolveScene: () => resized.scene,
  })
  for (const value of [60, 30, 4, 100])
    expect(resizedSvg).toContain(`data-measured-value="${value}"`)
  expect(resized.metadata.namedEdges.map((edge) => edge.name)).toEqual(
    fixture.metadata.namedEdges.map((edge) => edge.name),
  )
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
