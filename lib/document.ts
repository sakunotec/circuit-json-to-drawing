import {
  drawing_page,
  drawing_part_view,
  type DrawingPage,
  type DrawingPartView,
} from "circuit-json"
import type { DrawingDocument } from "./types"

export function parseDrawingDocument(
  input: DrawingDocument,
  drawingPageId?: string,
) {
  const pages: DrawingPage[] = [],
    views: DrawingPartView[] = []
  const pageIds = new Set<string>(),
    viewIds = new Set<string>()
  for (const record of input) {
    if (record.type === "drawing_page") {
      const page = drawing_page.parse(record)
      if (pageIds.has(page.drawing_page_id))
        throw new Error(`Duplicate drawing page ID: ${page.drawing_page_id}`)
      pageIds.add(page.drawing_page_id)
      pages.push(page)
    } else if (record.type === "drawing_part_view") {
      const view = drawing_part_view.parse(record)
      if (viewIds.has(view.drawing_part_view_id))
        throw new Error(
          `Duplicate drawing part view ID: ${view.drawing_part_view_id}`,
        )
      viewIds.add(view.drawing_part_view_id)
      views.push(view)
    } else if (
      ["drawing", "drawing_view", "drawing_artifact"].includes(record.type)
    ) {
      throw new Error(
        `Unsupported drawing element ${record.type}; use drawing_page and drawing_part_view configuration`,
      )
    }
  }
  for (const view of views) {
    const page = pages.find((p) => p.drawing_page_id === view.drawing_page_id)
    if (!page)
      throw new Error(
        `Part view ${view.drawing_part_view_id} references missing drawing page ${view.drawing_page_id}`,
      )
    if (
      Math.abs(view.center.x) + view.width / 2 > page.width / 2 + 1e-9 ||
      Math.abs(view.center.y) + view.height / 2 > page.height / 2 + 1e-9
    )
      throw new Error(
        `Part view ${view.drawing_part_view_id} extends outside its page`,
      )
  }
  if (drawingPageId && !pageIds.has(drawingPageId))
    throw new Error(`Drawing page not found: ${drawingPageId}`)
  return {
    pages: drawingPageId
      ? pages.filter((p) => p.drawing_page_id === drawingPageId)
      : pages,
    views,
  }
}
