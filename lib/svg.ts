import type {
  DrawingPage,
  DrawingPartView,
  DrawingPageTitleBlock,
} from "circuit-json"

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

export function pageToSvg(
  page: DrawingPage,
  views: {
    view: DrawingPartView
    pngUrl: string
    dimensionSvg?: string
    imageWidth: number
    imageHeight: number
  }[],
  titleBlock?: DrawingPageTitleBlock,
) {
  const title = escapeXml(
    page.display_name ?? page.name ?? page.drawing_page_id,
  )
  const images = views
    .map(({ view, pngUrl, imageWidth, imageHeight }, index) => {
      const x = page.width / 2 + view.center.x - view.width / 2
      const y = page.height / 2 - view.center.y - view.height / 2
      const imageX = page.width / 2 + view.center.x - imageWidth / 2
      const imageY = page.height / 2 - view.center.y - imageHeight / 2
      const name = escapeXml(
        view.display_name ?? view.name ?? view.drawing_part_view_id,
      )
      const scale =
        view.scale == null
          ? "FIT"
          : view.scale < 1
            ? `1:${Number((1 / view.scale).toPrecision(6))}`
            : `${view.scale}:1`
      return `<g data-drawing-part-view-id="${escapeXml(view.drawing_part_view_id)}"><title>${name}</title><clipPath id="viewport-${index}"><rect x="${x}" y="${y}" width="${view.width}" height="${view.height}"/></clipPath><image x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="none" clip-path="url(#viewport-${index})" href="${pngUrl}"/><text x="${x + view.width / 2}" y="${y + view.height + 3.5}" text-anchor="middle" font-size="2.8">${name} · ${scale}</text></g>`
    })
    .join("")
  const dimensions = views
    .map(({ dimensionSvg }) => dimensionSvg ?? "")
    .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}mm" height="${page.height}mm" viewBox="0 0 ${page.width} ${page.height}" role="img" aria-label="${title}" style="font-family:monospace"><title>${title}</title><rect width="100%" height="100%" fill="white"/>${images}${dimensions}<rect x="2" y="2" width="${Math.max(0, page.width - 4)}" height="${Math.max(0, page.height - 4)}" fill="none" stroke="black" stroke-width="0.25"/>${titleBlock ? titleBlockToSvg(page, titleBlock) : ""}</svg>`
}

/** A compact bottom-right layout; fields reference ISO 7200, not a certified template. */
function titleBlockToSvg(page: DrawingPage, block: DrawingPageTitleBlock) {
  const x = page.width - 185,
    y = page.height - 45
  const cell = (
    left: number,
    top: number,
    width: number,
    label: string,
    value: string,
  ) =>
    `<g><rect x="${left}" y="${top}" width="${width}" height="10" fill="white" stroke="black" stroke-width="0.25"/><text x="${left + 2}" y="${top + 3}" font-size="1.8">${label}</text><text x="${left + 2}" y="${top + 7.7}" font-size="2.8" textLength="${Math.min(width - 4, value.length * 1.7)}" lengthAdjust="spacingAndGlyphs">${escapeXml(value)}</text></g>`
  const sheet = `${block.sheet_number ?? "—"} / ${block.number_of_sheets ?? "—"}`
  return `<g data-drawing-page-title-block-id="${escapeXml(block.drawing_page_title_block_id)}">${
    cell(x, y, 180, "TITLE", block.title) +
    cell(
      x,
      y + 10,
      120,
      "IDENTIFICATION NUMBER",
      block.identification_number ?? "",
    ) +
    cell(x + 120, y + 10, 30, "REVISION", block.revision_index ?? "") +
    cell(x + 150, y + 10, 30, "SHEET", sheet) +
    cell(x, y + 20, 90, "LEGAL OWNER", block.legal_owner ?? "") +
    cell(x + 90, y + 20, 90, "DATE OF ISSUE", block.date_of_issue ?? "") +
    cell(x, y + 30, 90, "CREATOR", block.creator ?? "") +
    cell(x + 90, y + 30, 90, "APPROVAL PERSON", block.approval_person ?? "")
  }</g>`
}
