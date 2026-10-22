import { expect, test } from "bun:test"
import "bun-match-svg"
import { drawing_dimension } from "circuit-json"
import { renderDrawCalls } from "poppygl"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { renderDrawingDimension } from "../lib/dimensions"
import { referenceForModelEdge } from "../lib/model-edge-reference"
import type { DrawingDocument } from "../lib"
import { rectangularTubeDrawing } from "./fixtures/rectangular-tube-drawing"

test("dimensions reject broken ownership and unusable projections before producing invalid SVG", async () => {
  const fixture = rectangularTubeDrawing()
  const edgeDimension = {
    type: "drawing_dimension" as const,
    drawing_dimension_id: "explicit_outer_top",
    orientation: "horizontal" as const,
    drawing_part_view_id: "end",
    offset: 10,
    cad_component_id: fixture.cad.cad_component_id,
    edge_name: "outer_top",
  }
  const inputWithEdge = [...fixture.input, edgeDimension]
  const patchDimension = (patch: object) =>
    inputWithEdge.map((record) =>
      record.type === "drawing_dimension" &&
      "drawing_dimension_id" in record &&
      record.drawing_dimension_id === "explicit_outer_top"
        ? { ...record, ...patch }
        : record,
    )
  const invalid: DrawingDocument[] = [
    patchDimension({ drawing_part_view_id: "missing" }),
    patchDimension({ cad_component_id: "missing" }),
    [...fixture.input, fixture.dimensions[0]!],
    [
      ...fixture.input,
      {
        type: "cad_component",
        cad_component_id: "cad_tube",
        source_component_id: "foreign_part",
      },
    ],
    inputWithEdge.filter((record) => record.type !== "cad_component"),
    inputWithEdge.map((record) =>
      record.type === "drawing_part_view"
        ? { ...record, source_component_ids: ["foreign_part"] }
        : record,
    ),
    inputWithEdge.map((record) =>
      record.type === "drawing_part_view"
        ? { ...record, source_group_id: "foreign_group" }
        : record,
    ),
  ]
  let resolutions = 0
  for (const input of invalid)
    await expect(
      convertCircuitJsonToDrawingSvg(input, {
        resolveScene: () => {
          resolutions++
          return fixture.scene
        },
        resolveModelEdge: fixture.resolveModelEdge,
      }),
    ).rejects.toThrow()
  expect(resolutions).toBe(0)
  await expect(
    convertCircuitJsonToDrawingSvg(inputWithEdge, {
      resolveScene: () => fixture.scene,
    }),
  ).rejects.toThrow("resolveModelEdge")
  await expect(
    convertCircuitJsonToDrawingSvg(patchDimension({ edge_name: "missing" }), {
      resolveScene: () => fixture.scene,
      resolveModelEdge: fixture.resolveModelEdge,
    }),
  ).rejects.toThrow()
  await expect(
    convertCircuitJsonToDrawingSvg(inputWithEdge, {
      resolveScene: () => fixture.scene,
      resolveModelEdge: () => ({
        points: [
          { x: NaN, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        closed: false,
      }),
    }),
  ).rejects.toThrow("finite")
  const camera = renderDrawCalls(fixture.scene.drawCalls, {
    projection: "orthographic",
    width: 320,
    height: 320,
    orthographicHeight: 80,
    camPos: [0, 240, 0],
    lookAt: [0, 40, 0],
    up: "z-",
  }).camera
  const view = {
    ...fixture.views[0]!,
    width: 80,
    height: 80,
    center: { x: 0, y: 0 },
  }
  // Renderer stroke/error regressions use a standalone linear adapter sample;
  // the tube's named extrusion outlines are complete closed contours.
  const dimension = drawing_dimension.parse({
    ...edgeDimension,
    edge_name: "runtime_straight",
  })
  const edge = referenceForModelEdge(
    {
      points: [
        { x: -20, y: 10, z: 0 },
        { x: 20, y: 10, z: 0 },
      ],
      closed: false,
    },
    dimension,
    camera,
  )
  expect(() =>
    referenceForModelEdge(
      {
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 10, z: 0 },
          { x: 20, y: 0, z: 0 },
        ],
        closed: false,
      },
      { ...dimension, orientation: "aligned" },
      camera,
    ),
  ).toThrow("straight")
  const zero = renderDrawingDimension(
    { ...dimension, offset: 0 },
    edge,
    view,
    fixture.page,
    camera,
  )
  expect(zero.dimensionStart).toEqual(zero.start)
  for (const offset of [0, 0.25, -0.25])
    expect(
      renderDrawingDimension(
        { ...dimension, offset },
        edge,
        view,
        fixture.page,
        camera,
      ).svg,
    ).not.toMatch(/NaN|Infinity/)
  expect(() =>
    renderDrawingDimension(
      { ...dimension, offset: 500 },
      edge,
      view,
      fixture.page,
      camera,
    ),
  ).toThrow("outside")
  const depthEdge = {
    ...edge,
    start: { x: 0, y: 0, z: 0 },
    end: { x: 0, y: 0, z: 80 },
  }
  expect(() =>
    renderDrawingDimension(
      { ...dimension, orientation: "aligned" },
      depthEdge,
      view,
      fixture.page,
      camera,
    ),
  ).toThrow("no measurable")
  const hugeEdge = { ...edge, end: { x: 1e300, y: 0, z: 0 } }
  expect(() =>
    renderDrawingDimension(dimension, hugeEdge, view, fixture.page, camera),
  ).toThrow("outside")
  const shortEdge = {
    ...edge,
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1, y: 0, z: 0 },
  }
  expect(() =>
    renderDrawingDimension(
      dimension,
      shortEdge,
      { ...view, center: { x: 132, y: 0 } },
      fixture.page,
      camera,
    ),
  ).toThrow("outside")
  const svg = await convertCircuitJsonToDrawingSvg(fixture.input, {
    resolveScene: () => fixture.scene,
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
