import type { DrawingDimension } from "circuit-json"
import { vec4 } from "gl-matrix"
import type { Camera } from "poppygl"
import { cadToGltf } from "./coordinates"
import type { DrawingReferenceSegment } from "./dimensions"
import type { DrawingPoint, ResolvedModelEdge } from "./types"

/** Interpret runtime reader samples for a linear annotation. This deliberately
 * does not define or serialize model topology. Projected extents consider every
 * curve sample; aligned dimensions currently support straight open features only.
 */
export function referenceForModelEdge(
  edge: ResolvedModelEdge,
  dimension: DrawingDimension,
  camera: Camera,
): DrawingReferenceSegment {
  if (
    !edge ||
    !Array.isArray(edge.points) ||
    typeof edge.closed !== "boolean" ||
    edge.points.length < 2
  )
    throw new Error(
      "Model edge reader must provide a path with at least two points",
    )
  if (
    edge.points.some(
      (point) => !point || ![point.x, point.y, point.z].every(Number.isFinite),
    )
  )
    throw new Error(
      "Model edge reader must provide finite CAD world coordinates",
    )
  const name = dimension.edge_name!
  let start = edge.points[0]!,
    end = edge.points.at(-1)!
  if (dimension.orientation === "aligned") {
    const delta = [end.x - start.x, end.y - start.y, end.z - start.z]
    const length = Math.hypot(...delta)
    const tolerance = Math.max(1, length) * 1e-7
    let previous = -Infinity
    if (edge.closed || length < 1e-6)
      throw new Error(
        `Aligned linear dimensions require a straight open model edge: "${name}"`,
      )
    for (const point of edge.points) {
      const distance = [point.x - start.x, point.y - start.y, point.z - start.z]
      const along =
        distance.reduce(
          (sum, coordinate, i) => sum + coordinate * delta[i]!,
          0,
        ) / length
      const deviation = Math.hypot(
        ...distance.map(
          (coordinate, i) => coordinate - (along * delta[i]!) / length,
        ),
      )
      if (
        !Number.isFinite(along) ||
        !Number.isFinite(deviation) ||
        deviation > tolerance ||
        along < previous - tolerance ||
        along < -tolerance ||
        along > length + tolerance
      )
        throw new Error(
          `Aligned linear dimensions require a straight open model edge: "${name}"`,
        )
      previous = along
    }
  } else {
    const axis = dimension.orientation === "horizontal" ? 0 : 1
    const coordinate = (point: DrawingPoint) =>
      vec4.transformMat4(
        new Float64Array(4),
        [...cadToGltf([point.x, point.y, point.z]), 1],
        camera.view,
      )[axis]!
    let min = coordinate(start),
      max = min
    for (const point of edge.points) {
      const value = coordinate(point)
      if (!Number.isFinite(value))
        throw new Error(
          "Model edge samples cannot produce finite projected bounds",
        )
      if (value < min) {
        min = value
        start = point
      }
      if (value > max) {
        max = value
        end = point
      }
    }
  }
  return { name, start, end, clearancePoints: edge.points }
}
