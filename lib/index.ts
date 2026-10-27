import {
  computeWorldAABB,
  renderDrawCalls,
  encodePNG,
  createOutlineSection,
} from "poppygl"
import { renderDrawingDimensionLine } from "./dimensions"
import { drawingStyle } from "./drawing-style"
import { renderEdgeNames } from "./edge-names"
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
  DrawingPoint,
  ResolvedModelEdge,
  NamedModelEdge,
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
  const { pages, views, titleBlocks, dimensionLines } = parseDrawingDocument(
    input,
    options.drawingPageId,
  )
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
      const renderedGeometry = view.section
        ? createOutlineSection(scene.drawCalls, sectionToGltf(view.section))
            .drawCalls
        : scene.drawCalls
      if (
        !renderedGeometry.some(
          (drawCall) =>
            (drawCall.indices?.length ?? drawCall.positions.length / 3) > 0,
        )
      )
        throw new Error(
          `Part view ${view.drawing_part_view_id} has no retained geometry`,
        )
      const { bitmap, camera } = renderDrawCalls(renderedGeometry, {
        renderStyle: "outline",
        projection: "orthographic",
        width,
        height,
        supersampling,
        // PoppyGL takes output pixels and applies supersampling internally.
        // Keep visible part edges heavier than vector annotations at every DPI.
        edgeWidth: drawingStyle.outlineWidth * pixelsPerMm,
        camPos: eye,
        lookAt: center,
        up,
        showHiddenEdges: view.show_hidden_edges ?? false,
        orthographicHeight:
          view.scale == null ? null : view.height / view.scale,
      })
      const png = await encodePNG(bitmap),
        pngUrl = `data:image/png;base64,${toBase64(png)}`
      const viewLines = dimensionLines.filter(
        (line) => line.drawing_part_view_id === view.drawing_part_view_id,
      )
      const dimensionSvg =
        viewLines
          .map((line) => renderDrawingDimensionLine(line, page).svg)
          .join("") +
        (options.showEdgeNames
          ? renderEdgeNames(
              viewLines,
              options.resolveModelEdges
                ? await options.resolveModelEdges(view, input)
                : [],
              view,
              page,
              camera,
            )
          : "")
      rendered.push({ view, pngUrl, dimensionSvg })
    }
    output.push({
      drawingPageId: page.drawing_page_id,
      svg: pageToSvg(
        page,
        rendered,
        titleBlocks.find(
          (block) => block.drawing_page_id === page.drawing_page_id,
        ),
      ),
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
