import jscad from "@jscad/modeling"
import {
  createRectangularTubeModel,
  listJscadNamedEdges,
  readJscadNamedEdge,
} from "jscad-electronics/vanilla"
import type {
  DrawingDimension,
  DrawingDimensionInput,
  DrawingPartView,
} from "circuit-json"
import { cadScene } from "./models"

/** The solid and named native JSCAD paths come from the same Fiber component tree.
 * The reader applies feature ancestry into model-root CAD mm (+Z up). Outer CAD
 * placement is identity here; placed instances must also transform every sample.
 */
export function rectangularTubeDrawing(
  width = 40,
  height = 20,
  wall = 3,
  length = 80,
  outerRadius = 0,
) {
  const model = createRectangularTubeModel({
    width,
    height,
    wallThickness: wall,
    length,
    outerRadius,
  })
  const solid = model.geometries[0]
  if (
    model.geometries.length !== 1 ||
    !solid ||
    !jscad.geometries.geom3.isA(solid)
  )
    throw new Error("Expected the tube Fiber model to render exactly one solid")
  const scene = cadScene(solid as jscad.geometries.geom3.Geom3)
  const page = {
    type: "drawing_page" as const,
    drawing_page_id: "tube_sheet",
    name: "Rectangular stock tube",
    page_size: "iso_a4" as const,
    orientation: "landscape" as const,
    width: 297,
    height: 210,
  }
  const cad = {
    type: "cad_component",
    cad_component_id: "cad_tube",
    source_component_id: "source_tube",
  }
  const views: DrawingPartView[] = [
    {
      type: "drawing_part_view",
      drawing_part_view_id: "end",
      drawing_page_id: page.drawing_page_id,
      name: "END PROFILE",
      direction: "z_positive",
      source_component_ids: [cad.source_component_id],
      center: { x: -85, y: 35 },
      width: 90,
      height: 90,
    },
    {
      type: "drawing_part_view",
      drawing_part_view_id: "side",
      drawing_page_id: page.drawing_page_id,
      name: "SIDE ELEVATION",
      direction: "y_negative",
      source_component_ids: [cad.source_component_id],
      center: { x: 5, y: 20 },
      width: 70,
      height: 140,
    },
    {
      type: "drawing_part_view",
      drawing_part_view_id: "iso",
      drawing_page_id: page.drawing_page_id,
      name: "ISOMETRIC",
      direction: "isometric",
      source_component_ids: [cad.source_component_id],
      center: { x: 100, y: 20 },
      width: 75,
      height: 115,
    },
  ]
  const dimensions: DrawingDimensionInput[] = [
    {
      type: "drawing_dimension",
      drawing_dimension_id: "end_view_width",
      drawing_part_view_id: "end",
      width_of_view: true,
      offset: 10,
    },
    {
      type: "drawing_dimension",
      drawing_dimension_id: "end_view_height",
      drawing_part_view_id: "end",
      height_of_view: true,
      offset: 10,
    },
    {
      type: "drawing_dimension",
      drawing_dimension_id: "side_view_height",
      drawing_part_view_id: "side",
      height_of_view: true,
      offset: -10,
    },
  ]
  const block = {
    type: "drawing_page_title_block",
    drawing_page_title_block_id: "tube_title",
    drawing_page_id: page.drawing_page_id,
    title: "RECTANGULAR TUBE — DIMENSIONS IN mm",
    identification_number: "STK-040-020-003",
    revision_index: "A",
    legal_owner: "tscircuit",
    creator: "jscad-electronics",
    sheet_number: 1,
    number_of_sheets: 1,
  }
  return {
    input: [page, cad, ...views, ...dimensions, block],
    scene,
    cad,
    views,
    dimensions,
    page,
    model,
    edgeNames: listJscadNamedEdges(model),
    readEdge: (name: string) => readJscadNamedEdge(model, name),
    resolveModelEdge: (dimension: DrawingDimension) => {
      if (dimension.cad_component_id !== cad.cad_component_id)
        throw new Error("Model edge references an unknown CAD component")
      return readJscadNamedEdge(model, dimension.edge_name!)
    },
  }
}
