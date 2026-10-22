import {
  drawing_page,
  drawing_page_title_block,
  type DrawingPageTitleBlock,
  drawing_part_view,
  type DrawingPage,
  type DrawingPartView,
} from "circuit-json"
import { parseDrawingDimensions } from "./dimension-document"
import type { DrawingDocument } from "./types"

export function parseDrawingDocument(
  input: DrawingDocument,
  drawingPageId?: string,
) {
  const pages: DrawingPage[] = [],
    views: DrawingPartView[] = []
  const titleBlocks: DrawingPageTitleBlock[] = []
  const titleBlockIds = new Set<string>()
  const titleBlockPages = new Set<string>()
  const pageIds = new Set<string>(),
    viewIds = new Set<string>()
  for (const record of input) {
    if (record.type === "drawing_page") {
      const page = drawing_page.parse(record)
      if (pageIds.has(page.drawing_page_id))
        throw new Error(`Duplicate drawing page ID: ${page.drawing_page_id}`)
      pageIds.add(page.drawing_page_id)
      pages.push(page)
    } else if (record.type === "drawing_page_title_block") {
      const block = drawing_page_title_block.parse(record)
      if (titleBlockIds.has(block.drawing_page_title_block_id))
        throw new Error(
          `Duplicate drawing title block ID: ${block.drawing_page_title_block_id}`,
        )
      if (titleBlockPages.has(block.drawing_page_id))
        throw new Error(
          `Multiple title blocks for drawing page: ${block.drawing_page_id}`,
        )
      titleBlockIds.add(block.drawing_page_title_block_id)
      titleBlockPages.add(block.drawing_page_id)
      titleBlocks.push(block)
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
  for (const block of titleBlocks) {
    const page = pages.find(
      (page) => page.drawing_page_id === block.drawing_page_id,
    )
    if (!page)
      throw new Error(
        `Title block references missing drawing page: ${block.drawing_page_id}`,
      )
    if (page.width < 190 || page.height < 50)
      throw new Error("Title block requires a page at least 190 × 50 mm")
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
  const { edges, dimensions } = parseDrawingDimensions(input, views)
  return {
    edges,
    dimensions,
    pages: drawingPageId
      ? pages.filter((p) => p.drawing_page_id === drawingPageId)
      : pages,
    views,
    titleBlocks,
  }
}
