import {
  computeWorldAABB,
  createSceneFromGLTF,
  loadGLTFWithResourcesFromURL,
  renderDrawCalls,
  encodePNG,
  type GLTFScene,
} from "poppygl"
import type { Drawing } from "circuit-json"
import { parseDrawingDocument } from "./document"
import { getViewOrientation, sectionToGltf } from "./coordinates"
import { sheetToSvg, toBase64 } from "./svg"
import type {
  DrawingDocument,
  DrawingOptions,
  DrawingOutputArtifact,
} from "./types"

export type {
  DrawingDocument,
  DrawingOptions,
  DrawingOutputArtifact,
  CircuitElementLike,
} from "./types"
export { cadToGltf, sectionToGltf, getViewOrientation } from "./coordinates"

async function resolveScene(
  sheet: Drawing,
  input: DrawingDocument,
  options: DrawingOptions,
): Promise<GLTFScene> {
  if (options.resolveScene) return options.resolveScene(sheet, input)
  if (!sheet.model_glb_url)
    throw new Error(
      `Drawing ${sheet.drawing_id} needs model_glb_url or a resolveScene callback for its selected geometry`,
    )
  const { gltf, resources } = await loadGLTFWithResourcesFromURL(
    sheet.model_glb_url,
    { fetchImpl: options.fetchImpl },
  )
  return createSceneFromGLTF(gltf, resources)
}

/** Return complete sheet SVGs and individual view PNGs as Circuit JSON artifact records. */
export async function convertCircuitJsonToDrawingArtifacts(
  input: DrawingDocument,
  options: DrawingOptions = {},
): Promise<DrawingOutputArtifact[]> {
  const pixelsPerMm = options.pixelsPerMm ?? 4
  const supersampling = options.supersampling ?? 2
  const maxRasterPixels = options.maxRasterPixels ?? 16_000_000
  if (!Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0)
    throw new Error("pixelsPerMm must be finite and positive")
  if (!Number.isInteger(supersampling) || supersampling < 1)
    throw new Error("supersampling must be a positive integer")
  if (!Number.isFinite(maxRasterPixels) || maxRasterPixels <= 0)
    throw new Error("maxRasterPixels must be finite and positive")
  const { sheets, views } = parseDrawingDocument(input, options.drawingId)
  // Validate allocation limits before starting network or scene work.
  for (const view of views.filter((v) =>
    sheets.some((s) => s.drawing_id === v.drawing_id),
  )) {
    const width = Math.max(1, Math.round(view.width * pixelsPerMm)),
      height = Math.max(1, Math.round(view.height * pixelsPerMm))
    if (
      width * height * supersampling ** 2 > maxRasterPixels ||
      !Number.isSafeInteger(width * height * supersampling ** 2)
    )
      throw new Error(
        `Drawing view ${view.drawing_view_id} exceeds maxRasterPixels`,
      )
  }
  const artifacts: DrawingOutputArtifact[] = []
  for (const sheet of sheets) {
    const sheetViews = views.filter((v) => v.drawing_id === sheet.drawing_id)
    if (!sheetViews.length)
      throw new Error(`Drawing ${sheet.drawing_id} has no drawing views`)
    const scene = await resolveScene(sheet, input, options)
    if (!scene.drawCalls.some((dc) => dc.positions.length > 0))
      throw new Error(`Drawing ${sheet.drawing_id} resolved an empty scene`)
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
    const rendered: Parameters<typeof sheetToSvg>[1] = []
    for (const view of sheetViews) {
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
      artifacts.push({
        element: {
          type: "drawing_artifact",
          drawing_artifact_id: `drawing_artifact_view_${view.drawing_view_id}`,
          drawing_id: sheet.drawing_id,
          drawing_view_id: view.drawing_view_id,
          format: "png",
          url: pngUrl,
          pixel_width: width,
          pixel_height: height,
        },
        content: png,
      })
      rendered.push({ view, pngUrl })
    }
    const svg = sheetToSvg(sheet, rendered)
    artifacts.push({
      element: {
        type: "drawing_artifact",
        drawing_artifact_id: `drawing_artifact_sheet_${sheet.drawing_id}`,
        drawing_id: sheet.drawing_id,
        format: "svg",
        url: `data:image/svg+xml;base64,${toBase64(new TextEncoder().encode(svg))}`,
      },
      content: svg,
    })
  }
  return artifacts
}

/** Render one sheet. Explicitly select drawingId when the document has several sheets. */
export async function convertCircuitJsonToDrawingSvg(
  input: DrawingDocument,
  options: DrawingOptions = {},
): Promise<string> {
  const parsed = parseDrawingDocument(input, options.drawingId)
  if (parsed.sheets.length !== 1)
    throw new Error("Expected one drawing; supply drawingId to select a sheet")
  const artifacts = await convertCircuitJsonToDrawingArtifacts(input, options)
  return artifacts.find((a) => a.element.format === "svg")!.content as string
}
