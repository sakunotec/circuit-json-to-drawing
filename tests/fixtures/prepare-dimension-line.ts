import type { DrawingDimensionLineInput, DrawingPartView } from "circuit-json"
import { vec4 } from "gl-matrix"
import {
  buildCamera,
  computeWorldAABB,
  createOutlineSection,
  type Camera,
  type GLTFScene,
} from "poppygl"
import {
  cadToGltf,
  getViewOrientation,
  sectionToGltf,
  type DrawingPoint,
} from "../../lib"
import { projectDrawingPoint } from "../../lib/projection"

/** Fixture-only upstream work, representing what core will eventually prepare.
 * No geometry inference or measurement from this file ships in the exporter.
 */
export function fixtureCamera(view: DrawingPartView, scene: GLTFScene): Camera {
  const bounds = computeWorldAABB(scene.drawCalls)
  const center = bounds.min.map((min, i) => (min + bounds.max[i]!) / 2) as [
    number,
    number,
    number,
  ]
  const distance = Math.max(
    1,
    Math.hypot(...bounds.min.map((min, i) => bounds.max[i]! - min)) * 3,
  )
  const { vector, up } = getViewOrientation(view.direction)
  const length = Math.hypot(...vector)
  const eye = center.map(
    (value, i) => value + (vector[i]! / length) * distance,
  ) as [number, number, number]
  const drawCalls = view.section
    ? createOutlineSection(scene.drawCalls, sectionToGltf(view.section))
        .drawCalls
    : scene.drawCalls
  return buildCamera(
    drawCalls,
    view.width * 4,
    view.height * 4,
    45,
    eye,
    center,
    up,
    null,
    "orthographic",
    view.scale == null ? null : view.height / view.scale,
  )
}

export function scenePoints(scene: GLTFScene): DrawingPoint[] {
  return scene.drawCalls.flatMap((call) =>
    Array.from(
      call.indices ??
        Array.from({ length: call.positions.length / 3 }, (_, i) => i),
      (vertex) => {
        const point = vec4.transformMat4(
          new Float64Array(4),
          [
            call.positions[vertex * 3]!,
            call.positions[vertex * 3 + 1]!,
            call.positions[vertex * 3 + 2]!,
            1,
          ],
          call.model,
        )
        return {
          x: point[0]! / point[3]!,
          y: -point[2]! / point[3]!,
          z: point[1]! / point[3]!,
        }
      },
    ),
  )
}

export function prepareDimensionLine(
  view: DrawingPartView,
  camera: Camera,
  points: readonly DrawingPoint[],
  options: {
    id: string
    axis: "horizontal" | "vertical"
    offset: number
    precision?: number
    edgeName?: string
    name?: string
  },
): DrawingDimensionLineInput {
  if (points.length < 2)
    throw new Error("Upstream fixture needs measurable geometry")
  const axis = options.axis === "horizontal" ? 0 : 1
  const coordinates = points.map(
    (point) =>
      vec4.transformMat4(
        new Float64Array(4),
        [...cadToGltf([point.x, point.y, point.z]), 1],
        camera.view,
      )[axis]!,
  )
  const minimum = Math.min(...coordinates),
    maximum = Math.max(...coordinates)
  const startPoint = projectDrawingPoint(
    points[coordinates.indexOf(minimum)]!,
    view,
    camera,
  )
  const endPoint = projectDrawingPoint(
    points[coordinates.indexOf(maximum)]!,
    view,
    camera,
  )
  const projected = points.map((point) =>
    projectDrawingPoint(point, view, camera),
  )
  const perpendicular = projected.map((point) =>
    axis === 0 ? point.y : -point.x,
  )
  const baseline =
    (options.offset < 0
      ? Math.min(...perpendicular)
      : Math.max(...perpendicular)) + options.offset
  return {
    type: "drawing_dimension_line",
    drawing_dimension_line_id: options.id,
    drawing_part_view_id: view.drawing_part_view_id,
    start:
      axis === 0
        ? { x: startPoint.x, y: baseline }
        : { x: -baseline, y: startPoint.y },
    end:
      axis === 0
        ? { x: endPoint.x, y: baseline }
        : { x: -baseline, y: endPoint.y },
    edge_ref_start: startPoint,
    edge_ref_end: endPoint,
    text: (maximum - minimum).toFixed(options.precision ?? 1),
    ...(options.edgeName ? { edge_ref_name: options.edgeName } : {}),
    ...(options.name ? { name: options.name } : {}),
  }
}
