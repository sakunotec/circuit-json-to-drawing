import { expect, test } from "bun:test"
import "bun-match-svg"
import type { DrawingPartView } from "circuit-json"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { rectangularTubeDrawing } from "./fixtures/rectangular-tube-drawing"
import {
  fixtureCamera,
  prepareDimensionLine,
} from "./fixtures/prepare-dimension-line"

test("resolved paper endpoints remain fixed when the part-view position and model scale change", async () => {
  const fixture = rectangularTubeDrawing()
  const views: DrawingPartView[] = [1, 0.5].map((scale, index) => ({
    ...fixture.views[0]!,
    drawing_part_view_id: `scale_${scale}`,
    width: 90,
    height: 65,
    scale,
    center: { x: index ? 55 : -55, y: 25 },
  }))
  const lines = views.map((view, index) =>
    prepareDimensionLine(
      view,
      fixtureCamera(view, fixture.scene),
      fixture.readEdge("outer_top").points,
      {
        id: `width_${index}`,
        axis: "horizontal",
        offset: 10,
        edgeName: "outer_top",
      },
    ),
  )
  expect(lines.map((line) => line.text)).toEqual(["40.0", "40.0"])
  expect(lines[0]!.end.x - lines[0]!.start.x).toBeCloseTo(40, 5)
  expect(lines[1]!.end.x - lines[1]!.start.x).toBeCloseTo(20, 5)
  const records = fixture.input.filter(
    (record) =>
      record.type !== "drawing_part_view" &&
      record.type !== "drawing_dimension_line",
  )
  const svg = await convertCircuitJsonToDrawingSvg(
    [...records, ...views, ...lines],
    { resolveScene: () => fixture.scene },
  )
  const moved = views.map((view) => ({
    ...view,
    scale: 2,
    center: { ...view.center, x: view.center.x + 8 },
  }))
  const movedSvg = await convertCircuitJsonToDrawingSvg(
    [...records, ...moved, ...lines],
    { resolveScene: () => fixture.scene },
  )
  expect(movedSvg).not.toBe(svg)
  for (const line of lines) {
    const path = `data-dimension-role="dimension" d="M ${fixture.page.width / 2 + line.start.x} ${fixture.page.height / 2 - line.start.y} L ${fixture.page.width / 2 + line.end.x} ${fixture.page.height / 2 - line.end.y}"`
    expect(svg).toContain(path)
    expect(movedSvg).toContain(path)
  }
  expect(svg).toContain("1:2")
  expect(movedSvg).toContain("2:1")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
