import type {
  CadNamedEdge,
  DrawingDimension,
  DrawingPage,
  DrawingPartView,
} from "circuit-json"
import { mat4, vec4 } from "gl-matrix"
import type { Camera } from "poppygl"
import { cadToGltf } from "./coordinates"
import { escapeXml } from "./svg"

type Point2 = { x: number; y: number }

/** Project CAD world-space points (right-handed mm, +Z up) through the exact
 * glTF (+Y-up) camera used for the view raster, into page-centered paper mm
 * (+X right, +Y up). No model-to-paper scale is used for measurement values.
 */
export function projectDrawingPoint(
  point: CadNamedEdge["start"],
  view: DrawingPartView,
  camera: Camera,
): Point2 {
  const [x, y, z] = cadToGltf([point.x, point.y, point.z])
  const clip = vec4.transformMat4(
    vec4.create(),
    [x, y, z, 1],
    mat4.multiply(mat4.create(), camera.proj, camera.view),
  )
  if (![...clip].every(Number.isFinite) || Math.abs(clip[3]!) < 1e-12)
    throw new Error(
      "Drawing reference point cannot project to finite paper coordinates",
    )
  return {
    x: view.center.x + ((clip[0]! / clip[3]!) * view.width) / 2,
    y: view.center.y + ((clip[1]! / clip[3]!) * view.height) / 2,
  }
}

/** Measure in model mm. Aligned uses true 3D segment length; horizontal/vertical
 * use the camera's orthonormal right/up directions, before paper projection.
 */
export function measureDrawingEdge(
  edge: CadNamedEdge,
  dimension: DrawingDimension,
  camera: Camera,
) {
  const delta = cadToGltf([
    edge.end.x - edge.start.x,
    edge.end.y - edge.start.y,
    edge.end.z - edge.start.z,
  ])
  if (dimension.orientation === "aligned") return Math.hypot(...delta)
  const cameraDelta = vec4.transformMat4(
    vec4.create(),
    [...delta, 0],
    camera.view,
  )
  return Math.abs(cameraDelta[dimension.orientation === "horizontal" ? 0 : 1]!)
}

/** Conventional linear dimension strokes, in physical paper mm. Extension lines
 * leave a 1 mm gap at the measured points, and 2 mm beyond the dimension line.
 * Positive offsets follow the left normal. Horizontal/vertical endpoints are
 * ordered left-to-right/bottom-to-top; aligned preserves the authored direction.
 */
