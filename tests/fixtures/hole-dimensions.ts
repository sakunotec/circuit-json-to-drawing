import { booleans, primitives, extrusions } from "@jscad/modeling"
import type {
  DrawingDimensionLine,
  DrawingPage,
  DrawingPartView,
} from "circuit-json"
import { cadScene } from "./models"

export function holeDimensionDrawing() {
  const scene = cadScene(
    extrusions.extrudeLinear(
      { height: 4 },
      booleans.subtract(
        primitives.rectangle({ size: [50, 30] }),
        primitives.circle({ center: [-17, -8], radius: 1.5, segments: 32 }),
        primitives.circle({ center: [13, 6], radius: 2.5, segments: 32 }),
      ),
    ),
  )
  const page: DrawingPage = {
    type: "drawing_page",
    drawing_page_id: "hole_sheet",
    name: "HOLE SPACING AND EDGE OFFSETS",
    width: 180,
    height: 120,
  }
  const view: DrawingPartView = {
    type: "drawing_part_view",
    drawing_part_view_id: "plan",
    drawing_page_id: page.drawing_page_id,
    name: "MOUNTING PLATE",
    direction: "z_positive",
    center: { x: 0, y: 0 },
    width: 90,
    height: 70,
    scale: 1,
  }
  const dimensions: DrawingDimensionLine[] = [
    {
      type: "drawing_dimension_line",
      drawing_dimension_line_id: "spacing",
      drawing_part_view_id: "plan",
      start: { x: -17, y: 30 },
      end: { x: 13, y: 30 },
      edge_ref_start: { x: -17, y: -8 },
      edge_ref_end: { x: 13, y: 6 },
      text: "30 mm",
    },
    {
      type: "drawing_dimension_line",
      drawing_dimension_line_id: "width",
      drawing_part_view_id: "plan",
      start: { x: -25, y: 40 },
      end: { x: 25, y: 40 },
      edge_ref_start: { x: -25, y: 15 },
      edge_ref_end: { x: 25, y: 15 },
      text: "50 mm",
    },
    {
      type: "drawing_dimension_line",
      drawing_dimension_line_id: "offset",
      drawing_part_view_id: "plan",
      start: { x: -25, y: 22 },
      end: { x: -17, y: 22 },
      edge_ref_start: { x: -25, y: -8 },
      edge_ref_end: { x: -17, y: -8 },
      text: "8 mm",
    },
    {
      type: "drawing_dimension_line",
      drawing_dimension_line_id: "height",
      drawing_part_view_id: "plan",
      start: { x: 38, y: -15 },
      end: { x: 38, y: 6 },
      edge_ref_start: { x: 13, y: -15 },
      edge_ref_end: { x: 13, y: 6 },
      text: "21 mm",
    },
  ]
  return { scene, input: [page, view, ...dimensions], dimensions }
}
