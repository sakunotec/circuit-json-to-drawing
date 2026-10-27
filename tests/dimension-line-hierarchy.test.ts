import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { holeDimensionDrawing } from "./fixtures/hole-dimensions"
import { viewImages } from "./fixtures/svg-views"

test("part outlines stay heavier than annotations at different raster resolutions", async () => {
  const { scene, input } = holeDimensionDrawing()
  const original = JSON.stringify(input)
  const renders = []
  for (const [pixelsPerMm, supersampling] of [
    [4, 1],
    [4, 2],
    [8, 2],
  ] as const) {
    const svg = await convertCircuitJsonToDrawingSvg(input, {
      resolveScene: () => scene,
      pixelsPerMm,
      supersampling,
    })
    renders.push(svg)
    const image = viewImages(svg)[0]!
    // This scanline crosses only the plate's two vertical edges. Integrating
    // coverage includes antialiasing and tests actual paper weight, not options.
    const row = Math.floor(image.height / 2)
    let ink = 0
    for (let x = 0; x < image.width; x++)
      ink += 1 - image.data[(row * image.width + x) * 4]! / 255
    const paperWidth = ink / (2 * pixelsPerMm)
    expect(paperWidth).toBeGreaterThan(0.4)
    expect(paperWidth).toBeLessThan(0.6)
    expect(svg).toContain('stroke="#555" stroke-width="0.2"')
    expect(svg).toMatch(
      /data-dimension-role="extension"[^>]+stroke="#777" stroke-width="0.15"/,
    )
    expect(svg).toContain('fill="#222" stroke="none">30 mm</text>')
    expect(svg).toMatch(/<polygon[^>]+fill="#555" stroke="none"/)
  }
  expect(JSON.stringify(input)).toBe(original)
  await expect(renders[1]!).toMatchSvgSnapshot(import.meta.path)
})
