import type { DrawingSectionPlane, DrawingViewDirection } from "circuit-json"
import type { CameraUp, OutlineSection } from "poppygl"

/** Rigid CAD (+Z-up) -> glTF (+Y-up) rotation. Both spaces use mm. */
export function cadToGltf(
  p: readonly [number, number, number],
): [number, number, number] {
  return [p[0], p[2], -p[1]]
}

const directions: Record<
  DrawingViewDirection,
  readonly [number, number, number]
> = {
  x_positive: [1, 0, 0],
  x_negative: [-1, 0, 0],
  y_positive: [0, 1, 0],
  y_negative: [0, -1, 0],
  z_positive: [0, 0, 1],
  z_negative: [0, 0, -1],
  isometric: [1, 1, 1],
}
export function getViewOrientation(direction: DrawingViewDirection) {
  const cadDirection = directions[direction]
  if (!cadDirection) throw new Error(`Unknown drawing direction: ${direction}`)
  const vector = cadToGltf(cadDirection)
  const up: CameraUp = direction.startsWith("z_") ? "z-" : "y+"
  return { vector, up }
}

/** CAD +Y becomes glTF -Z: negate the plane offset AND reverse its retained side. */
export function sectionToGltf(section: DrawingSectionPlane): OutlineSection {
  const reflected = section.axis === "y"
  return {
    axis: section.axis === "x" ? "x" : section.axis === "y" ? "z" : "y",
    offset: reflected ? -section.offset : section.offset,
    keepSide: reflected
      ? section.keep_side === "less"
        ? "greater"
        : "less"
      : section.keep_side,
    hatchSpacing: section.hatch_spacing ?? 1,
  }
}
