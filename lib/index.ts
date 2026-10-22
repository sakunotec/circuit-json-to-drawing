import { computeWorldAABB, renderDrawCalls, encodePNG } from "poppygl"
import { parseDrawingDocument } from "./document"
import { getViewOrientation, sectionToGltf } from "./coordinates"
import { pageToSvg, toBase64 } from "./svg"
import type {
  DrawingDocument,
  DrawingOptions,
  DrawingPageOutput,
} from "./types"

export type {
  DrawingDocument,
  DrawingOptions,
  DrawingPageOutput,
  CircuitElementLike,
} from "./types"
export { cadToGltf, sectionToGltf, getViewOrientation } from "./coordinates"

/** Render configured pages. Rendered files are exporter output, not Circuit JSON records. */
export async function convertCircuitJsonToDrawingPages(
  input: DrawingDocument,
  options: DrawingOptions = {},
): Promise<DrawingPageOutput[]> {
  const pixelsPerMm = options.pixelsPerMm ?? 4
  const supersampling = options.supersampling ?? 2
  const maxRasterPixels = options.maxRasterPixels ?? 16_000_000
  if (!Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0)
    throw new Error("pixelsPerMm must be finite and positive")
  if (!Number.isInteger(supersampling) || supersampling < 1)
    throw new Error("supersampling must be a positive integer")
  if (!Number.isFinite(maxRasterPixels) || maxRasterPixels <= 0)
    throw new Error("maxRasterPixels must be finite and positive")
  const { pages, views } = parseDrawingDocument(input, options.drawingPageId)
  // Validate allocation limits before starting network or scene work.
  for (const view of views.filter((v) =>
    pages.some((s) => s.drawing_page_id === v.drawing_page_id),
  )) {
    const width = Math.max(1, Math.round(view.width * pixelsPerMm)),
      height = Math.max(1, Math.round(view.height * pixelsPerMm))
    if (
      width * height * supersampling ** 2 > maxRasterPixels ||
      !Number.isSafeInteger(width * height * supersampling ** 2)
    )
      throw new Error(
        `Drawing view ${view.drawing_part_view_id} exceeds maxRasterPixels`,
      )
  }
  const output: DrawingPageOutput[] = []
  for (const page of pages) {
    const pageViews = views.filter(
      (v) => v.drawing_page_id === page.drawing_page_id,
    )
    if (!pageViews.length)
      throw new Error(`Drawing page ${page.drawing_page_id} has no part views`)
    const rendered: Parameters<typeof pageToSvg>[1] = []
    for (const view of pageViews) {
      if (!options.resolveScene)
        throw new Error(
          "resolveScene callback is required to resolve configured part geometry",
        )
      const scene = await options.resolveScene(view, input)
      if (!scene.drawCalls.some((dc) => dc.positions.length > 0))
        throw new Error(
          `Part view ${view.drawing_part_view_id} resolved empty geometry`,
        )
      const bounds = computeWorldAABB(scene.drawCalls)
      const center = bounds.min.map((min, i) => (min + bounds.max[i]!) / 2) as [
        number,
        number,
        number,
      ]
      const distance = Math.max(
        1,
        Math.hypot(...bounds.min.map((min, i) => bounds.max[i]! - min)) * 3,
      )
      const { vector, up } = getViewOrientation(view.direction)
      const length = Math.hypot(...vector)
      const eye = center.map(
        (n, i) => n + (vector[i]! / length) * distance,
      ) as [number, number, number]
      const width = Math.max(1, Math.round(view.width * pixelsPerMm)),
        height = Math.max(1, Math.round(view.height * pixelsPerMm))
      const { bitmap } = renderDrawCalls(scene.drawCalls, {
        renderStyle: "outline",
        projection: "orthographic",
        width,
        height,
        supersampling,
        camPos: eye,
        lookAt: center,
        up,
        showHiddenEdges: view.show_hidden_edges ?? false,
        orthographicHeight:
          view.scale == null ? null : view.height / view.scale,
        section: view.section ? sectionToGltf(view.section) : null,
      })
      const png = await encodePNG(bitmap),
        pngUrl = `data:image/png;base64,${toBase64(png)}`
      rendered.push({ view, pngUrl })
    }
    output.push({
      drawingPageId: page.drawing_page_id,
      svg: pageToSvg(page, rendered),
    })
  }
  return output
}

export async function convertCircuitJsonToDrawingSvg(
  input: DrawingDocument,
  options: DrawingOptions = {},
): Promise<string> {
  if (parseDrawingDocument(input, options.drawingPageId).pages.length !== 1)
    throw new Error(
      "Expected one drawing page; supply drawingPageId to select a page",
    )
  return (await convertCircuitJsonToDrawingPages(input, options))[0]!.svg
}
