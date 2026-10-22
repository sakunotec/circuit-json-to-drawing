import { mat4, vec4 } from "gl-matrix"
import type { DrawingDimension } from "circuit-json"
import type { Camera, DrawCall } from "poppygl"
import type { DrawingReferenceSegment } from "./dimensions"

/** Infer the rendered selection's extent in orthonormal camera-space model mm.
 * Draw-call positions are model-local glTF points (+Y up), transformed through
 * their model matrix to world space and then through the actual view camera.
 * Reference endpoints are returned as CAD world points in mm (+Z up).
 * These are temporary view-bound datums, never named model edges or CJ records.
 */
export function inferViewDimensionReference(
  dimension: Pick<
    DrawingDimension,
    "width_of_view" | "height_of_view" | "offset"
  >,
  drawCalls: DrawCall[],
  camera: Camera,
): DrawingReferenceSegment {
  const minimum = [Infinity, Infinity, Infinity]
  const maximum = [-Infinity, -Infinity, -Infinity]
  for (const drawCall of drawCalls) {
    const modelView = mat4.multiply(
      new Float64Array(16),
      camera.view,
      drawCall.model,
    )
    const count = drawCall.indices?.length ?? drawCall.positions.length / 3
    for (let i = 0; i < count; i++) {
      const vertex = (drawCall.indices?.[i] ?? i) * 3
      const point = vec4.transformMat4(
        new Float64Array(4),
        [
          drawCall.positions[vertex]!,
          drawCall.positions[vertex + 1]!,
          drawCall.positions[vertex + 2]!,
          1,
        ],
        modelView,
      )
      if (![...point].every(Number.isFinite) || Math.abs(point[3]!) < 1e-12)
        throw new Error("View geometry cannot produce finite dimension bounds")
      for (let axis = 0; axis < 3; axis++) {
        const coordinate = point[axis]! / point[3]!
        minimum[axis] = Math.min(minimum[axis]!, coordinate)
        maximum[axis] = Math.max(maximum[axis]!, coordinate)
      }
    }
  }
  if (![...minimum, ...maximum].every(Number.isFinite))
    throw new Error("View geometry cannot produce finite dimension bounds")
  const inverseView = mat4.invert(new Float64Array(16), camera.view)
  if (!inverseView)
    throw new Error("View camera cannot resolve dimension bounds")
  const toCad = (x: number, y: number) => {
    const point = vec4.transformMat4(
      new Float64Array(4),
      [x, y, maximum[2]!, 1],
      inverseView,
    )
    return {
      x: point[0]! / point[3]!,
      y: -point[2]! / point[3]!,
      z: point[1]! / point[3]!,
    }
  }
  const widthY = dimension.offset < 0 ? minimum[1]! : maximum[1]!
  const heightX = dimension.offset < 0 ? maximum[0]! : minimum[0]!
  return dimension.width_of_view === true
    ? {
        name: "Width of view",
        start: toCad(minimum[0]!, widthY),
        end: toCad(maximum[0]!, widthY),
      }
    : {
        name: "Height of view",
        start: toCad(heightX, minimum[1]!),
        end: toCad(heightX, maximum[1]!),
      }
}
