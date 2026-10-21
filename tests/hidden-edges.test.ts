import { expect, test } from "bun:test"
import "bun-match-svg"
import { decode } from "fast-png"
import { convertCircuitJsonToDrawingArtifacts } from "../lib"
import { sheet, twoViews } from "./fixtures/drawings"
import { cadScene } from "./fixtures/models"

test("visible outline and dashed hidden edges use the same opaque model", async () => {
  const scene = cadScene()
  const artifacts = await convertCircuitJsonToDrawingArtifacts(
    [sheet(), ...twoViews()],
    { resolveScene: () => scene },
  )
  const images = artifacts
    .filter((a) => a.element.format === "png")
    .map((a) => decode(a.content as Uint8Array))
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
  await expect(
    artifacts.find((a) => a.element.format === "svg")!.content as string,
  ).toMatchSvgSnapshot(import.meta.path)
})
