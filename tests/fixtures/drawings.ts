import type { Drawing, DrawingView, DrawingViewDirection } from "circuit-json"
export function sheet(id = "drawing_1"): Drawing {
  return {
    type: "drawing",
    drawing_id: id,
    name: "Housing",
    width: 210,
    height: 150,
  }
}
export function view(
  id = "view_1",
  drawingId = "drawing_1",
  direction: DrawingViewDirection = "isometric",
): DrawingView {
  return {
    type: "drawing_view",
    drawing_view_id: id,
    drawing_id: drawingId,
    direction,
    center: { x: 0, y: 5 },
    width: 100,
    height: 95,
  }
}
export function twoViews(): DrawingView[] {
  return [
    {
      ...view("visible"),
      center: { x: -48, y: 5 },
      width: 85,
      height: 95,
      name: "VISIBLE",
    },
    {
      ...view("hidden"),
      center: { x: 48, y: 5 },
      width: 85,
      height: 95,
      name: "HIDDEN",
      show_hidden_edges: true,
    },
  ]
}
