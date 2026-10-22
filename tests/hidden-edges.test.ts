import { expect, test } from "bun:test"
import "bun-match-svg"
import { viewImages } from "./fixtures/svg-views"
import { convertCircuitJsonToDrawingPages } from "../lib"
import { page, twoViews } from "./fixtures/drawings"
import { cadScene } from "./fixtures/models"

test("visible outline and dashed hidden edges use the same opaque model", async () => {
  const scene = cadScene()
  const pages = await convertCircuitJsonToDrawingPages(
    [page(), ...twoViews()],
    { resolveScene: () => scene },
  )
  const images = viewImages(pages[0]!.svg)
  const ink = (data: ArrayLike<number>) => {
    let sum = 0
    for (let i = 0; i < data.length; i += 4) sum += 255 - data[i]!
    return sum
  }
  expect(ink(images[0]!.data)).toBeGreaterThan(20000)
  expect(ink(images[1]!.data)).toBeGreaterThan(ink(images[0]!.data) + 2000)
  expect(scene.drawCalls[0]!.material.baseColorFactor).toEqual([
    0.1, 0.4, 0.8, 1,
  ])
  await expect(pages[0]!.svg).toMatchSvgSnapshot(import.meta.path)
})
