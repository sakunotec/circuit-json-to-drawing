import { decode } from "fast-png"
/** Inspect rasterized geometry inside the rendered SVG, not Circuit JSON image records. */
export function viewImages(svg: string) {
  return Array.from(
    svg.matchAll(/href="data:image\/png;base64,([^"]+)"/g),
    (match) => decode(new Uint8Array(Buffer.from(match[1]!, "base64"))),
  )
}
