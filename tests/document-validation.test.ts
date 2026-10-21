import { expect, test } from "bun:test"
import "bun-match-svg"
import {
  convertCircuitJsonToDrawingSvg,
  convertCircuitJsonToDrawingArtifacts,
} from "../lib"
import { sheet, view } from "./fixtures/drawings"
import { cadScene } from "./fixtures/models"

test("invalid drawing references and allocation requests fail before resolving models", async () => {
  let calls = 0
  const options = {
    resolveScene: () => {
      calls++
      return cadScene()
    },
  }
  const valid = [sheet(), view()]
  for (const input of [
    [sheet(), sheet(), view()],
    [sheet(), view(), view()],
    [sheet(), { ...view(), drawing_id: "missing" }],
    [sheet(), { ...view(), width: 999 }],
    [sheet(), { ...view(), scale: 0 }],
  ])
    await expect(
      convertCircuitJsonToDrawingArtifacts(input, options),
    ).rejects.toThrow()
  await expect(
    convertCircuitJsonToDrawingArtifacts(valid, {
      ...options,
      maxRasterPixels: 10,
    }),
  ).rejects.toThrow("maxRasterPixels")
  await expect(
    convertCircuitJsonToDrawingArtifacts(valid, {
      ...options,
      pixelsPerMm: Infinity,
    }),
  ).rejects.toThrow("pixelsPerMm")
  await expect(
    convertCircuitJsonToDrawingArtifacts(valid, {
      ...options,
      drawingId: "missing",
    }),
  ).rejects.toThrow("Drawing not found")
  await expect(convertCircuitJsonToDrawingArtifacts(valid)).rejects.toThrow(
    "model_glb_url",
  )
  expect(calls).toBe(0)
  await expect(
    convertCircuitJsonToDrawingSvg(valid, options),
  ).toMatchSvgSnapshot(import.meta.path)
  expect(calls).toBe(1)
})
