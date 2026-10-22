import { expect, test } from "bun:test"
import "bun-match-svg"
import {
  convertCircuitJsonToDrawingSvg,
  getViewOrientation,
  sectionToGltf,
} from "../lib"
import { asymmetricScene } from "./fixtures/models"
import { view } from "./fixtures/drawings"
import type { DrawingPartViewDirection } from "circuit-json"

test("six orthographic CAD directions preserve handedness and paper-up conventions", async () => {
  const directions: DrawingPartViewDirection[] = [
    "x_positive",
    "x_negative",
    "y_positive",
    "y_negative",
    "z_positive",
    "z_negative",
  ]
  const vectors: [number, number, number][] = [
    [1, 0, -0],
    [-1, 0, -0],
    [0, 0, -1],
    [0, 0, 1],
    [0, 1, -0],
    [0, -1, -0],
  ]
  directions.forEach((dir, i) =>
    expect(getViewOrientation(dir).vector).toEqual(vectors[i]!),
  )
  expect(getViewOrientation("z_positive").up).toBe("z-")
  expect(sectionToGltf({ axis: "x", offset: 13, keep_side: "less" })).toEqual({
    axis: "x",
    offset: 13,
    keepSide: "less",
    hatchSpacing: 1,
  })
  expect(sectionToGltf({ axis: "z", offset: 5, keep_side: "greater" })).toEqual(
    { axis: "y", offset: 5, keepSide: "greater", hatchSpacing: 1 },
  )
  const svg = await convertCircuitJsonToDrawingSvg(
    [
      {
        type: "drawing_page",
        drawing_page_id: "drawing_1",
        name: "AXIS VIEWS · CAD +Z UP",
        width: 240,
        height: 180,
      },
      ...directions.map((direction, i) => ({
        ...view(`view_${i}`, "drawing_1", direction),
        name: direction,
        center: { x: ((i % 3) - 1) * 75, y: i < 3 ? 40 : -30 },
        width: 65,
        height: 60,
      })),
    ],
    { resolveScene: () => asymmetricScene(), pixelsPerMm: 3 },
  )
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
