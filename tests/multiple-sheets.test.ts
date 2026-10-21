import { expect, test } from "bun:test"
import "bun-match-svg"
import {
  convertCircuitJsonToDrawingArtifacts,
  convertCircuitJsonToDrawingSvg,
} from "../lib"
import { sheet, view } from "./fixtures/drawings"
import { cadScene, asymmetricScene } from "./fixtures/models"

test("multiple sheets have stable artifact identities and can be regenerated or selected", async () => {
  const input = [
    sheet("drawing_1"),
    view(),
    { ...sheet("drawing_2"), name: "BRACKET · SHEET 2" },
    view("view_2", "drawing_2"),
  ]
  const calls: string[] = []
  const options = {
    resolveScene: (drawing: ReturnType<typeof sheet>) => {
      calls.push(drawing.drawing_id)
      return drawing.drawing_id === "drawing_1" ? cadScene() : asymmetricScene()
    },
  }
  await expect(convertCircuitJsonToDrawingSvg(input, options)).rejects.toThrow(
    "Expected one drawing",
  )
  const first = await convertCircuitJsonToDrawingArtifacts(input, options)
  expect(calls).toEqual(["drawing_1", "drawing_2"])
  const regenerated = await convertCircuitJsonToDrawingArtifacts(
    [...input, ...first.map((a) => a.element)],
    options,
  )
  expect(regenerated.map((a) => a.element)).toEqual(first.map((a) => a.element))
  calls.length = 0
  const selected = await convertCircuitJsonToDrawingSvg(input, {
    ...options,
    drawingId: "drawing_2",
  })
  expect(calls).toEqual(["drawing_2"])
  await expect(selected).toMatchSvgSnapshot(import.meta.path)
})
