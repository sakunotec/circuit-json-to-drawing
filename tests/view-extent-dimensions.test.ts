import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { drawing_dimension } from "circuit-json"
import { mat4 } from "gl-matrix"
import { renderDrawCalls } from "poppygl"
import { inferViewDimensionReference } from "../lib/view-dimension-reference"
import { measureDrawingEdge, renderDrawingDimension } from "../lib/dimensions"
import { referenceForModelEdge } from "../lib/model-edge-reference"
import { rectangularTubeDrawing } from "./fixtures/rectangular-tube-drawing"

test("model-defined straight edges and inferred view extents remain distinct on rounded and sectioned geometry", async () => {
  const fixture = rectangularTubeDrawing(40, 20, 3, 80, 3)
  const edge = fixture.readEdge("outer_top")
  const topPoints = [...edge.points].sort((a, b) => a.x - b.x)
  expect(topPoints[0]!.x).toBeCloseTo(-17, 5)
  expect(topPoints.at(-1)!.x).toBeCloseTo(17, 5)
  expect(edge.closed).toBe(false)
  const profile = fixture.readEdge("outer_profile")
  expect(profile.closed).toBe(true)
  expect(profile.points.length).toBeGreaterThan(8)
  const input = [
    ...fixture.input,
    {
      type: "drawing_dimension" as const,
      drawing_dimension_id: "actual_top_edge",
      drawing_part_view_id: "end",
      cad_component_id: fixture.cad.cad_component_id,
      edge_name: "outer_top",
      name: "Model-defined outer_top",
      orientation: "horizontal" as const,
      offset: 23,
    },
    {
      type: "drawing_dimension" as const,
      drawing_dimension_id: "native_closed_profile",
      drawing_part_view_id: "end",
      cad_component_id: fixture.cad.cad_component_id,
      edge_name: "outer_profile",
      name: "Native JSCAD rounded contour",
      orientation: "horizontal" as const,
      offset: -10,
    },
  ]
  const original = JSON.stringify(input)
  const render = (records = input) =>
    convertCircuitJsonToDrawingSvg(records, {
      pixelsPerMm: 2,
      supersampling: 2,
      resolveScene: () => fixture.scene,
      resolveModelEdge: fixture.resolveModelEdge,
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
  expect(measured(svg, "actual_top_edge")).toBeCloseTo(34, 3)
  expect(measured(svg, "end_view_width")).toBeCloseTo(40, 3)
  expect(measured(svg, "native_closed_profile")).toBeCloseTo(40, 3)
  expect(svg).toContain("34.0</text>")
  expect(svg).toContain("40.0</text>")
  expect(
    fixture.dimensions.every(
      (dimension) => !dimension.cad_component_id && !dimension.edge_name,
    ),
  ).toBe(true)
  expect([...fixture.edgeNames].sort()).toEqual([
    "inner_profile",
    "outer_left",
    "outer_profile",
    "outer_top",
  ])
  const curvedAligned = input.map((record) =>
    record.type === "drawing_dimension" &&
    "drawing_dimension_id" in record &&
    record.drawing_dimension_id === "native_closed_profile"
      ? { ...record, orientation: "aligned" as const }
      : record,
  )
  await expect(render(curvedAligned)).rejects.toThrow("straight")
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
  expect(measured(scaledSvg, "actual_top_edge")).toBeCloseTo(34, 3)
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
  for (const axis of ["width", "height"] as const) {
    const positiveDimension = drawing_dimension.parse({
      ...widthDimension,
      width_of_view: axis === "width",
      height_of_view: axis === "height",
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
    if (axis === "width") {
      expect(positive.dimensionStart.y).toBeGreaterThan(negative.end.y)
      expect(negative.dimensionStart.y).toBeLessThan(positive.start.y)
      expect(positive.start.y).toBeGreaterThan(negative.start.y)
    } else {
      expect(positive.dimensionStart.x).toBeLessThan(negative.start.x)
      expect(negative.dimensionStart.x).toBeGreaterThan(positive.end.x)
      expect(positive.start.x).toBeLessThan(negative.start.x)
    }
  }
  // Extrema along the measurement axis are not enough to place a curve's line:
  // its furthest perpendicular samples must clear the annotation as well.
  const curvedEdge = {
    points: [
      { x: -20, y: 0, z: 0 },
      { x: 0, y: 40, z: 0 },
      { x: 20, y: 0, z: 0 },
      { x: 0, y: -40, z: 0 },
    ],
    closed: true,
  }
  for (const orientation of ["horizontal", "vertical"] as const) {
    for (const offset of [8, -8]) {
      const dimension = drawing_dimension.parse({
        type: "drawing_dimension",
        drawing_dimension_id: "curve_clearance",
        drawing_part_view_id: "end",
        cad_component_id: fixture.cad.cad_component_id,
        edge_name: "curve",
        orientation,
        offset,
      })
      const annotation = renderDrawingDimension(
        dimension,
        referenceForModelEdge(curvedEdge, dimension, frontCamera),
        view,
        fixture.page,
        frontCamera,
      )
      if (orientation === "horizontal")
        expect(annotation.dimensionStart.y).toBeCloseTo(
          offset > 0 ? 58 : -58,
          5,
        )
      else
        expect(annotation.dimensionStart.x).toBeCloseTo(
          offset > 0 ? -33 : 33,
          5,
        )
    }
  }
  expect(JSON.stringify(input)).toBe(original)
  // Keep the manufacturing sheet free of a redundant overall-width callout;
  // the separate render above verifies the native contour's full projected span.
  const sheet = await render(
    input.filter(
      (record) =>
        !(
          record.type === "drawing_dimension" &&
          "drawing_dimension_id" in record &&
          record.drawing_dimension_id === "native_closed_profile"
        ),
    ),
  )
  await expect(sheet).toMatchSvgSnapshot(import.meta.path)
})
