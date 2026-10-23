import { expect, test } from "bun:test"
import "bun-match-svg"
import { createOutlineSection } from "poppygl"
import { convertCircuitJsonToDrawingSvg, sectionToGltf } from "../lib"
import {
  fixtureCamera,
  prepareDimensionLine,
  scenePoints,
} from "./fixtures/prepare-dimension-line"
import { rectangularTubeDrawing } from "./fixtures/rectangular-tube-drawing"

test("upstream resolved outlines distinguish bore and outside width and explicitly update section measurements", async () => {
  const fixture = rectangularTubeDrawing(40, 20, 3, 80, 3)
  const bore = fixture.readEdge("inner_top"),
    outside = fixture.readEdge("outer_top")
  expect(bore.closed).toBe(true)
  expect(outside.closed).toBe(true)
  expect(outside.points.length).toBeGreaterThan(8)
  expect(bore.points.every((point) => point.z === 80)).toBe(true)
  expect(
    fixture.readEdge("outer_bottom").points.every((point) => point.z === 0),
  ).toBe(true)
  const boreLine = fixture.prepareLine("end", bore.points, {
    id: "bore_width",
    axis: "horizontal",
    offset: 10,
    edgeName: "inner_top",
    name: "Bore width",
  })
  const outsideLine = fixture.prepareLine("end", outside.points, {
    id: "outside_width",
    axis: "horizontal",
    offset: 23,
    edgeName: "outer_top",
    name: "Outside width",
  })
  expect(boreLine.text).toBe("34.0")
  expect(outsideLine.text).toBe("40.0")
  const input = [
    ...fixture.input.filter(
      (record) =>
        !(
          record.type === "drawing_dimension_line" &&
          "drawing_dimension_line_id" in record &&
          record.drawing_dimension_line_id === "end_width"
        ),
    ),
    boreLine,
    outsideLine,
  ]
  const original = JSON.stringify(input)
  const render = (records = input) =>
    convertCircuitJsonToDrawingSvg(records, {
      pixelsPerMm: 2,
      supersampling: 2,
      resolveScene: () => fixture.scene,
    })
  const svg = await render()
  expect(svg).toContain("34.0</text>")
  expect(svg).toContain("40.0</text>")
  const side = fixture.views.find(
    (view) => view.drawing_part_view_id === "side",
  )!
  const sectionedView = {
    ...side,
    section: { axis: "z" as const, offset: 40, keep_side: "less" as const },
  }
  const sectioned = input.map((record) =>
    record === side ? sectionedView : record,
  )
  const withoutNewLine = await render(sectioned)
  expect(withoutNewLine).toContain("80.0</text>")
  const cut = {
    ...fixture.scene,
    drawCalls: createOutlineSection(
      fixture.scene.drawCalls,
      sectionToGltf(sectionedView.section),
    ).drawCalls,
  }
  const updatedLine = prepareDimensionLine(
    sectionedView,
    fixtureCamera(sectionedView, fixture.scene),
    scenePoints(cut),
    { id: "side_length", axis: "vertical", offset: -10 },
  )
  expect(updatedLine.text).toBe("40.0")
  const updated = sectioned.map((record) =>
    record.type === "drawing_dimension_line" &&
    "drawing_dimension_line_id" in record &&
    record.drawing_dimension_line_id === "side_length"
      ? updatedLine
      : record,
  )
  const updatedSvg = await render(updated)
  expect(updatedSvg).not.toContain("80.0</text>")
  expect(updatedSvg).toContain("40.0</text>")
  expect(JSON.stringify(input)).toBe(original)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