export function renderDrawingDimension(
  dimension: DrawingDimension,
  edge: CadNamedEdge,
  view: DrawingPartView,
  page: DrawingPage,
  camera: Camera,
) {
  let start = projectDrawingPoint(edge.start, view, camera)
  let end = projectDrawingPoint(edge.end, view, camera)
  if (
    (dimension.orientation === "horizontal" && start.x > end.x) ||
    (dimension.orientation === "vertical" && start.y > end.y)
  )
    [start, end] = [end, start]
  const delta = { x: end.x - start.x, y: end.y - start.y }
  const projectedLength = Math.hypot(delta.x, delta.y)
  const value = measureDrawingEdge(edge, dimension, camera)
  if (
    ![start.x, start.y, end.x, end.y, projectedLength, value].every(
      Number.isFinite,
    )
  )
    throw new Error(
      `Named edge "${edge.name}" exceeds finite drawing coordinates`,
    )
  if (projectedLength < 1e-6 || value < 1e-6)
    throw new Error(
      `Named edge "${edge.name}" has no measurable ${dimension.orientation} extent in view "${view.name ?? "unnamed view"}"`,
    )
  const tangent =
    dimension.orientation === "horizontal"
      ? { x: 1, y: 0 }
      : dimension.orientation === "vertical"
        ? { x: 0, y: 1 }
        : { x: delta.x / projectedLength, y: delta.y / projectedLength }
  const normal = { x: -tangent.y, y: tangent.x }
  const dot = (point: Point2) => point.x * normal.x + point.y * normal.y
  const side = dimension.offset < 0 ? -1 : 1
  const baseline =
    (side > 0
      ? Math.max(dot(start), dot(end))
      : Math.min(dot(start), dot(end))) + dimension.offset
  const onBaseline = (point: Point2): Point2 => ({
    x: point.x + normal.x * (baseline - dot(point)),
    y: point.y + normal.y * (baseline - dot(point)),
  })
  const a = onBaseline(start),
    b = onBaseline(end)
  const span = Math.hypot(b.x - a.x, b.y - a.y)
  const label = value.toFixed(dimension.precision)
  const textWidth = Math.max(4, label.length * 1.8)
  const outside = span < textWidth + 7
  const add = (point: Point2, vector: Point2, distance: number): Point2 => ({
    x: point.x + vector.x * distance,
    y: point.y + vector.y * distance,
  })
  const labelPosition = outside
    ? add(b, tangent, textWidth / 2 + 7)
    : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const labelCenter = add(labelPosition, normal, 1.8)
  const extensionEnds = [add(a, normal, side * 2), add(b, normal, side * 2)]
  const extensionStarts = [start, end].map((point) => {
    const distance = baseline - dot(point)
    return add(
      point,
      normal,
      Math.sign(distance) * Math.min(1, Math.abs(distance)),
    )
  })
  const arrowPoints = (tip: Point2, direction: number) => {
    const base = add(tip, tangent, direction * 2.5)
    return [tip, add(base, normal, 0.8), add(base, normal, -0.8)]
  }
  const outsideEnds = outside
    ? [add(a, tangent, -4), add(b, tangent, textWidth + 10)]
    : []
  const labelCorners = [-1, 1].flatMap((sign) =>
    [-2, 2].map((height) =>
      add(
        add(labelCenter, tangent, sign * (textWidth / 2 + 1)),
        normal,
        height,
      ),
    ),
  )
  const paperPoints = [
    start,
    end,
    a,
    b,
    ...extensionEnds,
    ...extensionStarts,
    ...outsideEnds,
    ...labelCorners,
    ...arrowPoints(a, outside ? -1 : 1),
    ...arrowPoints(b, outside ? 1 : -1),
    add(labelCenter, tangent, textWidth / 2 + 1),
    add(labelCenter, tangent, -textWidth / 2 - 1),
  ]
  if (
    paperPoints.some(
      (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y),
    )
  )
    throw new Error(
      `Named edge "${edge.name}" exceeds finite drawing coordinates`,
    )
  if (
    paperPoints.some(
      (point) =>
        Math.abs(point.x) > page.width / 2 - 1 ||
        Math.abs(point.y) > page.height / 2 - 1,
    )
  )
    throw new Error(
      `Dimension of named edge "${edge.name}" extends outside its drawing page`,
    )
  const svgPoint = (point: Point2) => ({
    x: page.width / 2 + point.x,
    y: page.height / 2 - point.y,
  })
  const line = (from: Point2, to: Point2) => {
    const p = svgPoint(from),
      q = svgPoint(to)
    return `<path d="M ${p.x} ${p.y} L ${q.x} ${q.y}"/>`
  }
  const arrow = (tip: Point2, direction: number) => {
    const points = arrowPoints(tip, direction).map(svgPoint)
    return `<polygon points="${points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="black" stroke="none"/>`
  }
  const drawingLines = [
    line(extensionStarts[0]!, extensionEnds[0]!),
    line(extensionStarts[1]!, extensionEnds[1]!),
    line(a, b),
  ]
  if (outside) {
    drawingLines.push(
      line(add(a, tangent, -4), a),
      line(b, add(b, tangent, textWidth + 10)),
    )
  }
  let angle = (-Math.atan2(tangent.y, tangent.x) * 180) / Math.PI
  if (angle < -90) angle += 180
  if (angle > 90) angle -= 180
  const text = svgPoint(labelCenter)
  const svg = `<g data-drawing-dimension-id="${escapeXml(dimension.drawing_dimension_id)}" data-measured-value="${value}" fill="none" stroke="black" stroke-width="0.25"><title>${escapeXml(dimension.name ?? edge.name)}: ${label} mm</title>${drawingLines.join("")}${arrow(a, outside ? -1 : 1)}${arrow(b, outside ? 1 : -1)}<g transform="translate(${text.x} ${text.y}) rotate(${angle})"><rect x="${-textWidth / 2 - 0.6}" y="-1.5" width="${textWidth + 1.2}" height="3.5" fill="white" stroke="none"/><text text-anchor="middle" dominant-baseline="middle" font-size="3" fill="black" stroke="none">${label}</text></g></g>`
  return { svg, value, start, end, dimensionStart: a, dimensionEnd: b }
}
