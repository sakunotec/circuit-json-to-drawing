import { expect, test } from "bun:test"
import "bun-match-svg"
import {
  getDrawingPageDimensions,
  type DrawingPageTitleBlock,
} from "circuit-json"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { asymmetricScene } from "./fixtures/models"
import { view } from "./fixtures/drawings"
test("standard sheet sizes and explicit title blocks render without model or asset records", async () => {
  const page = {
    type: "drawing_page" as const,
    drawing_page_id: "page",
    page_size: "iso_a4" as const,
    ...getDrawingPageDimensions("iso_a4"),
  }
  const part = {
    ...view("part", "page"),
    center: { x: 0, y: 20 },
    width: 140,
    height: 120,
  }
  const block: DrawingPageTitleBlock = {
    type: "drawing_page_title_block",
    drawing_page_title_block_id: "tb",
    drawing_page_id: "page",
    title: "Housing <outline>",
    identification_number: "H-001",
    revision_index: "A",
    legal_owner: "Example & Co",
    date_of_issue: "2026-10-22",
    creator: "Designer",
    approval_person: "Checker",
    sheet_number: 1,
    number_of_sheets: 2,
  }
  let resolves = 0
  const options = {
    pixelsPerMm: 2,
    resolveScene: () => {
      resolves++
      return asymmetricScene()
    },
  }
  const svg = await convertCircuitJsonToDrawingSvg([page, part, block], options)
  expect(svg).toContain('width="297mm" height="210mm"')
  expect(svg).toContain('data-drawing-page-title-block-id="tb"')
  expect(svg).toContain("Housing &lt;outline&gt;")
  expect(svg).toContain("Example &amp; Co")
  expect(svg).toContain("1 / 2")
  const bare = await convertCircuitJsonToDrawingSvg([page, part], options)
  expect(bare).not.toContain("data-drawing-page-title-block-id")
  const before = resolves
  for (const invalid of [
    [page, part, block, { ...block, drawing_page_title_block_id: "duplicate" }],
    [page, part, { ...block, drawing_page_id: "missing" }],
    [{ ...page, width: 210 }, part, block],
    [page, part, { ...block, sheet_number: 3 }],
  ])
    await expect(
      convertCircuitJsonToDrawingSvg(invalid, options),
    ).rejects.toThrow()
  expect(resolves).toBe(before)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
