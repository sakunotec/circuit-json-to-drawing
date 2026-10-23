import { expect, test } from "bun:test"
import "bun-match-svg"
import type { DrawingDimensionLine, DrawingPage } from "circuit-json"
import { renderDrawingDimensionLine } from "../lib/dimensions"

test("resolved paper endpoints preserve authored text and independently optional witness strokes", async () => {
  const page: DrawingPage = {
    type: "drawing_page",
    drawing_page_id: "resolved_lines",
    name: "Resolved dimension lines",
    width: 400,
    height: 300,
  }
  const lines: DrawingDimensionLine[] = [
    {
      type: "drawing_dimension_line",
      drawing_dimension_line_id: "horizontal",
      drawing_part_view_id: "view",
      start: { x: -150, y: 95 },
      end: { x: -50, y: 95 },
      edge_ref_start: { x: -150, y: 75 },
      edge_ref_end: { x: -50, y: 75 },
      text: "80.000 mm ±0.05",
    },
    {
      type: "drawing_dimension_line",
      drawing_dimension_line_id: "vertical",
      drawing_part_view_id: "view",
      start: { x: -140, y: -85 },
      end: { x: -140, y: 30 },
      edge_ref_start: { x: -115, y: -85 },
      text: "37.25",
    },
    {
      type: "drawing_dimension_line",
      drawing_dimension_line_id: "diagonal",
      drawing_part_view_id: "view",
      start: { x: -50, y: -75 },
      end: { x: 45, y: 20 },
      edge_ref_end: { x: 60, y: 5 },
      text: "R 12.5 <ref> & nominal",
    },
    {
      type: "drawing_dimension_line",
      drawing_dimension_line_id: "reversed",
      drawing_part_view_id: "view",
      start: { x: 160, y: 95 },
      end: { x: 60, y: 95 },
      text: "9.75 (preformatted)",
    },
    {
      type: "drawing_dimension_line",
      drawing_dimension_line_id: "short",
      drawing_part_view_id: "view",
      start: { x: 95, y: -90 },
      end: { x: 98, y: -90 },
      edge_ref_start: { x: 95, y: -90 },
      edge_ref_end: { x: 98, y: -90.25 },
      text: "0.25",
    },
  ]
  const original = JSON.stringify(lines)
  const rendered = lines.map((line) => renderDrawingDimensionLine(line, page))
  expect(rendered[0]!.svg).toContain(
    'data-dimension-role="dimension" d="M 50 55 L 150 55"',
  )
  expect(rendered[1]!.svg).toContain(
    'data-dimension-role="dimension" d="M 60 235 L 60 120"',
  )
  expect(rendered[2]!.svg).toContain(
    'data-dimension-role="dimension" d="M 150 225 L 245 130"',
  )
  expect(rendered[3]!.svg).toContain(
    'data-dimension-role="dimension" d="M 360 55 L 260 55"',
  )
  expect(
    rendered.map(
      ({ svg }) => (svg.match(/data-dimension-role="extension"/g) ?? []).length,
    ),
  ).toEqual([2, 1, 1, 0, 1])
  expect(rendered[0]!.svg).toContain('d="M 50 74 L 50 53"')
  expect(rendered[0]!.svg).toContain("80.000 mm ±0.05</text>")
  expect(rendered[2]!.svg).toContain("R 12.5 &lt;ref&gt; &amp; nominal</text>")
  expect(rendered[3]!.svg).toContain("rotate(0)")
  expect(rendered[0]!.svg).not.toContain("data-measured-value")
  for (const [index, result] of rendered.entries()) {
    expect(result.start).toEqual(lines[index]!.start)
    expect(result.end).toEqual(lines[index]!.end)
    expect(result.svg).not.toMatch(/NaN|Infinity/)
  }
  expect(JSON.stringify(lines)).toBe(original)
  expect(
    renderDrawingDimensionLine(
      {
        ...lines[0]!,
        start: { x: 0, y: 0 },
        end: { x: 1e-10, y: 0 },
        edge_ref_start: undefined,
        edge_ref_end: undefined,
      },
      page,
    ).svg,
  ).not.toMatch(/NaN|Infinity/)
  expect(() =>
    renderDrawingDimensionLine({ ...lines[0]!, end: lines[0]!.start }, page),
  ).toThrow("distinct")
  expect(() =>
    renderDrawingDimensionLine(
      { ...lines[0]!, start: { x: Infinity, y: 0 } },
      page,
    ),
  ).toThrow("finite")
  expect(() =>
    renderDrawingDimensionLine(
      { ...lines[0]!, edge_ref_end: { x: 0, y: NaN } },
      page,
    ),
  ).toThrow("finite")
  expect(() =>
    renderDrawingDimensionLine(
      {
        ...lines[4]!,
        start: { x: 190, y: 0 },
        end: { x: 193, y: 0 },
        edge_ref_start: undefined,
        edge_ref_end: undefined,
      },
      page,
    ),
  ).toThrow("outside")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400mm" height="300mm" viewBox="0 0 400 300" style="font-family:monospace"><rect width="400" height="300" fill="white"/><rect x="2" y="2" width="396" height="296" fill="none" stroke="#999" stroke-width="0.25"/>${rendered.map(({ svg }) => svg).join("")}</svg>`
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
