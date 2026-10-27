/** Line weights are paper millimeters, independent of model scale and raster
 * resolution. Neutral grays keep the hierarchy legible in monochrome output.
 */
export const drawingStyle = {
  outlineWidth: 0.5,
  dimensionWidth: 0.2,
  dimensionColor: "#555",
  witnessWidth: 0.15,
  witnessColor: "#777",
  textColor: "#222",
} as const
