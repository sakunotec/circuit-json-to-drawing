import type { DrawingDimensionLine, DrawingPage } from "circuit-json"
import { escapeXml } from "./svg"
import { drawingStyle } from "./drawing-style"

type Point = DrawingDimensionLine["start"]

/** Render an already resolved dimension in page-centered paper mm (+Y up).
 * Model measurement, projection and placement belong to the producer. The
 * exporter preserves both line endpoints and the supplied text verbatim.
 */
export function renderDrawingDimensionLine(
  dimension: DrawingDimensionLine,
  page: DrawingPage,
) {
  const start = { ...dimension.start },
    end = { ...dimension.end }
  const witnesses = [dimension.edge_ref_start, dimension.edge_ref_end]
  const coordinates: Point[] = [start, end]
  for (const witness of witnesses) if (witness) coordinates.push(witness)
  if (coordinates.some((point) => ![point.x, point.y].every(Number.isFinite)))
    throw new Error("Dimension line requires finite paper coordinates")
  if (typeof dimension.text !== "string" || dimension.text.length === 0)
    throw new Error("Dimension line requires preformatted text")
  const delta = { x: end.x - start.x, y: end.y - start.y }
  const span = Math.hypot(delta.x, delta.y)
  if (!Number.isFinite(span))
    throw new Error("Dimension line exceeds finite paper coordinates")
  if (span === 0) throw new Error("Dimension line endpoints must be distinct")
  const tangent = { x: delta.x / span, y: delta.y / span }
  const readable =
    tangent.x < -1e-12 || (Math.abs(tangent.x) <= 1e-12 && tangent.y < 0)
      ? -1
      : 1
  const textTangent = { x: tangent.x * readable, y: tangent.y * readable }
  const textNormal = { x: -textTangent.y, y: textTangent.x }
  const add = (point: Point, vector: Point, distance: number): Point => ({
    x: point.x + vector.x * distance,
    y: point.y + vector.y * distance,
  })
  const textWidth = Math.max(4, [...dimension.text].length * 1.8)
  const outside = span < textWidth + 7
  const labelPosition = outside
    ? add(end, tangent, textWidth / 2 + 7)
    : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const labelCenter = add(labelPosition, textNormal, 1.8)
  const arrowPoints = (tip: Point, direction: number): Point[] => {
    const base = add(tip, tangent, direction * 2.5)
    return [tip, add(base, textNormal, 0.8), add(base, textNormal, -0.8)]
  }
  const extensions = witnesses.flatMap((witness, index) => {
    if (!witness) return []
    const tip = index ? end : start
    const length = Math.hypot(tip.x - witness.x, tip.y - witness.y)
    if (!Number.isFinite(length))
      throw new Error("Dimension witness exceeds finite paper coordinates")
    if (length === 0) return []
    const direction = {
      x: (tip.x - witness.x) / length,
      y: (tip.y - witness.y) / length,
    }
    return [
      {
        start: add(witness, direction, Math.min(1, length)),
        end: add(tip, direction, 2),
      },
    ]
  })
  const outsideEnds = outside
    ? [add(start, tangent, -4), add(end, tangent, textWidth + 10)]
    : []
  const labelCorners = [-1, 1].flatMap((sign) =>
    [-2, 2].map((height) =>
      add(
        add(labelCenter, textTangent, sign * (textWidth / 2 + 1)),
        textNormal,
        height,
      ),
    ),
  )
  const paperPoints = [
    ...coordinates,
    ...extensions.flatMap((extension) => [extension.start, extension.end]),
    ...outsideEnds,
    ...labelCorners,
    ...arrowPoints(start, outside ? -1 : 1),
    ...arrowPoints(end, outside ? 1 : -1),
  ]
  if (paperPoints.some((point) => ![point.x, point.y].every(Number.isFinite)))
    throw new Error("Dimension line exceeds finite paper coordinates")
  if (
    paperPoints.some(
      (point) =>
        Math.abs(point.x) > page.width / 2 - 1 ||
        Math.abs(point.y) > page.height / 2 - 1,
    )
  )
    throw new Error(
      `Dimension line "${dimension.name ?? dimension.drawing_dimension_line_id}" extends outside its drawing page`,
    )
  const svgPoint = (point: Point) => ({
    x: page.width / 2 + point.x,
    y: page.height / 2 - point.y,
  })
  const line = (from: Point, to: Point, role: string) => {
    const p = svgPoint(from),
      q = svgPoint(to)
    const witnessStyle =
      role === "extension"
        ? ` stroke="${drawingStyle.witnessColor}" stroke-width="${drawingStyle.witnessWidth}"`
        : ""
    return `<path data-dimension-role="${role}" d="M ${p.x} ${p.y} L ${q.x} ${q.y}"${witnessStyle}/>`
  }
  const arrow = (tip: Point, direction: number) => {
    const points = arrowPoints(tip, direction).map(svgPoint)
    return `<polygon points="${points.map((point) => `${point.x},${point.y}`).join(" ")}" fill="${drawingStyle.dimensionColor}" stroke="none"/>`
  }
  const drawingLines = [
    ...extensions.map((extension) =>
      line(extension.start, extension.end, "extension"),
    ),
    line(start, end, "dimension"),
  ]
  if (outside)
    drawingLines.push(
      line(add(start, tangent, -4), start, "leader"),
      line(end, add(end, tangent, textWidth + 10), "leader"),
    )
  const angle = (-Math.atan2(textTangent.y, textTangent.x) * 180) / Math.PI
  const text = svgPoint(labelCenter)
  const svg = `<g data-drawing-dimension-line-id="${escapeXml(dimension.drawing_dimension_line_id)}" fill="none" stroke="${drawingStyle.dimensionColor}" stroke-width="${drawingStyle.dimensionWidth}"><title>${escapeXml(dimension.name ?? dimension.text)}</title>${drawingLines.join("")}${arrow(start, outside ? -1 : 1)}${arrow(end, outside ? 1 : -1)}<g transform="translate(${text.x} ${text.y}) rotate(${angle})"><rect x="${-textWidth / 2 - 0.6}" y="-1.5" width="${textWidth + 1.2}" height="3.5" fill="white" stroke="none"/><text xml:space="preserve" text-anchor="middle" dominant-baseline="middle" font-size="3" fill="${drawingStyle.textColor}" stroke="none">${escapeXml(dimension.text)}</text></g></g>`
  const labelBounds = {
    left: Math.min(...labelCorners.map((point) => point.x)),
    right: Math.max(...labelCorners.map((point) => point.x)),
    bottom: Math.min(...labelCorners.map((point) => point.y)),
    top: Math.max(...labelCorners.map((point) => point.y)),
  }
  return { svg, start, end, labelBounds }
}
