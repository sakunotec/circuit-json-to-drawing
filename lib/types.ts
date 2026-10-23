import type {
  DrawingDimensionLineInput,
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
  | DrawingDimensionLineInput
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

export interface NamedModelEdge extends ResolvedModelEdge {
  name: string
}

export interface DrawingOptions {
  /** Select one configured page; omit to render all pages in document order. */
  drawingPageId?: string
  pixelsPerMm?: number
  supersampling?: number
  maxRasterPixels?: number
  /** Show small gray feature names. Disabled by default; does not affect lines. */
  showEdgeNames?: boolean
  /** Enumerate native named features only when showEdgeNames is enabled.
   * Samples are CAD world mm (+Z up), using the same placement as resolveScene.
   * This is an optional labeling adapter, never a dimension-measurement input.
   */
  resolveModelEdges?: (
    partView: DrawingPartView,
    circuitJson: DrawingDocument,
  ) => readonly NamedModelEdge[] | Promise<readonly NamedModelEdge[]>
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
