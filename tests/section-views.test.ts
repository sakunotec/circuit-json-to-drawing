import { expect, test } from "bun:test"
import "bun-match-svg"
import { createOutlineSection } from "poppygl"
import { convertCircuitJsonToDrawingSvg, sectionToGltf } from "../lib"
import { sheet, view } from "./fixtures/drawings"
import { hollowTubeScene } from "./fixtures/models"

test("off-origin CAD Y sections flip glTF offsets and retained sides and hatch the cavity walls", async () => {
  const scene = hollowTubeScene()
  const plane = {
    axis: "y" as const,
    offset: -7,
    keep_side: "less" as const,
    hatch_spacing: 1.5,
  }
  expect(sectionToGltf(plane)).toEqual({
    axis: "z",
    offset: 7,
    keepSide: "greater",
    hatchSpacing: 1.5,
  })
  const cut = createOutlineSection(scene.drawCalls, sectionToGltf(plane))
  expect(cut.openChains).toBe(0)
  for (const dc of cut.drawCalls)
    for (let i = 2; i < dc.positions.length; i += 3)
      expect(dc.positions[i]!).toBeGreaterThanOrEqual(7 - 1e-5)
  let area = 0
  for (const dc of cut.drawCalls.filter((dc) => dc.outlineSectionCap))
    for (let i = 0; i < dc.positions.length; i += 9) {
      const p = dc.positions.subarray(i, i + 9)
      area +=
        Math.abs(
          (p[3]! - p[0]!) * (p[7]! - p[1]!) - (p[4]! - p[1]!) * (p[6]! - p[0]!),
        ) / 2
    }
  expect(area).toBeCloseTo(240, 3)
  const svg = await convertCircuitJsonToDrawingSvg(
    [
      sheet(),
      {
        ...view("section_a", "drawing_1", "y_positive"),
        center: { x: -48, y: 5 },
        width: 85,
        height: 95,
        name: "A-A · Y <= -7",
        section: plane,
      },
      {
        ...view("section_b", "drawing_1", "y_negative"),
        center: { x: 48, y: 5 },
        width: 85,
        height: 95,
        name: "B-B · Y >= -7",
        section: { ...plane, keep_side: "greater" },
      },
    ],
    { resolveScene: () => scene },
  )
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
