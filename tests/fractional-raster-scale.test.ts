import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingSvg, type NamedModelEdge } from "../lib"
import { page, view } from "./fixtures/drawings"
import { cadScene } from "./fixtures/models"
import { viewImages } from "./fixtures/svg-views"

test("fractional raster sizes preserve physical scale, aspect ratio and feature alignment", async () => {
  const sheet = { ...page(), height: 160 }
  const scales = [0.5, 1, 2, undefined]
  const views = scales.map((scale, index) => ({
    ...view(`scale_${index}`, sheet.drawing_page_id, "z_positive"),
    name: ["HALF SIZE", "FULL SIZE", "DOUBLE SIZE", "AUTO FIT"][index],
    width: 51,
    height: 50,
    center: { x: index % 2 ? 60 : -60, y: index < 2 ? 35 : -35 },
    scale,
  }))
  const edges: NamedModelEdge[] = [
    ["left", -10, 0],
    ["right", 10, 0],
    ["bottom", 0, -10],
    ["top", 0, 10],
  ].map(([name, x, y]) => ({
    name: name as string,
    closed: false,
    points: [-1, 1].map((z) => ({ x: x as number, y: y as number, z })),
  }))
  const scene = cadScene()
  let snapshot = ""
  for (const pixelsPerMm of [0.5, 1.3, 4]) {
    const svg = await convertCircuitJsonToDrawingSvg([sheet, ...views], {
      pixelsPerMm,
      resolveScene: () => scene,
      showEdgeNames: true,
      resolveModelEdges: () => edges,
    })
    const positions = (name: string) =>
      Array.from(
        svg.matchAll(
          new RegExp(
            `data-drawing-edge-name="${name}" x="([^"]+)" y="([^"]+)"`,
            "g",
          ),
        ),
        (match) => ({ x: Number(match[1]), y: Number(match[2]) }),
      )
    const left = positions("left"),
      right = positions("right"),
      bottom = positions("bottom"),
      top = positions("top")
    expect(left).toHaveLength(4)
    for (const [index, scale] of scales.entries()) {
      const horizontal = right[index]!.x - left[index]!.x
      const vertical = bottom[index]!.y - top[index]!.y
      // The native feature labels are projected with the actual render camera.
      // Their fixed paper-space offset cancels in these distances.
      expect(horizontal).toBeCloseTo(vertical, 4)
      if (scale !== undefined) {
        expect(horizontal).toBeCloseTo(20 * scale, 4)
        expect(vertical).toBeCloseTo(20 * scale, 4)
      } else {
        expect(horizontal).toBeLessThan(views[index]!.width)
        expect(vertical).toBeLessThan(views[index]!.height)
      }
    }
    const images = viewImages(svg)
    const imageTags = [...svg.matchAll(/<image [^>]+>/g)]
    expect(images).toHaveLength(4)
    for (const [index, image] of images.entries()) {
      const tag = imageTags[index]![0]
      const width = Number(tag.match(/ width="([^"]+)"/)![1])
      const height = Number(tag.match(/ height="([^"]+)"/)![1])
      // Raster pixels must have the same physical size in both paper axes.
      expect(width / image.width).toBeCloseTo(height / image.height, 10)
      expect(width).toBeGreaterThanOrEqual(views[index]!.width)
      expect(height).toBeGreaterThanOrEqual(views[index]!.height)
      expect(tag).toContain('clip-path="url(#viewport-')
    }
    if (pixelsPerMm === 1.3) snapshot = svg
  }
  let resolutions = 0
  await expect(
    convertCircuitJsonToDrawingSvg([sheet, views[0]!], {
      pixelsPerMm: 1.3,
      supersampling: 1,
      maxRasterPixels: 66 * 65,
      resolveScene: () => {
        resolutions++
        return scene
      },
    }),
  ).rejects.toThrow("exceeds maxRasterPixels")
  await expect(
    convertCircuitJsonToDrawingSvg([sheet, views[0]!], {
      pixelsPerMm: Number.MIN_VALUE,
      resolveScene: () => {
        resolutions++
        return scene
      },
    }),
  ).rejects.toThrow("finite physical dimensions")
  expect(resolutions).toBe(0)
  await expect(snapshot).toMatchSvgSnapshot(import.meta.path)
})
