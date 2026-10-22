import type {
  DrawingPage,
  DrawingPartView,
  DrawingPartViewDirection,
} from "circuit-json"
export function page(id = "drawing_1"): DrawingPage {
  return {
    type: "drawing_page",
    drawing_page_id: id,
    name: "Housing",
    width: 210,
    height: 150,
  }
}
export function view(
  id = "view_1",
  drawingId = "drawing_1",
  direction: DrawingPartViewDirection = "isometric",
): DrawingPartView {
  return {
    type: "drawing_part_view",
    drawing_part_view_id: id,
    drawing_page_id: drawingId,
    direction,
    center: { x: 0, y: 5 },
    width: 100,
    height: 95,
  }
}
export function twoViews(): DrawingPartView[] {
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
