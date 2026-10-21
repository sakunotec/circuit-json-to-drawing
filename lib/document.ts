import {
  drawing,
  drawing_view,
  drawing_artifact,
  type Drawing,
  type DrawingView,
} from "circuit-json"
import type { DrawingDocument } from "./types"

export function parseDrawingDocument(
  input: DrawingDocument,
  drawingId?: string,
) {
  const sheets: Drawing[] = [],
    views: DrawingView[] = []
  const sheetIds = new Set<string>(),
    viewIds = new Set<string>(),
    artifactIds = new Set<string>()
  const artifacts: ReturnType<typeof drawing_artifact.parse>[] = []
  for (const record of input) {
    if (record.type === "drawing") {
      const sheet = drawing.parse(record)
      if (sheetIds.has(sheet.drawing_id))
        throw new Error(`Duplicate drawing ID: ${sheet.drawing_id}`)
      sheetIds.add(sheet.drawing_id)
      sheets.push(sheet)
    } else if (record.type === "drawing_view") {
      const view = drawing_view.parse(record)
      if (viewIds.has(view.drawing_view_id))
        throw new Error(`Duplicate drawing view ID: ${view.drawing_view_id}`)
      viewIds.add(view.drawing_view_id)
      views.push(view)
    } else if (record.type === "drawing_artifact") {
      const artifact = drawing_artifact.parse(record)
      if (artifactIds.has(artifact.drawing_artifact_id))
        throw new Error(
          `Duplicate drawing artifact ID: ${artifact.drawing_artifact_id}`,
        )
      artifactIds.add(artifact.drawing_artifact_id)
      artifacts.push(artifact)
    }
  }
  for (const view of views) {
    const sheet = sheets.find((s) => s.drawing_id === view.drawing_id)
    if (!sheet)
      throw new Error(
        `Drawing view ${view.drawing_view_id} references missing drawing ${view.drawing_id}`,
      )
    if (
      Math.abs(view.center.x) + view.width / 2 > sheet.width / 2 + 1e-9 ||
      Math.abs(view.center.y) + view.height / 2 > sheet.height / 2 + 1e-9
    )
      throw new Error(
        `Drawing view ${view.drawing_view_id} extends outside its sheet`,
      )
  }
  for (const artifact of artifacts) {
    if (!sheetIds.has(artifact.drawing_id))
      throw new Error(
        `Artifact ${artifact.drawing_artifact_id} references a missing drawing`,
      )
    if (
      artifact.drawing_view_id &&
      !views.some(
        (v) =>
          v.drawing_view_id === artifact.drawing_view_id &&
          v.drawing_id === artifact.drawing_id,
      )
    )
      throw new Error(
        `Artifact ${artifact.drawing_artifact_id} references a missing view or a view on another drawing`,
      )
  }
  if (drawingId && !sheetIds.has(drawingId))
    throw new Error(`Drawing not found: ${drawingId}`)
  return {
    sheets: drawingId
      ? sheets.filter((s) => s.drawing_id === drawingId)
      : sheets,
    views,
  }
}
