import { expect, test } from "bun:test"
import "bun-match-svg"
import {
  cad_named_edge,
  drawing_dimension,
  type DrawingPartView,
} from "circuit-json"
import { mat4 } from "gl-matrix"
import { renderDrawCalls } from "poppygl"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { measureDrawingEdge, projectDrawingPoint } from "../lib/dimensions"
import { rectangularTubeDrawing } from "./fixtures/rectangular-tube-drawing"

test("dimension values stay in model mm while geometry follows view scale and CAD placement", async () => {
  const fixture = rectangularTubeDrawing()
  const edge = cad_named_edge.parse(fixture.edges[0])
  const dimension = drawing_dimension.parse(fixture.dimensions[0])
  const views: DrawingPartView[] = [1, 0.5].map((scale, index) => ({
    ...fixture.views[0]!,
    drawing_part_view_id: `scale_${scale}`,
    name: `END PROFILE`,
    width: 90,
    height: 65,
    scale,
    center: { x: index ? 55 : -55, y: 25 },
  }))
  for (const view of views) {
    const { camera } = renderDrawCalls(fixture.scene.drawCalls, {
      projection: "orthographic",
      width: 360,
      height: 260,
      orthographicHeight: view.height / view.scale!,
      camPos: [0, 240, 0],
      lookAt: [0, 40, 0],
      up: "z-",
    })
    const start = projectDrawingPoint(edge.start, view, camera),
      end = projectDrawingPoint(edge.end, view, camera)
    expect(end.x - start.x).toBeCloseTo(40 * view.scale!, 5)
    expect(measureDrawingEdge(edge, dimension, camera)).toBeCloseTo(40, 5)
    const movedScene = fixture.scene.drawCalls.map((drawCall) => ({
      ...drawCall,
      model: mat4.fromTranslation(mat4.create(), [12, -4, -7]),
    }))
    const movedCamera = renderDrawCalls(movedScene, {
      projection: "orthographic",
      width: 360,
      height: 260,
      orthographicHeight: view.height / view.scale!,
      camPos: [12, 236, -7],
      lookAt: [12, 36, -7],
      up: "z-",
    }).camera
    const movedEdge = {
      ...edge,
      start: { x: edge.start.x + 12, y: edge.start.y + 7, z: edge.start.z - 4 },
      end: { x: edge.end.x + 12, y: edge.end.y + 7, z: edge.end.z - 4 },
    }
    expect(
      projectDrawingPoint(movedEdge.start, view, movedCamera).x,
    ).toBeCloseTo(start.x, 5)
    expect(
      projectDrawingPoint(movedEdge.start, view, movedCamera).y,
    ).toBeCloseTo(start.y, 5)
    const rotatedCalls = fixture.scene.drawCalls.map((drawCall) => ({
      ...drawCall,
      model: mat4.fromYRotation(mat4.create(), Math.PI / 2),
    }))
    const rotatedCamera = renderDrawCalls(rotatedCalls, {
      projection: "orthographic",
      width: 360,
      height: 260,
      orthographicHeight: view.height / view.scale!,
      camPos: [0, 240, 0],
      lookAt: [0, 40, 0],
      up: "z-",
    }).camera
    const rotatedEdge = {
      ...edge,
      start: { x: -edge.start.y, y: edge.start.x, z: edge.start.z },
      end: { x: -edge.end.y, y: edge.end.x, z: edge.end.z },
    }
    expect(
      measureDrawingEdge(
        rotatedEdge,
        { ...dimension, orientation: "vertical" },
        rotatedCamera,
      ),
    ).toBeCloseTo(40, 5)
    const rotatedStart = projectDrawingPoint(
      rotatedEdge.start,
      view,
      rotatedCamera,
    )
    const rotatedEnd = projectDrawingPoint(rotatedEdge.end, view, rotatedCamera)
    expect(rotatedEnd.y - rotatedStart.y).toBeCloseTo(40 * view.scale!, 5)
    const isoCamera = renderDrawCalls(fixture.scene.drawCalls, {
      projection: "orthographic",
      width: 300,
      height: 300,
      camPos: [200, 240, -200],
      lookAt: [0, 40, 0],
    }).camera
    expect(
      measureDrawingEdge(
        edge,
        { ...dimension, orientation: "aligned" },
        isoCamera,
      ),
    ).toBe(40)
    expect(
      measureDrawingEdge(
        edge,
        { ...dimension, orientation: "horizontal" },
        isoCamera,
      ),
    ).toBeLessThan(40)
  }
  const input = [
    ...fixture.input.filter(
      (record) =>
        record.type !== "drawing_part_view" &&
        record.type !== "drawing_dimension",
    ),
    ...views,
    ...views.map((view, i) => ({
      ...fixture.dimensions[0]!,
      orientation: "aligned" as const,
      drawing_dimension_id: `width_${i}`,
      drawing_part_view_id: view.drawing_part_view_id,
    })),
  ]
  const svg = await convertCircuitJsonToDrawingSvg(input, {
    resolveScene: () => fixture.scene,
  })
  expect(svg.match(/data-measured-value="40"/g)).toHaveLength(2)
  expect(svg).toContain("1:2")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
