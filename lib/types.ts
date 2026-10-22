import type {
  DrawingDimension,
  DrawingDimensionInput,
  DrawingPage,
  DrawingPartView,
  DrawingPageTitleBlock,
} from "circuit-json"
import type { GLTFScene } from "poppygl"

export interface CircuitElementLike {
  type: string
  [key: string]: unknown
}
export type DrawingDocument = readonly (
  | DrawingDimensionInput
  | DrawingPage
  | DrawingPageTitleBlock
  | DrawingPartView
  | CircuitElementLike
)[]

/** Coordinates at the exporter boundary: CAD world mm, +Z up. */
export interface DrawingPoint {
  x: number
  y: number
  z: number
}

/** Runtime samples from a model reader. This is not a model-edge definition or
 * a Circuit JSON record. Native topology stays with its STEP/glTF/JSCAD reader.
 * All points of a sampled curve/closed contour are retained for projected bounds.
 */
export interface ResolvedModelEdge {
  points: readonly DrawingPoint[]
  closed: boolean
}

export interface DrawingOptions {
  /** Select one configured page; omit to render all pages in document order. */
  drawingPageId?: string
  pixelsPerMm?: number
  supersampling?: number
  maxRasterPixels?: number
  /** Read a named feature from the dimension's owning model, applying the same
   * instance placement as resolveScene. Samples are CAD world mm (+Z up).
   * Called only for edge dimensions; unknown/ambiguous names must throw.
   * Do not replace curved or closed geometry with its first/last points.
   */
  resolveModelEdge?: (
    dimension: DrawingDimension,
    partView: DrawingPartView,
    circuitJson: DrawingDocument,
  ) => ResolvedModelEdge | Promise<ResolvedModelEdge>
  /** Resolve the geometry selected by this part view, in glTF +Y-up mm.
   * Geometry loading/caching is owned by the caller, outside Circuit JSON drawing configuration.
   */
  resolveScene?: (
    partView: DrawingPartView,
    circuitJson: DrawingDocument,
  ) => GLTFScene | Promise<GLTFScene>
}

/** Exporter output, never a Circuit JSON element. */
export interface DrawingPageOutput {
  drawingPageId: string
  svg: string
}
