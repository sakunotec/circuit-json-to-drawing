import { expect, test } from "bun:test"
import "bun-match-svg"
import { viewImages } from "./fixtures/svg-views"
import { convertCircuitJsonToDrawingPages } from "../lib"
import { cadScene } from "./fixtures/models"
import { view } from "./fixtures/drawings"

test("physical scale changes projected size and clips rather than refits oversized geometry", async () => {
  const pages = await convertCircuitJsonToDrawingPages(
    [
      {
        type: "drawing_page",
        drawing_page_id: "drawing_1",
        name: "20 mm CUBE · PHYSICAL SCALE",
        width: 210,
        height: 110,
      },
      ...[0.5, 1, 3].map((scale, i) => ({
        ...view(`scale_${i}`, "drawing_1", "z_positive"),
        name: ["HALF SIZE", "FULL SIZE", "CLIPPED"][i],
        center: { x: (i - 1) * 65, y: 5 },
        width: 55,
        height: 55,
        scale,
      })),
    ],
    { resolveScene: () => cadScene() },
  )
  const pngs = viewImages(pages[0]!.svg)
  const span = (image: (typeof pngs)[number]) => {
    let min = Infinity,
      max = -Infinity
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++)
        if (image.data[(y * image.width + x) * 4]! < 128) {
          min = Math.min(min, x)
          max = Math.max(max, x)
        }
    return max - min + 1
  }
  expect(span(pngs[0]!)).toBeCloseTo(40, 0)
  expect(span(pngs[1]!)).toBeCloseTo(80, 0)
  expect(span(pngs[2]!)).toBe(-Infinity)
  expect(pages[0]!.svg).toContain('width="210mm" height="110mm"')
  await expect(pages[0]!.svg).toMatchSvgSnapshot(import.meta.path)
})
