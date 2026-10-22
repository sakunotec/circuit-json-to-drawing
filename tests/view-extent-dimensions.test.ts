import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { drawing_dimension } from "circuit-json"
import { mat4 } from "gl-matrix"
import { renderDrawCalls } from "poppygl"
import { inferViewDimensionReference } from "../lib/view-dimension-reference"
import { measureDrawingEdge, renderDrawingDimension } from "../lib/dimensions"
import { rectangularTubeDrawing } from "./fixtures/rectangular-tube-drawing"

test("model-defined straight edges and inferred view extents remain distinct on rounded and sectioned geometry", async () => {
  const fixture = rectangularTubeDrawing(40, 20, 3, 80, 3)
  const edge = fixture.edges.find((edge) => edge.name === "outer_top")!
  expect(edge.start).toEqual({ x: -17, y: 10, z: 0 })
  expect(edge.end).toEqual({ x: 17, y: 10, z: 0 })
  const input = [
    ...fixture.input,
    {
      type: "drawing_dimension" as const,
      drawing_dimension_id: "actual_top_edge",
      drawing_part_view_id: "end",
      measurement: "edge" as const,
      cad_named_edge_id: edge.cad_named_edge_id,
      name: "Model-defined outer_top",
      orientation: "horizontal" as const,
      offset: 23,
    },
  ]
  const original = JSON.stringify(input)
  const render = (records = input) =>
    convertCircuitJsonToDrawingSvg(records, {
      pixelsPerMm: 2,
      supersampling: 2,
      resolveScene: () => fixture.scene,
    })
  const measured = (drawing: string, id: string) =>
    Number(
      drawing.match(
        new RegExp(
          `data-drawing-dimension-id="${id}" data-measured-value="([^"]+)"`,
        ),
      )?.[1],
    )
  const svg = await render()
  expect(svg).toContain(
    'data-drawing-dimension-id="actual_top_edge" data-measured-value="34"',
  )
  expect(measured(svg, "end_view_width")).toBeCloseTo(40, 3)
  expect(svg).toContain("34.0</text>")
  expect(svg).toContain("40.0</text>")
  expect(
    fixture.dimensions.every((dimension) => !dimension.cad_named_edge_id),
  ).toBe(true)
  expect(fixture.edges.map((edge) => edge.name)).toEqual([
    "outer_top",
    "outer_left",
    "outer_right_longitudinal",
  ])
  const sectioned = input.map((record) =>
    record.type === "drawing_part_view" &&
    "drawing_part_view_id" in record &&
    record.drawing_part_view_id === "side"
      ? {
          ...record,
          section: {
            axis: "z" as const,
            offset: 40,
            keep_side: "less" as const,
          },
        }
      : record,
  )
  const sectionSvg = await render(sectioned)
  expect(measured(sectionSvg, "side_view_height")).toBeCloseTo(40, 3)
  const scaled = input.map((record) =>
    record.type === "drawing_part_view" ? { ...record, scale: 0.5 } : record,
  )
  const scaledSvg = await render(scaled)
  expect(measured(scaledSvg, "end_view_width")).toBeCloseTo(40, 3)
  expect(scaledSvg).toContain(
    'data-drawing-dimension-id="actual_top_edge" data-measured-value="34"',
  )
  const emptySection = input.map((record) =>
    record.type === "drawing_part_view"
      ? {
          ...record,
          section: {
            axis: "z" as const,
            offset: -1,
            keep_side: "less" as const,
          },
        }
      : record,
  )
  await expect(render(emptySection)).rejects.toThrow("no retained geometry")
  // A triangle's projected width is less than its AABB's diagonal. The unused
  // vertex must not inflate indexed geometry's extent; placement must be applied.
  const triangle = [
    {
      ...fixture.scene.drawCalls[0]!,
      positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 0, -10, 1000, 0, 0]),
      indices: new Uint32Array([0, 1, 2]),
      model: mat4.fromTranslation(mat4.create(), [12, -4, -7]),
    },
  ]
  const camera = renderDrawCalls(triangle, {
    projection: "orthographic",
    width: 100,
    height: 100,
    orthographicHeight: 100,
    camPos: [112, -4, 93],
    lookAt: [12, -4, -7],
  }).camera
  const widthDimension = drawing_dimension.parse(fixture.dimensions[0])
  const reference = inferViewDimensionReference(
    widthDimension,
    triangle,
    camera,
  )
  expect(measureDrawingEdge(reference, widthDimension, camera)).toBeCloseTo(
    10 / Math.SQRT2,
    5,
  )
  const view = {
    ...fixture.views[0]!,
    center: { x: 0, y: 0 },
    width: 100,
    height: 100,
  }
  // Signed presets start from the outer boundary on their chosen side.
  const frontCamera = renderDrawCalls(fixture.scene.drawCalls, {
    projection: "orthographic",
    width: 100,
    height: 100,
    orthographicHeight: 80,
    camPos: [0, 240, 0],
    lookAt: [0, 40, 0],
    up: "z-",
  }).camera
  for (const measurement of ["view_width", "view_height"] as const) {
    const positiveDimension = drawing_dimension.parse({
      ...widthDimension,
      measurement,
      orientation: undefined,
      offset: 8,
    })
    const negativeDimension = { ...positiveDimension, offset: -8 }
    const positive = renderDrawingDimension(
      positiveDimension,
      inferViewDimensionReference(
        positiveDimension,
        fixture.scene.drawCalls,
        frontCamera,
      ),
      view,
      fixture.page,
      frontCamera,
    )
    const negative = renderDrawingDimension(
      negativeDimension,
      inferViewDimensionReference(
        negativeDimension,
        fixture.scene.drawCalls,
        frontCamera,
      ),
      view,
      fixture.page,
      frontCamera,
    )
    if (measurement === "view_width") {
      expect(positive.dimensionStart.y).toBeGreaterThan(negative.end.y)
      expect(negative.dimensionStart.y).toBeLessThan(positive.start.y)
      expect(positive.start.y).toBeGreaterThan(negative.start.y)
    } else {
      expect(positive.dimensionStart.x).toBeLessThan(negative.start.x)
      expect(negative.dimensionStart.x).toBeGreaterThan(positive.end.x)
      expect(positive.start.x).toBeLessThan(negative.start.x)
    }
  }
  expect(JSON.stringify(input)).toBe(original)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
