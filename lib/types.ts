import type {
  CadNamedEdge,
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
  | CadNamedEdge
  | DrawingDimensionInput
  | DrawingPage
  | DrawingPageTitleBlock
  | DrawingPartView
  | CircuitElementLike
)[]

export interface DrawingOptions {
  /** Select one configured page; omit to render all pages in document order. */
  drawingPageId?: string
  pixelsPerMm?: number
  supersampling?: number
  maxRasterPixels?: number
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
