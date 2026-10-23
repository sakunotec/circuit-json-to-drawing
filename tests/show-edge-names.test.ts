import { expect, test } from "bun:test"
import "bun-match-svg"
import type {
  DrawingDimensionLine,
  DrawingPage,
  DrawingPartView,
} from "circuit-json"
import { renderDrawCalls } from "poppygl"
import { convertCircuitJsonToDrawingSvg, type NamedModelEdge } from "../lib"
import { projectDrawingPoint } from "../lib/projection"
import { cadScene } from "./fixtures/models"

const labels = (svg: string) =>
  new Map(
    [
      ...svg.matchAll(
        /data-drawing-edge-name="([^"]+)" x="([^"]+)" y="([^"]+)"/g,
      ),
    ].map((match) => [match[1]!, { x: Number(match[2]), y: Number(match[3]) }]),
  )

test("feature names are opt-in, enumerate unmeasured model features, and fall back to paper witnesses", async () => {
  const page: DrawingPage = {
    type: "drawing_page",
    drawing_page_id: "names",
    name: "Feature names",
    width: 320,
    height: 240,
  }
  const view: DrawingPartView = {
    type: "drawing_part_view",
    drawing_part_view_id: "cube",
    drawing_page_id: "names",
    name: "CUBE END PROFILE",
    direction: "z_positive",
    center: { x: 0, y: 15 },
    width: 200,
    height: 160,
  }
  const scene = cadScene()
  const cap = (name: string, z: number): NamedModelEdge => ({
    name,
    closed: true,
    points: [
      { x: -10, y: -10, z },
      { x: 10, y: -10, z },
      { x: 10, y: 10, z },
      { x: -10, y: 10, z },
    ],
  })
  const features = [
    cap("bottom_cap", -10),
    cap("top_cap", 10),
    {
      name: 'side<&"',
      closed: false,
      points: [
        { x: 10, y: -10, z: -10 },
        { x: 10, y: -10, z: 10 },
      ],
    },
  ]
  const nativeBefore = JSON.stringify(features)
  let calls = 0
  const options = {
    pixelsPerMm: 1,
    supersampling: 1,
    resolveScene: () => scene,
    resolveModelEdges: () => {
      calls++
      return features
    },
  }
  const off = await convertCircuitJsonToDrawingSvg([page, view], options)
  const explicitlyOff = await convertCircuitJsonToDrawingSvg([page, view], {
    ...options,
    showEdgeNames: false,
  })
  expect(calls).toBe(0)
  expect(off).not.toContain("data-drawing-edge-name")
  expect(explicitlyOff).not.toContain("data-drawing-edge-name")
  const enabled = await convertCircuitJsonToDrawingSvg([page, view], {
    ...options,
    showEdgeNames: true,
  })
  expect(calls).toBe(1)
  expect(labels(enabled).size).toBe(3)
  expect(enabled).not.toContain("data-drawing-dimension-line-id")
  expect(enabled).toContain('data-drawing-edge-name="side&lt;&amp;&quot;"')
  expect(enabled).toContain(">side&lt;&amp;&quot;</text>")
  const named = labels(enabled)
  expect(
    Math.abs(named.get("bottom_cap")!.y - named.get("top_cap")!.y),
  ).toBeGreaterThanOrEqual(2.6)
  // A closed cap's half-path point is its opposite corner, not a midpoint of
  // its first/last samples. Names use the exact raster camera's projection.
  const camera = renderDrawCalls(scene.drawCalls, {
    renderStyle: "outline",
    projection: "orthographic",
    width: 200,
    height: 160,
    supersampling: 1,
    camPos: [0, Math.hypot(20, 20, 20) * 3, 0],
    lookAt: [0, 0, 0],
    up: "z-",
  }).camera
  const projected = projectDrawingPoint({ x: 10, y: 10, z: 0 }, view, camera)
  expect(named.get("bottom_cap")!.x).toBeCloseTo(
    page.width / 2 + projected.x + 1.5,
    5,
  )
  expect(named.get("bottom_cap")!.y).toBeCloseTo(
    page.height / 2 - projected.y - 1.5,
    5,
  )
  const lines: DrawingDimensionLine[] = [
    {
      type: "drawing_dimension_line",
      drawing_dimension_line_id: "with_witnesses",
      drawing_part_view_id: "cube",
      start: { x: -70, y: -85 },
      end: { x: 70, y: -85 },
      text: "20.000",
      edge_ref_start: { x: -70, y: -55 },
      edge_ref_end: { x: 70, y: -55 },
      edge_ref_name: "witness_hint",
    },
    {
      type: "drawing_dimension_line",
      drawing_dimension_line_id: "one_witness",
      drawing_part_view_id: "cube",
      start: { x: -125, y: -50 },
      end: { x: -125, y: 40 },
      text: "20.0",
      edge_ref_start: { x: -105, y: -50 },
      edge_ref_name: "single_hint",
    },
    {
      type: "drawing_dimension_line",
      drawing_dimension_line_id: "no_witness",
      drawing_part_view_id: "cube",
      start: { x: -45, y: 105 },
      end: { x: 45, y: 105 },
      text: "20.0",
      edge_ref_name: "line_hint",
    },
  ]
  const lineBefore = JSON.stringify(lines)
  const fallback = await convertCircuitJsonToDrawingSvg(
    [page, view, ...lines],
    {
      pixelsPerMm: 1,
      supersampling: 1,
      resolveScene: () => scene,
      showEdgeNames: true,
    },
  )
  const hints = labels(fallback)
  expect(hints.size).toBe(3)
  expect(hints.get("witness_hint")).toEqual({ x: 161.5, y: 173.5 })
  expect(hints.get("single_hint")).toEqual({ x: 56.5, y: 168.5 })
  expect(hints.get("line_hint")!.x).toBe(161.5)
  expect(Math.abs(hints.get("line_hint")!.y - 15)).toBeLessThan(8)
  const duplicate = { ...lines[0]!, edge_ref_name: "bottom_cap" }
  const deduped = await convertCircuitJsonToDrawingSvg(
    [page, view, duplicate],
    { ...options, showEdgeNames: true },
  )
  expect(
    (deduped.match(/data-drawing-edge-name="bottom_cap"/g) ?? []).length,
  ).toBe(1)
  expect(labels(deduped).get("bottom_cap")).toEqual(named.get("bottom_cap"))
  const metadataOff = await convertCircuitJsonToDrawingSvg(
    [page, view, ...lines],
    { ...options, showEdgeNames: false },
  )
  expect(metadataOff).not.toContain("data-drawing-edge-name")
  expect(calls).toBe(2)
  await expect(
    convertCircuitJsonToDrawingSvg([page, view], {
      ...options,
      showEdgeNames: true,
      resolveModelEdges: () => [
        {
          name: "bad",
          closed: false,
          points: [
            { x: NaN, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
          ],
        },
      ],
    }),
  ).rejects.toThrow("finite")
  const shifted = await convertCircuitJsonToDrawingSvg(
    [page, { ...view, center: { x: -10, y: 5 } }],
    { ...options, showEdgeNames: true },
  )
  expect(labels(shifted).get("bottom_cap")!.x).toBeCloseTo(
    named.get("bottom_cap")!.x - 10,
    5,
  )
  expect(labels(shifted).get("bottom_cap")!.y).toBeCloseTo(
    named.get("bottom_cap")!.y + 10,
    5,
  )
  expect(JSON.stringify(features)).toBe(nativeBefore)
  expect(JSON.stringify(lines)).toBe(lineBefore)
  const svg = await convertCircuitJsonToDrawingSvg([page, view, ...lines], {
    ...options,
    showEdgeNames: true,
  })
  expect(labels(svg).size).toBe(6)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
