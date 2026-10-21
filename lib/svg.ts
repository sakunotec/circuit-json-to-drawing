import type { Drawing, DrawingView } from "circuit-json"

export function escapeXml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}

export function sheetToSvg(
  sheet: Drawing,
  views: { view: DrawingView; pngUrl: string }[],
) {
  const title = escapeXml(sheet.display_name ?? sheet.name ?? sheet.drawing_id)
  const images = views
    .map(({ view, pngUrl }, index) => {
      const x = sheet.width / 2 + view.center.x - view.width / 2
      const y = sheet.height / 2 - view.center.y - view.height / 2
      const name = escapeXml(
        view.display_name ?? view.name ?? view.drawing_view_id,
      )
      const scale =
        view.scale == null
          ? "FIT"
          : view.scale < 1
            ? `1:${Number((1 / view.scale).toPrecision(6))}`
            : `${view.scale}:1`
      return `<g data-drawing-view-id="${escapeXml(view.drawing_view_id)}"><title>${name}</title><clipPath id="viewport-${index}"><rect x="${x}" y="${y}" width="${view.width}" height="${view.height}"/></clipPath><image x="${x}" y="${y}" width="${view.width}" height="${view.height}" preserveAspectRatio="none" clip-path="url(#viewport-${index})" href="${pngUrl}"/><text x="${x + view.width / 2}" y="${y + view.height + 3.5}" text-anchor="middle" font-size="2.8">${name} · ${scale}</text></g>`
    })
    .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sheet.width}mm" height="${sheet.height}mm" viewBox="0 0 ${sheet.width} ${sheet.height}" role="img" aria-label="${title}" style="font-family:monospace"><title>${title}</title><rect width="100%" height="100%" fill="white"/>${images}<rect x="2" y="2" width="${Math.max(0, sheet.width - 4)}" height="${Math.max(0, sheet.height - 4)}" fill="none" stroke="black" stroke-width="0.25"/><path d="M2 ${sheet.height - 12} H${sheet.width - 2}" stroke="black" stroke-width="0.25"/><text x="5" y="${sheet.height - 6}" font-size="3.5">${title}</text><text x="${sheet.width - 5}" y="${sheet.height - 6}" text-anchor="end" font-size="2.5">mm · ORTHOGRAPHIC</text></svg>`
}
