import { expect, test } from "bun:test"
import "bun-match-svg"
import {
  convertCircuitJsonToDrawingSvg,
  convertCircuitJsonToDrawingPages,
} from "../lib"
import { page, view } from "./fixtures/drawings"
import { cadScene } from "./fixtures/models"

test("invalid drawing references and allocation requests fail before resolving models", async () => {
  let calls = 0
  const options = {
    resolveScene: () => {
      calls++
      return cadScene()
    },
  }
  const valid = [page(), view()]
  for (const input of [
    [page(), page(), view()],
    [page(), view(), view()],
    [page(), { ...view(), drawing_page_id: "missing" }],
    [page(), { ...view(), width: 999 }],
    [page(), { ...view(), scale: 0 }],
  ])
    await expect(
      convertCircuitJsonToDrawingPages(input, options),
    ).rejects.toThrow()
  await expect(
    convertCircuitJsonToDrawingPages(valid, {
      ...options,
      maxRasterPixels: 10,
    }),
  ).rejects.toThrow("maxRasterPixels")
  await expect(
    convertCircuitJsonToDrawingPages(valid, {
      ...options,
      pixelsPerMm: Infinity,
    }),
  ).rejects.toThrow("pixelsPerMm")
  await expect(
    convertCircuitJsonToDrawingPages(valid, {
      ...options,
      drawingPageId: "missing",
    }),
  ).rejects.toThrow("Drawing page not found")
  await expect(convertCircuitJsonToDrawingPages(valid)).rejects.toThrow(
    "resolveScene",
  )
  expect(calls).toBe(0)
  await expect(
    convertCircuitJsonToDrawingSvg(valid, options),
  ).toMatchSvgSnapshot(import.meta.path)
  expect(calls).toBe(1)
})
