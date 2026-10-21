import type { Drawing, DrawingArtifact, DrawingView } from "circuit-json"
import type { FetchLike, GLTFScene } from "poppygl"

export interface CircuitElementLike {
  type: string
  [key: string]: unknown
}
export type DrawingDocument = readonly (
  | Drawing
  | DrawingView
  | DrawingArtifact
  | CircuitElementLike
)[]

export interface DrawingOptions {
  /** Select a single sheet; omit to generate every drawing in document order. */
  drawingId?: string
  pixelsPerMm?: number
  supersampling?: number
  /** Limit supersampled pixels per viewport. Defaults to 16 million. */
  maxRasterPixels?: number
  fetchImpl?: FetchLike
  /** Resolve exactly the selected geometry, already in glTF +Y-up mm coordinates.
   * Receives the drawing's source IDs and full input document. Called once per sheet.
   * Omit when drawing.model_glb_url supplies a pre-exported scene.
   */
  resolveScene?: (
    drawing: Drawing,
    circuitJson: DrawingDocument,
  ) => GLTFScene | Promise<GLTFScene>
}

export interface DrawingOutputArtifact {
  element: DrawingArtifact
  /** SVG text for a sheet; PNG bytes for a single view. */
  content: string | Uint8Array
}
