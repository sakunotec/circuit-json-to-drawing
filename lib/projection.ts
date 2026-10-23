import type { DrawingPartView } from "circuit-json"
import { mat4, vec4 } from "gl-matrix"
import type { Camera } from "poppygl"
import { cadToGltf } from "./coordinates"
import type { DrawingPoint } from "./types"

/** Project optional native feature labels through the actual raster camera.
 * Dimension lines already carry paper coordinates and never use this function.
 */
export function projectDrawingPoint(
  point: DrawingPoint,
  view: DrawingPartView,
  camera: Camera,
) {
  const clip = vec4.transformMat4(
    new Float64Array(4),
    [...cadToGltf([point.x, point.y, point.z]), 1],
    mat4.multiply(new Float64Array(16), camera.proj, camera.view),
  )
  if (![...clip].every(Number.isFinite) || Math.abs(clip[3]!) < 1e-12)
    throw new Error("Model feature cannot project to finite paper coordinates")
  return {
    x: view.center.x + ((clip[0]! / clip[3]!) * view.width) / 2,
    y: view.center.y + ((clip[1]! / clip[3]!) * view.height) / 2,
  }
}
