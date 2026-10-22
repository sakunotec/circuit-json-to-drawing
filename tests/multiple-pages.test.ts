import { expect, test } from "bun:test"
import "bun-match-svg"
import {
  convertCircuitJsonToDrawingPages,
  convertCircuitJsonToDrawingSvg,
} from "../lib"
import { page, view } from "./fixtures/drawings"
import { cadScene, asymmetricScene } from "./fixtures/models"
import type { DrawingPartView } from "circuit-json"

test("pages contain independent part selections and render without output records in Circuit JSON", async () => {
  const input = [
    page("drawing_1"),
    {
      ...view("cube"),
      name: "CUBE",
      source_component_ids: ["cube"],
      center: { x: -48, y: 5 },
      width: 85,
    },
    {
      ...view("bracket"),
      name: "BRACKET",
      source_component_ids: ["bracket"],
      center: { x: 48, y: 5 },
      width: 85,
    },
    { ...page("drawing_2"), name: "BRACKET · PAGE 2" },
    { ...view("view_2", "drawing_2"), source_component_ids: ["bracket"] },
  ]
  const original = JSON.stringify(input),
    calls: string[] = []
  const options = {
    resolveScene: (part: DrawingPartView) => {
      calls.push(part.drawing_part_view_id)
      return part.source_component_ids?.[0] === "cube"
        ? cadScene()
        : asymmetricScene()
    },
  }
  await expect(convertCircuitJsonToDrawingSvg(input, options)).rejects.toThrow(
    "Expected one drawing page",
  )
  const first = await convertCircuitJsonToDrawingPages(input, options)
  expect(calls).toEqual(["cube", "bracket", "view_2"])
  expect(first.map((p) => p.drawingPageId)).toEqual(["drawing_1", "drawing_2"])
  expect(await convertCircuitJsonToDrawingPages(input, options)).toEqual(first)
  expect(JSON.stringify(input)).toBe(original)
  calls.length = 0
  const selected = await convertCircuitJsonToDrawingSvg(input, {
    ...options,
    drawingPageId: "drawing_1",
  })
  expect(calls).toEqual(["cube", "bracket"])
  await expect(selected).toMatchSvgSnapshot(import.meta.path)
})
