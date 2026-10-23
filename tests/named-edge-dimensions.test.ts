import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { rectangularTubeDrawing } from "./fixtures/rectangular-tube-drawing"

test("upstream JSCAD preparation produces resolved dimension lines on a real stock-tube sheet", async () => {
  const fixture = rectangularTubeDrawing()
  const original = JSON.stringify(fixture.input)
  expect(fixture.dimensions.map((line) => line.text)).toEqual([
    "40.0",
    "20.0",
    "80.0",
  ])
  const svg = await convertCircuitJsonToDrawingSvg(fixture.input, {
    resolveScene: () => fixture.scene,
  })
  expect(svg.match(/data-drawing-dimension-line-id=/g)).toHaveLength(3)
  for (const text of ["40.0", "20.0", "80.0"])
    expect(svg).toContain(`${text}</text>`)
  expect(svg).not.toContain("data-measured-value")
  expect(svg).not.toContain("data-drawing-edge-name")
  expect(JSON.stringify(fixture.input)).toBe(original)
  const resized = rectangularTubeDrawing(60, 30, 4, 100)
  expect(resized.dimensions.map((line) => line.text)).toEqual([
    "60.0",
    "30.0",
    "100.0",
  ])
  const resizedSvg = await convertCircuitJsonToDrawingSvg(resized.input, {
    pixelsPerMm: 1,
    supersampling: 1,
    resolveScene: () => resized.scene,
  })
  for (const text of ["60.0", "30.0", "100.0"])
    expect(resizedSvg).toContain(`${text}</text>`)
  const outline = resized.readEdge("outer_top").points
  expect(
    Math.max(...outline.map((point) => point.x)) -
      Math.min(...outline.map((point) => point.x)),
  ).toBe(60)
  expect(outline.every((point) => point.z === 100)).toBe(true)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
