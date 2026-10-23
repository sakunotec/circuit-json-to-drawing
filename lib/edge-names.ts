import type {
  DrawingDimensionLine,
  DrawingPage,
  DrawingPartView,
} from "circuit-json"
import type { Camera } from "poppygl"
import { projectDrawingPoint } from "./projection"
import { renderDrawingDimensionLine } from "./dimensions"
import { escapeXml } from "./svg"
import type { DrawingPoint, NamedModelEdge } from "./types"

type Point = DrawingDimensionLine["start"]
type Label = { name: string; anchor: Point }
type Box = { left: number; right: number; bottom: number; top: number }

/** Sample a feature at half its full path length, including a closed contour's
 * closing segment. Its first/last points are not a meaningful contour midpoint.
 */
function featureMidpoint(edge: NamedModelEdge): DrawingPoint {
  if (
    !edge ||
    typeof edge.name !== "string" ||
    !edge.name.trim() ||
    !Array.isArray(edge.points) ||
    edge.points.length < 2 ||
    typeof edge.closed !== "boolean" ||
    edge.points.some(
      (point) => !point || ![point.x, point.y, point.z].every(Number.isFinite),
    )
  )
    throw new Error("Named model edges require a name and finite path samples")
  const points = edge.closed ? [...edge.points, edge.points[0]!] : edge.points
  const lengths = points.slice(1).map((point, index) => {
    const previous = points[index]!
    return Math.hypot(
      point.x - previous.x,
      point.y - previous.y,
      point.z - previous.z,
    )
  })
  const total = lengths.reduce((sum, length) => sum + length, 0)
  if (!Number.isFinite(total) || total === 0)
    throw new Error("Named model edges require a finite nonzero path")
  let remaining = total / 2
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index]!
    if (remaining <= length && length > 0) {
      const start = points[index]!,
        end = points[index + 1]!,
        t = remaining / length
      return {
        x: start.x * (1 - t) + end.x * t,
        y: start.y * (1 - t) + end.y * t,
        z: start.z * (1 - t) + end.z * t,
      }
    }
    remaining -= length
  }
  return points.at(-1)!
}

/** Optional feature-name overlay. Native enumeration owns model names; dimension
 * metadata provides a paper-space fallback when no native feature is enumerated.
 */
export function renderEdgeNames(
  lines: DrawingDimensionLine[],
  edges: readonly NamedModelEdge[],
  view: DrawingPartView,
  page: DrawingPage,
  camera: Camera,
): string {
  if (!Array.isArray(edges))
    throw new Error("Model edge enumeration must return an array")
  const labels = new Map<string, Label>()
  for (const edge of edges) {
    const anchor = projectDrawingPoint(featureMidpoint(edge), view, camera)
    if (!labels.has(edge.name))
      labels.set(edge.name, { name: edge.name, anchor })
  }
  for (const line of lines) {
    const name = line.edge_ref_name
    if (name === undefined || labels.has(name)) continue
    if (typeof name !== "string" || !name.trim())
      throw new Error("Dimension feature labels require a nonblank name")
    const a = line.edge_ref_start ?? line.edge_ref_end ?? line.start
    const b = line.edge_ref_end ?? line.edge_ref_start ?? line.end
    const anchor = { x: a.x / 2 + b.x / 2, y: a.y / 2 + b.y / 2 }
    if (![anchor.x, anchor.y].every(Number.isFinite))
      throw new Error(
        "Dimension feature labels require finite paper coordinates",
      )
    labels.set(name, { name, anchor })
  }
  if (!labels.size) return ""
  const margin = 3,
    height = 2.6,
    step = height + 0.8
  if (page.width <= 2 * margin || page.height <= 2 * margin + height)
    throw new Error("Drawing page is too small for feature names")
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value))
  // Keep debug names clear of the already authored dimension labels as well.
  const occupied: Box[] = lines.map(
    (line) => renderDrawingDimensionLine(line, page).labelBounds,
  )
  const output: string[] = []
  const ordered = [...labels.values()].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )
  for (const { name, anchor } of ordered) {
    const width = Math.min(
      page.width - 2 * margin,
      Math.max(1.8, [...name].length * 1.08),
    )
    const baseX = clamp(
      anchor.x + 1.5,
      -page.width / 2 + margin,
      page.width / 2 - margin - width,
    )
    const baseY = clamp(
      anchor.y + 1.5,
      -page.height / 2 + margin + height / 2,
      page.height / 2 - margin - height / 2,
    )
    let position: Point | undefined
    const rows = Math.ceil(page.height / step)
    for (const column of [0, 1, -1]) {
      for (let attempt = 0; attempt <= rows * 2; attempt++) {
        const row = Math.ceil(attempt / 2) * (attempt % 2 ? 1 : -1)
        const x = clamp(
          baseX + column * (width + 2),
          -page.width / 2 + margin,
          page.width / 2 - margin - width,
        )
        const y = clamp(
          baseY + row * step,
          -page.height / 2 + margin + height / 2,
          page.height / 2 - margin - height / 2,
        )
        const box = {
          left: x - 0.4,
          right: x + width + 0.4,
          bottom: y - height / 2,
          top: y + height / 2,
        }
        if (
          occupied.every(
            (other) =>
              box.right <= other.left ||
              box.left >= other.right ||
              box.top <= other.bottom ||
              box.bottom >= other.top,
          )
        ) {
          occupied.push(box)
          position = { x, y }
          break
        }
      }
      if (position) break
    }
    if (!position)
      throw new Error("Named feature labels cannot fit within the drawing page")
    output.push(
      `<text data-drawing-edge-name="${escapeXml(name)}" x="${page.width / 2 + position.x}" y="${page.height / 2 - position.y}" font-size="1.8" textLength="${width}" lengthAdjust="spacingAndGlyphs" fill="#777" stroke="none" dominant-baseline="middle">${escapeXml(name)}</text>`,
    )
  }
  return output.join("")
}
